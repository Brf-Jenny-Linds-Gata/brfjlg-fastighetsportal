# Säkerhet – BRF JLG Fastighetsportal

Se [`docs/HANDOVER.md`](HANDOVER.md) för drift, tjänster och
övertagande, och [`docs/CHANGELOG.md`](CHANGELOG.md) för historiska
säkerhets- och driftförändringar med datum.

## 1. Syfte och säkerhetsmodell

- **UI-behörighet är inte säkerhetsgränsen.** `src/lib/permissions.ts`
  styr bara vilka sidor/flikar en roll *ser* — ren UX/bekvämlighet
  (kodverifierat, kommentar i filen). Den kan inte kringgås av en
  legitim server-kontroll, men den skyddar heller inte mot ett direkt
  API-anrop.
- **De faktiska säkerhetsgränserna är:**
  1. **Server-side kontroller** i Route Handlers/Server Actions (t.ex.
     `requireStyrelse()` i `src/lib/supabase/admin.ts`), och
  2. **Supabase Row Level Security (RLS)**, definierad i `db/*.sql` —
     gäller oavsett vilket verktyg som pratar med databasen, går inte
     att kringgå från applikationskoden.
- **Service-role kringgår RLS helt** och får därför **endast** användas
  server-side, aldrig i klientkod. Se avsnitt 9.
- **Extern kontoidentitet måste verifieras före varje ändring** i
  GitHub, Vercel, Supabase, Resend eller DNS — rätt konto för det här
  projektet är `info@brfjlg.se`. Anta aldrig att rätt konto redan är
  inloggat. Använd aldrig konton för Djupviks Jaktlag,
  bokförings-/fakturasystemet, eller andra privata/tekniska konton.

## 2. Roller

Fyra fasta roller (Postgres-enum `profil_roll`, kodverifierat i
`db/001_init_schema.sql` och `db/002_add_entreprenor_role.sql`):

| Roll | Syfte | Ungefärliga funktioner | Begränsningar |
|---|---|---|---|
| `styrelse` | Full förvaltning | Ser och skriver allt, hanterar användare/roller via `/admin` | Enda rollen som kan bjuda in eller ändra roller |
| `brandskyddsansvarig` | SBA-ansvarig | SBA-kontroller, checklistor, anmärkningar | Ingen användarhantering |
| `medlem` | Insyn i underhållsplanen | Läser underhållsplanen (läsläge) | Ingen skrivåtkomst |
| `entreprenör` | Åtgärdar SBA-anmärkningar | Ser `/anmarkningar`, markerar anmärkningar åtgärdade | Får **aldrig** eskalera egen eller andras behörighet |

**Uttryckliga principer:**

- **Endast styrelsen** får skapa eller bjuda in användare.
- **Endast styrelsen** får tilldela eller ändra roller.
- **Entreprenörer får aldrig** ge sig själva eller andra högre
  behörighet — varken via UI eller via ett direkt API-anrop. Se
  kvarstående spår **S1** (avsnitt 13) för en identifierad, ännu inte
  åtgärdad risk i just den här gränsen.
- Både **styrelse och entreprenörer** får arbeta med relevanta
  SBA-anmärkningar enligt befintlig funktion (`sba_anmarkningar`,
  `db/002`).
- **UI-åtkomst (`src/lib/permissions.ts`) ≠ databassäkerhet.** Att en
  roll inte *ser* en sida i UI:t innebär inte att RLS blockerar
  motsvarande data — RLS-policyerna är den faktiska gränsen och måste
  bedömas separat.

## 3. User provisioning

- **Självregistrering är inte tillåten.** Nya konton initieras
  uteslutande av styrelsen.
- Flödet: styrelsemedlem loggar in → `/admin` (skyddat av
  `farSe("admin", roll)` i UI och av `requireStyrelse()` server-side,
  kodverifierat i `src/lib/supabase/admin.ts`) → bjuder in via
  `auth.admin.inviteUserByEmail` (service-role, i en Route Handler
  under `src/app/api/admin/`).
- `requireStyrelse()` läser den anropande sessionens profil och
  kontrollerar rollen **innan** service-role-klienten används — detta
  skydd sker i applikationskoden, eftersom service-role självt inte har
  någon RLS att falla tillbaka på (kodverifierat).
- Användaren måste sedan ha en rad i `public.profiler` med rätt roll
  för att räknas som medlem — se avsnitt 6.
