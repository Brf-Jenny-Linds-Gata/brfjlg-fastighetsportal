# Teknisk överlämning – BRF JLG Fastighetsportal

## 1. Dokumentets syfte

Det här dokumentet stödjer att en **ny tekniskt kunnig person** kan ta
över både **drift** och **vidareutveckling** av portalen utan att vara
beroende av den nuvarande projektägarens minne.

- **Dokumentationsbaslinje:** 2026-07-30
- **Aktuell verifierad commit vid dokumentationstillfället:**
  `545ac9289d30b1935596cea165961d8c9ae817ac` — "fix: use get redirect
  after logout" (Git-verifierat)
- Baslinjen ovan är en **datumstämplad ögonblicksbild**, inte ett värde
  som förblir aktuellt för alltid. **Verifiera alltid Git-status på
  nytt** innan du utgår från något i det här dokumentet:

  ```bash
  git branch --show-current
  git rev-parse HEAD
  git rev-parse origin/main
  git rev-list --left-right --count HEAD...origin/main
  git status --short
  ```

- För säkerhetsmodell, autentisering och kvarstående säkerhetsrisker,
  se [`docs/SECURITY.md`](SECURITY.md).
- För historiska ändringar med datum, se [`docs/CHANGELOG.md`](CHANGELOG.md).
- För den praktiska driftkalendern — vad som ska kontrolleras, när,
  var och av vem — se [`docs/OPERATIONS.md`](OPERATIONS.md). Det här
  dokumentet (HANDOVER) förklarar principerna; OPERATIONS ger
  frekvenser och checklistor.
- För den lättlästa systemöversikten, se [`README.md`](../README.md).

## 2. Systemets syfte och omfattning

BrfJLG Fastighetsportal är en webbapp för **Brf Jenny Linds Gata**
(Stockholm) som ersätter Excel/Planima för:

- **Underhållsplanering** (`uh_poster`) – planerade och genomförda
  underhållsåtgärder per fastighet, kategori och år, med automatisk
  ändringslogg.
- **SBA — systematiskt brandskyddsarbete** (`sba_*`) – kvartalsvisa
  kontroller med checklistor och anmärkningar, inklusive foton, per
  fastighet/port.