- **`inviteUserByEmail` i kombination med "Allow new users to sign up" =
  OFF är inte fullständigt end-to-end-verifierat** i Production ännu.
  Se kvarstående spår **S2** (avsnitt 13) — påstå inte att detta redan
  är bevisat.

## 4. Supabase Auth-inställningar

**Production-status, Production-verifierat 2026-07-30** (dashboardinställningar,
inte versionsstyrd kod — kan bara verifieras genom att logga in i
Supabase Dashboard, inte via `git`):

| Inställning | Status |
|---|---|
| Allow new users to sign up | **OFF** |
| Confirm email | **ON** |
| Allow anonymous sign-ins | **OFF** |
| Allow manual linking | **OFF** |

**Kontrollregel:** dessa inställningar ska **verifieras på nytt** i
Supabase Dashboard **innan** någon framtida auth-relaterad ändring —
de kan ändras utanför Git och utan spår i repot.

- Konto att verifiera först: `info@brfjlg.se`
- Organisation: `Brf Jenny Linds Gata`
- Project ref: `mghmedkjxrbolhtllkba`

## 5. Magic-link-flödet

Kodverifierat:

- `src/app/login/page.tsx` anropar
  `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo,
  shouldCreateUser: false } })`.
- `shouldCreateUser: false` gör att Supabase **aldrig** skapar ett nytt
  `auth.users`-konto åt en okänd e-postadress via detta anrop.
- Felkoden `signup_disabled` (Supabase Auths dokumenterade kod när ett
  nytt konto skulle behövt skapas men inte får) mappas om till ett
  tydligt svenskt meddelande — alla andra fel visas oförändrade.
- `src/app/auth/callback/route.ts` tar emot PKCE-koden från den
  riktiga e-postlänken och upprättar sessionen.
- `src/app/auth/logout/route.ts` gör ett explicit **HTTP 303**-redirect
  till `/login` efter `signOut()` (ändrat från det implicita 307:an,
  se `docs/CHANGELOG.md`) — 307 hade bevarat POST-metoden och skickat
  webbläsaren mot `/login` med en POST som sidan inte stödjer; 303
  tvingar uppföljningen till GET oavsett ursprungsmetod.
- **Vanlig lösenordsinloggning är inte implementerad.** Se S5.

## 6. Profilkravet

`auth.users` (Supabase Auths kontotabell) och `public.profiler`
(applikationens rolltabell) är **separata tabeller**. Ett konto i
`auth.users` bevisar bara att någon kunnat logga in — det bevisar inte
medlemskap i föreningens portal. Innan migration `010` kontrollerade
läspolicyerna bara `auth.role() = 'authenticated'`, inte om personen
faktiskt hade en `profiler`-rad.

`public.is_member()` (kodverifierat, `db/010_require_profile_for_read_access.sql`):

- `returns boolean`
- `SECURITY DEFINER`
- `STABLE`
- `set search_path = ''` (låst — förhindrar search-path-manipulation)
- `EXECUTE` beviljat till `authenticated`
- `EXECUTE` **återkallat** från `anon` och `PUBLIC` (CREATE FUNCTION ger
  annars EXECUTE till PUBLIC som standard — detta återkallas explicit)
- Kontrollerar enbart den anropande sessionens egen `auth.uid()` mot
  `public.profiler`, returnerar bara en boolean — ingen raddata lämnar
  funktionen
- `SECURITY DEFINER` krävs specifikt för att undvika RLS-självrekursion:
  om `profiler`s egen policy gjorde en direkt `SELECT ... FROM profiler`
  i sin `USING`-klausul skulle Postgres ge
  `infinite recursion detected in policy for relation "profiler"`

## 7. Migration 010 och RLS

- **Fil:** `db/010_require_profile_for_read_access.sql`
- **Syfte:** kräva `public.is_member()` (bevisat medlemskap i
  `profiler`) för läsning, inte bara giltig autentisering.
- **10 SELECT-policyer** ändrade till att kräva `public.is_member()`
  (kodverifierat, exakta tabellnamn ur migrationen):
  `fastigheter`, `portar`, `uh_kategorier`, `uh_poster`,
  `uh_andringslogg`, `sba_kontrollpunkter`, `sba_kontroller`,
  `sba_kontroll_resultat`, `sba_anmarkningar`, `profiler`.
- **INSERT/UPDATE/DELETE-policyer rörs inte** av denna migration — den
  gemensamma arbetskömodellen för styrelse/brandskyddsansvarig/
  entreprenör är oförändrad (kodverifierat, kommentar i migrationen).
- RLS är **fortsatt aktiverat** på samtliga berörda tabeller.
- Migrationen är **applicerad i Production** (Production-verifierat
  2026-07-30).
- Migrationens kod är versionsstyrd i `db/010_...sql` — inga manuella,
  ospårade ändringar.

## 8. Storage

- Bucket: **`sba-foton`** (privat) — bilder på SBA-anmärkningar.
- SELECT-princip (kodverifierat, `db/010`):
  `bucket_id = 'sba-foton' AND public.is_member()`.
- Policyn är **verifierad via databasmetadata** och via det isolerade
  RLS-testet (se avsnitt 12) — men **inget komplett autentiserat
  Storage API end-to-end-test** är genomfört. Se kvarstående spår
  **S3**.

## 9. Service-role och servergräns

- Service-role-klienten skapas i `src/lib/supabase/admin.ts`
  (kodverifierat).
- Den kringgår RLS **helt** — det finns ingen radnivå-begränsning kvar
  när den används.
- Får **aldrig importeras i klientkod** (kommentar i filen,
  kodverifierat).
- Alla anrop som använder den måste själva skyddas av en
  server-side-behörighetskontroll (`requireStyrelse()`), eftersom
  databasen inte längre gör det jobbet åt dig.
- **Ny funktionalitet som använder service-role kräver en separat
  säkerhetsgranskning** innan den läggs till — utökad
  service-role-användning är inte en trivial ändring.

## 10. Production-gates

Fast gateprincip för allt arbete som rör Production eller externa
tjänster:

1. **Read-only inventering** — förstå nuläget utan att ändra något.
2. **Föreslagen ändring** — beskrivs konkret innan den görs.
3. **Granskning** — av den föreslagna ändringen.
4. **Lokal verifiering** — testas/läses lokalt där det är möjligt.
5. **Separat godkännande** — uttryckligt, inte underförstått.
6. **Migration eller deploy** — själva utförandet.
7. **Production-verifiering** — funktionell kontroll efteråt.
8. **Dokumentation** — resultatet skrivs ner (t.ex. i
   `docs/CHANGELOG.md`).

**Absoluta regler:**

- Ingen Supabase SQL utan en separat gate.
- Ingen användar- eller rolländring utan en separat gate.
- Ingen auth-, Storage-, env-, Resend- eller DNS-ändring utan en
  separat gate.
- **Inget antagande om vilket konto som är inloggat** — verifiera
  alltid `info@brfjlg.se` innan en extern ändring.

## 11. Genomförd säkerhetsfix 2026-07-30