**Huvudsakliga användargrupper** (fyra roller, se
[`docs/SECURITY.md`](SECURITY.md#2-roller) för den fulla behörighetsmodellen):

- **styrelse** – full åtkomst, inklusive användarhantering
- **brandskyddsansvarig** – SBA-kontroller och anmärkningar
- **medlem** – läser underhållsplanen
- **entreprenör** – ser och åtgärdar SBA-anmärkningar

Fullständig funktionsbeskrivning (export, ändringslogg m.m.) finns i
README:s huvudsektioner — det här dokumentet dupliceras inte i onödan.

## 3. Teknisk stack och arkitektur

Se README:s ["Teknisk stack"](../README.md#teknisk-stack) och
["Arkitektur & anslutna tjänster"](../README.md#arkitektur--anslutna-tjänster)
för den fullständiga tabellen och arkitekturdiagrammet. Sammanfattat och
**kodverifierat** mot `package.json` / repo-struktur vid
dokumentationstillfället:

| Del | Verifierat värde |
|---|---|
| Ramverk | Next.js `16.2.10` med App Router |
| React | `19.2.4` |
| Språk | TypeScript `^5` |
| UI | Tailwind CSS `^4` |
| Databas/Auth/Storage | `@supabase/ssr ^0.12.0`, `@supabase/supabase-js ^2.110.0` |
| Grafer | `recharts ^3.9.1` |
| Ikoner | `lucide-react` |

**Viktigt (kodverifierat i `AGENTS.md`):** projektet kör Next.js 16, som
bryter mot flera konventioner från äldre versioner (t.ex.
`middleware.ts` → `src/proxy.ts`, helt asynkrona request-API:er). Läs
`AGENTS.md` och `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`
innan du antar hur något fungerar baserat på äldre Next.js-kunskap.

**Server/klient-gräns:**

- `src/proxy.ts` – körs på varje request, kräver session för allt utom
  `/login` och `/auth/*` (kodverifierat).
- `src/lib/supabase/client.ts` – klientsidans Supabase-klient (anon key).
- `src/lib/supabase/server.ts` – serversidans klient (Server
  Components/Actions, session från cookies).
- `src/lib/supabase/middleware.ts` – klienten `src/proxy.ts` använder
  för att uppdatera/verifiera sessionen på varje request.
- `src/lib/supabase/admin.ts` – **service-role-klient**, kringgår RLS
  helt. Får aldrig importeras i klientkod. Se
  [`docs/SECURITY.md`](SECURITY.md#9-service-role-och-servergräns).

**Health endpoint:** `src/app/api/health/route.ts` — se
[avsnitt 12](#12-health-drift-och-löpande-kontroller).

**E-post:** Resend, kopplat till Supabase Auth som Custom SMTP,
dokumenterad avsändardomän `mail.brfjlg.se`. Exakt aktuell
SMTP-konfiguration är ett manuellt kontrollkrav, se
[avsnitt 6](#6-tjänste--och-kontoregister) och
[avsnitt 17](#17-manuella-kontrollkrav).

## 4. Repositorium och Git-arbetsflöde

| Fält | Värde |
|---|---|
| Lokal sökväg (nuvarande ägares dator) | `C:\Users\rb\OneDrive\Dokument\ClaudeCode\Brf JLG\BrfJLG Fastighetsportal\webapp` |
| GitHub-organisation | `Brf-Jenny-Linds-Gata` |
| Repo | `brfjlg-fastighetsportal` (publikt — se README för varför) |
| Remote-URL | `https://github.com/Brf-Jenny-Linds-Gata/brfjlg-fastighetsportal.git` |
| Branch | `main` |
| Deploy | Vercel deployar automatiskt Production vid varje push till `main` |

**Regler för arbete i repot:**

- Verifiera alltid `HEAD`, `origin/main`, branch, remote och att
  arbetskopian är ren **innan** arbete påbörjas (kommandon i avsnitt 1).
- En push till `main` kan påverka Production direkt — se
  [avsnitt 10](#10-deployment-och-production-verifiering).
- Ingen commit eller push görs utan uttrycklig kontroll och separat
  godkännande.
- Dokumentationsbaslinjen ovan är datumstämplad — lita inte på den som
  "senaste sanningen" utan att verifiera på nytt.

## 5. Miljöer och viktiga URL:er

| Miljö | Detaljer | Status |
|---|---|---|
| Lokal utveckling | `npm install && npm run dev`, `http://localhost:3000`, kräver `webapp/.env.local` | Kodverifierat (README) |
| Production | Vercel, auto-deploy från `main` | Kodverifierat/Uppgivet |
| **Production-URL** | `https://brfjlg-fastighetsportal.vercel.app` | Uppgivet i överlämningsunderlaget |
| **Health endpoint** | `https://brfjlg-fastighetsportal.vercel.app/api/health` | Kodverifierat (route finns), URL uppgiven |
| Staging | Ingen separat stagingmiljö är verifierad i repot | Ej dokumenterat |
| Supabase Production-identitet | Projekt `BrfJLG Fastighetsportal`, project ref `mghmedkjxrbolhtllkba`, region `eu-west-2`, org `Brf Jenny Linds Gata` (org slug `gpvqtyaadtetzingvgwg`) | Uppgivet i överlämningsunderlaget |
| Vercel Production-identitet | Team `brf-jenny-linds-gata`, projekt `brfjlg-fastighetsportal` | Uppgivet i överlämningsunderlaget |

Tillåtna redirect-URL:er för magic link i Supabase Auth (kodverifierat
via README): `http://localhost:3000/auth/callback` och
`https://brfjlg-fastighetsportal.vercel.app/auth/callback`. Vid en ny
domän måste dessa uppdateras i Supabase Dashboard → Authentication →
URL Configuration.

## 6. Tjänste- och kontoregister

**Huvudregel:** `info@brfjlg.se` ska verifieras som aktivt inloggat
konto **före varje extern ändring** i någon av tjänsterna nedan. Anta
aldrig att rätt konto redan är inloggat.

**Använd aldrig** konton för Djupviks Jaktlag, för
bokförings-/fakturasystemet, eller andra privata/tekniska konton i det
här projektet.

| Tjänst | Användningsområde | Konto | Organisation/team | Projekt / Production-identitet | Konfiguration finns i | Verifiering före ändring | Status/källa |
|---|---|---|---|---|---|---|---|
| GitHub | Källkod, historik, PR:ar | `info@brfjlg.se` | `Brf-Jenny-Linds-Gata` | `brfjlg-fastighetsportal` | Repo-inställningar på GitHub | Rätt org + rätt repo | Uppgivet i överlämningsunderlaget |
| Vercel | Hosting/drift, auto-deploy från `main` | `info@brfjlg.se` | Team `brf-jenny-linds-gata` | Projekt `brfjlg-fastighetsportal` | Vercel Dashboard → Project Settings | Rätt team + rätt projekt + rätt branch | Uppgivet i överlämningsunderlaget |
| Supabase | Databas (Postgres), Auth, Storage | `info@brfjlg.se` | Org `Brf Jenny Linds Gata` (slug `gpvqtyaadtetzingvgwg`) | Projekt `BrfJLG Fastighetsportal`, ref `mghmedkjxrbolhtllkba`, region `eu-west-2` | Supabase Dashboard | Rätt org + rätt project ref | Uppgivet i överlämningsunderlaget |
| Resend | Skickar Supabase Auths inloggnings-/inbjudningsmejl (Custom SMTP) | `info@brfjlg.se` (att verifiera) | Manuellt kontrollkrav | Avsändardomän dokumenterad som `mail.brfjlg.se` | Resend Dashboard + Supabase Dashboard → Auth → SMTP | Verifiera `info@brfjlg.se` **innan** Resend-inloggning | Exakt konto/team/konfiguration: Manuellt kontrollkrav |
| DNS / brfnet | DNS-poster för `brfjlg.se` (bl.a. DKIM/SPF för Resend), nameservrar `ns3/ns4.brfnet.se` | `info@brfjlg.se` (att verifiera) | Manuellt kontrollkrav | — | brfnet-support/portal (utanför repot) | Verifiera `info@brfjlg.se` **innan** kontakt med brfnet | Exakt zon/poster/åtkomst: Manuellt kontrollkrav |
| Loopia AB | Domänregistrator för `brfjlg.se` (årsavgift, inte DNS-innehåll) | `info@brfjlg.se` (att verifiera) | Manuellt kontrollkrav | — | Loopia-konto (utanför repot) | Verifiera `info@brfjlg.se` **innan** Loopia-inloggning | Manuellt kontrollkrav |

Övriga tjänster som eventuellt används (t.ex. lösenordshanterare) är
**inte** verifierade i repot och tas därför inte med här — se
[avsnitt 17](#17-manuella-kontrollkrav).

## 7. Hemligheter och konfigurationsansvar

**Värden dokumenteras aldrig här eller i något annat repo-dokument.**
Endast variabelnamn/kategorier som kan beläggas från kod eller
exempelkonfiguration:

| Variabel | Kategori | Normalt förvarad i | Används av |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Publik konfiguration (ok att exponera) | `webapp/.env.local`, Vercel env vars | Klient + server (kodverifierat, README) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publik konfiguration, RLS avgör åtkomst (ok att exponera) | `webapp/.env.local`, Vercel env vars | Klient + server (kodverifierat, README) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Hemlighet – ska inte lagras i repot** | `webapp/.env.local` (lokalt), Vercel env vars (server-only, **inte** `NEXT_PUBLIC_`-prefixad) | `scripts/*.mjs` samt `src/lib/supabase/admin.ts` / `/api/admin/*` (kodverifierat) |

Ytterligare kategorier som **inte** ska dokumenteras med värde
någonstans i repot: SMTP-lösenord för Resend/Supabase, DNS-hemligheter
hos brfnet, lösenordshanterarens innehåll, JWT-värden,
session-/recovery-tokens.

- `test/security/rls-integration/.env.example` innehåller **endast
  variabelnamn och platshållare** (`TEST_PG_PASSWORD=`,
  `TEST_PG_PORT=55432`) — bekräftat vid granskning 2026-07-30, inga
  verkliga hemligheter. Filen gäller enbart den isolerade NUC-testmiljön,
  inte Production.
- Det finns **ingen `.env.example` i repo-roten** för huvudappen vid
  dokumentationstillfället — variabelnamnen ovan är istället
  dokumenterade i README och här.
- Riktiga `.env`/`.env.local`-filer ska **aldrig** läsas in i
  dokumentation eller committas (`.gitignore` täcker `.env*`).
- Service-role-klienten (`src/lib/supabase/admin.ts`) kringgår RLS
  helt — se särskilt skyddskrav i
  [`docs/SECURITY.md`](SECURITY.md#9-service-role-och-servergräns).

## 8. Databas och migrationer

- Migrationsfiler finns i `db/`, numrerade `001`–`010` i
  körordning (kodverifierat).
- **Ingen automatiserad migrationsrunner** är kopplad till projektet —
  filerna körs **manuellt** i Supabase → SQL Editor, i nummerordning
  (kodverifierat/uppgivet i README). Hitta inte på ett CI/CD-flöde för
  migrationer — det finns inte.
- Filerna är skrivna för att vara säkra att köra flera gånger där det
  går (idempotenta), men det är inte en garanti — läs varje fil innan
  körning.

**Migrationer på översiktsnivå** (fullständig tabell i README):

| Fil | Nivå |
|---|---|
| `001_init_schema.sql` | Grundschema + RLS + seed |
| `002_add_entreprenor_role.sql` | Roll `entreprenör` |
| `003_sba_resultat_update_policy.sql` | UPDATE-policy för SBA-checklistesvar |
| `004_grant_authenticated_privileges.sql` | Kritisk fix — grund-GRANT för `authenticated` |
| `005_sba_foton_storage_policies.sql` | Storage-policyer för `sba-foton` |
| `006_uh_poster_genomford.sql` | "Markera genomförd"-kolumner |
| `007_uh_andringslogg_insert_policy.sql` | Kritisk fix — INSERT-policy för ändringsloggens trigger |
| `008_grant_service_role_privileges.sql` | Kritisk fix — GRANT för `service_role` |
| `009_uh_andringslogg_fler_falt.sql` | Utökad ändringslogg |
| `010_require_profile_for_read_access.sql` | **Kritisk säkerhetsfix**, applicerad i Production 2026-07-30 — se `docs/SECURITY.md` |

**Production-migrationsprincip:**

1. Production-migrationer behandlas som en **separat gate** — aldrig i
   samma steg som annan dokumentations- eller kodändring.
2. SQL granskas **read-only** först (läs filen, förstå exakt vad den
   gör) innan den körs mot någon databas.
3. Konto (`info@brfjlg.se`), organisation, project ref
   (`mghmedkjxrbolhtllkba`) och miljö (Production vs. ev. testmiljö)
   verifieras **innan** SQL körs.
4. Efter en migration verifieras RLS-status och relevanta policyer
   (t.ex. via `pg_policies`, funktionsattribut) — inte bara att SQL:en
   kördes utan fel.
5. `db/010` är **redan applicerad och verifierad i Production
   2026-07-30** (Production-verifierat, se `docs/SECURITY.md`).

## 9. Autentisering, användare och roller

Sammanfattning — fullständig modell i
[`docs/SECURITY.md`](SECURITY.md#5-magic-link-flödet):

- Passwordless **magic link** via Supabase Auth. Ingen
  lösenordsinloggning finns idag.
- `signInWithOtp({ shouldCreateUser: false })` (kodverifierat) —
  förhindrar självregistrering.
- Supabase Auth Production-inställningar (Production-verifierat
  2026-07-30): "Allow new users to sign up" = OFF, "Confirm email" =
  ON, "Allow anonymous sign-ins" = OFF, "Allow manual linking" = OFF.
- **Endast styrelsen** initierar användarprovisionering, via `/admin`
  → `auth.admin.inviteUserByEmail` (service-role, skyddat av
  `requireStyrelse()`).
- En autentiserad `auth.users`-post räcker **inte** för läsåtkomst —
  användaren måste också ha en rad i `public.profiler`
  (`public.is_member()`, migration `010`).
- Fyra roller: `styrelse`, `brandskyddsansvarig`, `medlem`,
  `entreprenör` — se README:s [Behörigheter](../README.md#behörigheter)
  och `docs/SECURITY.md` för den fulla modellen.
- Önskad framtida ändring: e-post + lösenord i stället för magic link
  — **inte implementerat**, se `docs/SECURITY.md` (S5).

## 10. Deployment och Production-verifiering

Den praktiska kedjan för en ändring som ska nå Production:

1. Verifiera rätt konto (`info@brfjlg.se`) och rätt projekt i
   GitHub/Vercel/Supabase.
2. Verifiera Git-baslinjen (avsnitt 1/4 ovan).
3. Genomför en **avgränsad** ändring.
4. Kör relevanta lokala kontroller (`npm run lint`, ev. `npm run build`
   lokalt — se [avsnitt 11](#11-test-och-verifiering) för vilka
   `package.json`-script som faktiskt finns).
5. Granska diffen (`git diff`) innan något stageas.
6. **Commit endast efter godkännande.**
7. **Push endast efter separat godkännande** — push till `main` kan
   trigga en Production-deploy direkt.
8. Verifiera att Vercel bygger **rätt commit** (jämför commit-hash i
   Vercel Dashboard mot `git rev-parse HEAD`).
9. Verifiera deployment-status i Vercel Dashboard (Ready/Error).
10. Kontrollera Production-URL:
    `https://brfjlg-fastighetsportal.vercel.app`.
11. Kontrollera `/api/health` (se avsnitt 12).
12. Utför relevant **funktionell** kontroll manuellt (t.ex. inloggning,
    att data laddar) — ett grönt health-svar räcker inte ensamt, se
    avsnitt 12.
13. Verifiera Git-status och synk med `origin/main` igen efter push.

**En push till `main` kan påverka Production direkt** — det finns
ingen dokumenterad manuell godkännandegrind i Vercel mellan push och
Production-deploy. Behandla varje push till `main` därefter.

## 11. Test och verifiering

**Faktiska `package.json`-script** (kodverifierat — hitta inte på fler):

| Script | Kommando | Vad det gör |
|---|---|---|
| `npm run dev` | `next dev` | Lokal utvecklingsserver |
| `npm run build` | `next build` | Produktionsbygge |
| `npm run start` | `next start` | Kör produktionsbygget lokalt |
| `npm run lint` | `eslint` | Statisk kodanalys |

Det finns **inget `test`-script** och ingen automatiserad
enhetstest-/integrationstestsvit för applikationskoden i `package.json`
vid dokumentationstillfället.

**RLS-integrationstest** (separat, isolerad testmiljö):

- Plats: [`test/security/rls-integration/README.md`](../test/security/rls-integration/README.md)
  och [`RESULTS_2026-07-30.md`](../test/security/rls-integration/RESULTS_2026-07-30.md)
- Resultat: **44 PASS / 0 FAIL** (2026-07-30, körd isolerat på NUC,
  helt separat från Production och från Djupviks miljö)
- **Vad testet bevisar:** migration 010:s SQL-syntax, RLS-recursion-frihet
  i `public.is_member()`-mönstret, `auth.uid()`-baserad policylogik mot
  en riktig Postgres 17-instans, samt `service_role`-bypass
  (`rolbypassrls`).
- **Vad testet uttryckligen inte bevisar:** verklig GoTrue-JWT-utfärdning,
  PostgREST-access, ett fullständigt Storage API-anrop (tabellen
  `storage.objects` saknades i testavbildningen — testmål 6 blev
  **SKIPPED**, inte falskt PASS), eller `inviteUserByEmail`/inloggning
  mot Production med "signup OFF".
- Se `docs/SECURITY.md`, avsnitt 12–13 för säkerhetstolkningen och de
  kvarstående spåren.

**Production-test-princip:** eventuella framtida tester mot Production
ska vara **kontrollerade** och får **inte** ändra verklig data utan en
uttrycklig, separat gate.

## 12. Health, drift och löpande kontroller

För **frekvenser och praktiska checklistor** (efter varje push,
veckovis, månadsvis, kvartalsvis, årligen) se
[`docs/OPERATIONS.md`](OPERATIONS.md) — det här avsnittet beskriver
bara principerna och verktygen.

- **Health endpoint:** `GET /api/health` (`src/app/api/health/route.ts`,
  kodverifierat) — kör en head-fråga mot tabellen `fastigheter`,
  `select("id", { head: true }).limit(1)`, via service-role-klienten,
  för att verifiera att servern kan nå databasen utan att hämta
  radata. Svarar `{ ok: true }` (200) eller `{ ok: false }` (503,
  `Cache-Control: no-store`).
- **Vad det faktiskt kontrollerar:** att Vercel-funktionen kan nå
  Supabase-databasen och köra en enkel fråga. **Det bevisar inte** att
  auth, Storage, RLS-policyer eller något specifikt användarflöde
  fungerar — ett grönt svar är en nödvändig, inte tillräcklig,
  förutsättning för att appen fungerar.
- **Rekommenderade read-only-driftkontroller** efter en deploy:
  - `curl -i https://brfjlg-fastighetsportal.vercel.app/api/health`
  - Manuell inloggning med en avsedd befintlig användare
  - Kontroll att `/login` svarar utan HTTP 405 (relevant efter
    logout-fixet 2026-07-30, se `docs/CHANGELOG.md`)
  - Stickprov på att portaldata laddar för minst en roll
- **Beroendeuppdateringar:** README dokumenterar (senast kontrollerat
  2026-07-04, uppgivet) att **Dependabot alerts och security updates
  redan är aktiverade** på GitHub-repot, och att `npm outdated`/`npm
  audit` bör köras med jämna mellanrum för manuell uppföljning.
- **Backup:** se avsnitt 13 nedan.

## 13. Backup och återställning

- `scripts/backup-db.mjs` (kodverifierat) dumpar samtliga tabeller
  (utom `auth.users` självt) till en tidsstämplad JSON-fil i
  `scripts/backups/` (gitignorat — innehåller persondata).
- **Syfte:** en snabb säkerhetsknapp innan man experimenterar direkt i
  Production-databasen — **inte** en ersättning för en riktig
  backuplösning.
- **Krävs för att använda det:** `SUPABASE_SERVICE_ROLE_KEY` i
  `.env.local` (körs med `node --env-file=.env.local
  scripts/backup-db.mjs`). Hemligheten dokumenteras aldrig här — se
  avsnitt 7.
- README uppger (senast kontrollerat 2026-07-04) att Supabase
  **Free-plan inte inkluderar några automatiska backuper alls**, och
  att detta script därför var **den enda backupen som fanns** vid det
  tillfället.
- **Manuellt kontrollkrav:** aktuell Supabase-plan och faktisk
  automatisk backupstatus ska verifieras på nytt i Supabase Dashboard
  → Database → Backups innan man litar på den uppgiften.
- **En backup ska inte antas fungera** förrän en faktisk återläsning
  eller annan verifiering av innehållet har genomförts och
  dokumenterats — ingen sådan återläsning är dokumenterad i repot vid
  dokumentationstillfället.

## 14. Rollbackprinciper

### Kod / Vercel

1. Stoppa ytterligare ändringar mot `main`.
2. Identifiera senast **kända fungerande** commit och motsvarande
   Vercel-deployment (jämför `git log` mot Vercel Dashboards
   deploy-historik).
3. Verifiera rätt Vercel-konto, team (`brf-jenny-linds-gata`) och
   projekt (`brfjlg-fastighetsportal`) innan någon åtgärd.
4. Använd antingen `git revert` (ny commit som upphäver ändringen,
   följer den normala push-processen i avsnitt 10) eller en verifierad
   Vercel-rollback-funktion till en tidigare deployment — **exakt vilken
   rollback-funktionalitet som är tillgänglig i det aktuella
   Vercel-teamet/planen är ett manuellt kontrollkrav**, inte verifierat
   från repot.
5. Gör **ingen force push**.
6. Dokumentera incidenten (se avsnitt 15 och `docs/CHANGELOG.md`).
7. Verifiera Production efter rollback (samma steg som avsnitt 10,
   punkt 8–12).

### Databas

- Databasmigrationer i `db/` är **inte automatiskt reversibla** — det
  finns ingen "down"-migration eller migrationsrunner.
- Kör **aldrig** improviserad motsatt SQL i panik.
- Vid ett misstänkt databasproblem: stoppa vidare skrivningar/deploy
  om rimligt, analysera migrationen och dess dataeffekt **read-only**
  först.
- Verifiera att en användbar backup faktiskt finns (se avsnitt 13)
  innan någon återställningsåtgärd övervägs.
- Ta fram en **separat, granskad** återställningsplan — improvisera
  inte under tidspress.
- Kör **ingen Production-SQL** utan en ny, uttrycklig gate.

## 15. Incidenthantering

Praktisk checklista vid ett upptäckt problem:

1. **Avgränsa** problemet (vilken funktion, vilka användare, sedan när).
2. **Stoppa** pågående deploy eller vidare ändringar mot `main` om
   rimligt.
3. **Dokumentera** tidpunkt, senaste commit, senaste deployment och det
   observerade felet ordagrant.
4. **Verifiera rätt konton** (`info@brfjlg.se`) innan du loggar in
   någonstans för att undersöka.
5. Kontrollera **Vercel** (deployment-status, function-loggar),
   **Supabase** (Dashboard-status, loggar) och `/api/health`.
6. Avgör om felet gäller **kod, auth, databas, Storage, e-post eller
   DNS** — det styr vilken tjänst som ska undersökas vidare.
7. Genomför **endast godkända** åtgärder — ingen improviserad
   Production-ändring under press.
8. Verifiera att återställningen faktiskt fungerar (funktionell
   kontroll, inte bara "deploy lyckades").
9. Dokumentera incidenten och lärdomarna i `docs/CHANGELOG.md`.

**Incidentkontakt och eskaleringsansvar: Ej dokumenterat** — ska
kompletteras manuellt av en ny tekniskt ansvarig. Ingen sådan kontakt
ska dokumenteras med personliga uppgifter utan styrelsens uttryckliga
beslut om vad som får stå i ett publikt repo (repot är publikt, se
README).

## 16. Checklista för övertagande

Ingen hemlighet ska någonsin skrivas in i denna checklista eller dess
resultat. Se även [`docs/OPERATIONS.md`](OPERATIONS.md) för den
löpande driftkalendern efter att övertagandet är klart.

- [ ] Få åtkomst till inkorgen `info@brfjlg.se`
- [ ] Verifiera MFA och recovery-hantering för `info@brfjlg.se` **utan**
      att dokumentera koder eller recovery-nycklar någonstans i repot
- [ ] Verifiera åtkomst till GitHub-organisationen `Brf-Jenny-Linds-Gata`
      och repot `brfjlg-fastighetsportal`
- [ ] Verifiera åtkomst till Vercel-teamet `brf-jenny-linds-gata` och
      projektet `brfjlg-fastighetsportal`
- [ ] Verifiera åtkomst till Supabase-organisationen `Brf Jenny Linds
      Gata` och projektet `BrfJLG Fastighetsportal` (ref
      `mghmedkjxrbolhtllkba`)
- [ ] Verifiera Resend-konto och Supabase Auth SMTP-konfiguration
- [ ] Verifiera DNS/brfnet-åtkomst och aktuella poster för `brfjlg.se`
- [ ] Verifiera fakturering och plan för respektive tjänst (Loopia,
      Vercel, Supabase, Resend)
- [ ] Verifiera vilka Production-domäner som faktiskt är aktiva
- [ ] Verifiera miljövariabelnamn (avsnitt 7) och vem som ansvarar för
      respektive värde
- [ ] Verifiera backupstatus och att en faktisk återställning kan
      genomföras (avsnitt 13)
- [ ] Klona/öppna repot från rätt GitHub-URL
- [ ] Verifiera lokal utvecklingsmiljö (`npm install`, `.env.local`,
      `npm run dev`)
- [ ] Läs `README.md`, `docs/HANDOVER.md`, `docs/SECURITY.md` och
      `docs/CHANGELOG.md` i sin helhet
- [ ] Kör read-only-baslinjekontroll (avsnitt 1/4)
- [ ] Dokumentera (utanför repot, eller i en styrelsebeslutad kanal)
      ägare, incidentkontakt och vilken lösenordshanterare som används

## 17. Manuella kontrollkrav

| Uppgift | Tjänst/plats | Konto som verifieras först | Får dokumenteras i repot | Måste hållas hemligt | Status |
|---|---|---|---|---|---|
| Exakt Resend-konto/team | Resend Dashboard | `info@brfjlg.se` | Kontots existens/roll | Lösenord, API-nycklar | Manuellt kontrollkrav |
| Verifierad Resend-domänkonfiguration | Resend Dashboard | `info@brfjlg.se` | Domännamn (`mail.brfjlg.se`) | DKIM/SPF-privata värden om sådana visas | Manuellt kontrollkrav |
| Supabase SMTP-inställningar | Supabase Dashboard → Auth → SMTP | `info@brfjlg.se` | Att Custom SMTP används | SMTP-lösenord | Manuellt kontrollkrav |
| Var SMTP-hemligheten förvaltas | Lösenordshanterare (ospecificerad) | — | Namnet på posten i lösenordshanteraren | Själva lösenordet | Ej dokumenterat |
| DNS-zon/poster hos brfnet | brfnet-portal/support | `info@brfjlg.se` | Att brfnet hanterar DNS, nameservrar | Ev. administrativa access-koder | Manuellt kontrollkrav |
| Brfnet-administratörer | brfnet | `info@brfjlg.se` | Roll/funktion, inte personuppgifter utan beslut | — | Ej dokumenterat |
| Ägare av `info@brfjlg.se` | E-postleverantören för brfjlg.se | — | Att adressen är föreningens gemensamma | — | Manuellt kontrollkrav |
| GitHub-organisationsmedlemmar | GitHub org → People | `info@brfjlg.se` | Roller (inte nödvändigtvis namnlista) | — | Manuellt kontrollkrav |
| Vercel-teammedlemmar | Vercel Dashboard → Team | `info@brfjlg.se` | Roller | — | Manuellt kontrollkrav |
| Supabase-organisationsmedlemmar | Supabase Dashboard → Org members | `info@brfjlg.se` | Roller | — | Manuellt kontrollkrav |
| Faktureringsägare/planer | Respektive dashboard | `info@brfjlg.se` | Vilken plan (t.ex. "Free"/"Pro") | Betalkortsuppgifter | Manuellt kontrollkrav |
| Backupstatus (faktisk, aktuell) | Supabase Dashboard → Database → Backups | `info@brfjlg.se` | Status ("finns"/"finns inte") | — | Manuellt kontrollkrav (senast uppgivet 2026-07-04: Free-plan, ingen automatisk backup) |
| Incidentkontakt | Ej dokumenterat | — | Roll/funktion efter styrelsebeslut | Privata kontaktuppgifter utan beslut | Ej dokumenterat |
| Domänförnyelse (Loopia) | Loopia-konto | `info@brfjlg.se` | Att årsavgift krävs | Betaluppgifter | Manuellt kontrollkrav |
| Lösenordshanterare | Ospecificerad | — | Vilken produkt används (om beslutat) | Huvudlösenord/recovery | Ej dokumenterat |
| MFA-status på tjänstekonton | Respektive dashboard | `info@brfjlg.se` | Att MFA är på/av | Recovery-koder | Manuellt kontrollkrav |
| Production-miljövariabelnamn och ansvar | Vercel Dashboard → Env Vars | `info@brfjlg.se` | Variabelnamn (se avsnitt 7) | Värden | Namn: kan dokumenteras. Värden: Hemlighet – ska inte lagras i repot |
| Custom domains | Vercel Dashboard → Domains | `info@brfjlg.se` | Om/vilka domäner är aktiva | — | Uppgivet: ingen custom domain enligt README vid dokumentationstillfället |
| Vercel-GitHub-integration / Production branch | Vercel Dashboard → Git | `info@brfjlg.se` | Att `main` är Production branch | — | Uppgivet i README, ej dashboard-verifierat härifrån |
| Supabase-plan och pausningsrisk | Supabase Dashboard → Billing | `info@brfjlg.se` | Planens namn | — | Uppgivet: Free-plan senast kontrollerad 2026-07-04 |

## 18. Kända risker och öppna utvecklingsspår

Fullständig beskrivning i [`docs/SECURITY.md`](SECURITY.md#13-kvarstående-säkerhetsspår).
Sammanfattat:

- **S1 — `sba_anmarkningar`-kolumnintegritet:** entreprenörens
  UPDATE-policy kan via direkt API tillåta fler kolumnändringar än
  avsett. Kräver separat read-only-analys och egen gate.
- **S2 — `inviteUserByEmail` med signup OFF:** behöver verifieras med
  en verklig avsedd användare eller en separat kontrollerad testplan.
- **S3 — Storage API end-to-end:** policyn är verifierad via
  databasmetadata, men inget komplett autentiserat API-test är
  genomfört.
- **S4 — PostgREST end-to-end:** bör verifieras separat med
  autentiserade roller, utan Production-påverkan.
- **S5 — Framtida e-post/lösenordsinloggning:** önskad framtida
  ändring, inte implementerad eller i detalj beslutad.

## 19. Dokumentunderhåll

- **Senast verifierat:** 2026-07-30
- **Mot commit:** `545ac9289d30b1935596cea165961d8c9ae817ac`
- Dokumentet ska uppdateras när något av följande ändras: tjänster,
  konton, autentisering, RLS-policyer, deployment-processen, eller
  löpande driftrutiner.
- Gamla fakta ska **datumstämplas eller tas bort** när de blir
  inaktuella — lämna dem aldrig kvar odaterade som om de vore aktuell
  sanning.