Fullständig historik i [`docs/CHANGELOG.md`](CHANGELOG.md#2026-07-30--säkring-av-medlemsåtkomst-och-logout).
Beständig status, sammanfattad här:

| Åtgärd | Källa/bevisnivå |
|---|---|
| Supabase Auth "Allow new users to sign up" = OFF | Production-verifierat 2026-07-30 |
| `signInWithOtp({ shouldCreateUser: false })` | Kodverifierat (`src/app/login/page.tsx`) |
| Migration `db/010` applicerad | Production-verifierat 2026-07-30 + Git-verifierat (filen finns versionsstyrd) |
| `public.is_member()` (SECURITY DEFINER, STABLE, låst search_path) | Kodverifierat |
| RLS- och Storage-säkring (10 SELECT-policyer + `sba-foton`) | Kodverifierat |
| Borttagen profillös användare | Production-verifierat 2026-07-30 (uppgivet i överlämningsunderlaget) |
| `auth.users = 6` | Production-verifierat 2026-07-30 (uppgivet) |
| `public.profiler = 6` | Production-verifierat 2026-07-30 (uppgivet) |
| `profileless_auth_users = 0` | Production-verifierat 2026-07-30 (uppgivet) |
| Production-inloggning för en befintlig avsedd användare | Production-verifierat 2026-07-30 (uppgivet) |
| Ingen observerad RLS-regression | Production-verifierat 2026-07-30 (uppgivet) |
| Logout: explicit HTTP 303 | Kodverifierat + Git-verifierat, commit `545ac9289d30b1935596cea165961d8c9ae817ac` |
| Vercel-deployment success | Uppgivet i överlämningsunderlaget |
| Production-verifiering genomförd | Uppgivet i överlämningsunderlaget |

## 12. Säkerhetstest

- [`../test/security/rls-integration/README.md`](../test/security/rls-integration/README.md) —
  metodik, isoleringsgarantier, körinstruktioner
- [`../test/security/rls-integration/RESULTS_2026-07-30.md`](../test/security/rls-integration/RESULTS_2026-07-30.md) —
  körresultat

**Sammanfattning:** **44 PASS / 0 FAIL**, kört isolerat mot en
engångs-Postgres-container på en separat NUC-miljö (helt skild från
Production och från Djupviks Jaktlags miljö) — ingen Production-
anslutning, inga riktiga magic links/invites/JWT:er.

Testet verifierar RLS-lagret (policyer, `is_member()`,
recursion-frihet) mot simulerade claims i en riktig Postgres-instans.
Det **ersätter inte** ett fullständigt Production API end-to-end-test
— GoTrue/PostgREST/Storage API-lagren testas inte här (Storage-testmålet
blev uttryckligen **SKIPPED**, inte falskt PASS, eftersom
`storage.objects` inte fanns i testavbildningen).

## 13. Kvarstående säkerhetsspår

Följande är **inte** del av den avslutade fixen 2026-07-30. De ska
utredas och ev. åtgärdas som separata, framtida read-only-spår, var och
en med en egen uttrycklig gate. Ingen lösning beskrivs som redan
beslutad nedan.

### S1. `sba_anmarkningar` – kolumnintegritet

- Entreprenörens UPDATE-policy (`db/002_add_entreprenor_role.sql`:
  `create policy "entreprenör åtgärdar anmarkningar" on sba_anmarkningar
  for update using (...)`) saknar en `WITH CHECK`-klausul och någon
  kolumnbegränsning.
- Enligt inventeringen kan detta i nuläget tillåta fler kolumnändringar
  via ett direkt API-anrop än vad som är avsett (dvs. mer än att bara
  markera en anmärkning åtgärdad).
- Kräver en separat, read-only säkerhetsanalys av exakt vilka kolumner
  som bör vara skrivbara för rollen `entreprenör`.
- **Ingen policy, trigger, funktion, grant eller annan databasändring
  får göras utan en ny uttrycklig gate.**

### S2. `inviteUserByEmail` med signup OFF

- Ska verifieras med en verklig, avsedd användare eller genom en
  separat kontrollerad testplan.
- **Ingen användare får bjudas in** som en del av detta
  verifieringsarbete utan uttryckligt godkännande.

### S3. Storage API end-to-end

- Storage-policyn är verifierad via databasmetadata (avsnitt 8) och via
  det SQL-baserade RLS-testet.
- Ett komplett, autentiserat Storage API-test (riktiga tokens, riktigt
  REST-anrop) återstår som framtida verifiering.

### S4. PostgREST end-to-end

- Kan verifieras separat med faktiska autentiserade roller.
- Tokens, sessioner och användaruppgifter måste hanteras säkert om ett
  sådant test genomförs.
- **Ingen Production-förändring** utan en ny gate.

### S5. Inloggningsmodell

- Projektet använder idag magic link (avsnitt 5).
- Önskad framtida ändring är vanlig e-post + lösenord, enligt samma
  grundprincip som används i föreningens systerprojekt (Djupviks
  Jaktlag).
- Detta är **endast ett framtida utvecklingsspår** — inte implementerat
  och inte beslutat i detalj. Kräver ett eget design-, säkerhets-,
  migrerings- och testspår innan det påbörjas.

## 14. Säkerhetschecklista före extern ändring

- [ ] Rätt konto: `info@brfjlg.se`
- [ ] Rätt organisation/team
- [ ] Rätt projekt/project ref
- [ ] Rätt miljö (Production vs. ev. testmiljö)
- [ ] Ändringen är avgränsad
- [ ] Backup/rollback är bedömd innan ändringen görs
- [ ] Inga hemligheter i terminalutskrift, diff eller dokumentation
- [ ] Separat, uttryckligt godkännande inhämtat
- [ ] Efterkontroll genomförd och dokumenterad

## 15. Dokumentunderhåll

- **Säkerhetsstatus senast verifierad:** 2026-07-30
- Dokumentet ska uppdateras när något av följande sker:
  - Auth-inställningar ändras
  - Roller ändras
  - RLS- eller Storage-policyer ändras
  - Service-role-användningen ändras eller utökas
  - En ny extern tjänst med säkerhetsrelevans tillkommer
  - Ett säkerhetstest eller en ny Production-verifiering genomförs
- Inaktuella uppgifter ska datumstämplas eller tas bort — lämna dem
  aldrig kvar odaterade som om de vore aktuell sanning.
