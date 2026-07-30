# BRF JLG — isolerad RLS-integrationstest (Fix Gate 3A)

## Verifierat NUC-resultat 2026-07-30

Testet är kört, en gång, i den isolerade miljön `/opt/docker/dev/brfjlg-security-test`
på NUC (`homelab`), helt separat från Djupviks lokala Supabase och Production.

- **Image:** `ghcr.io/supabase/postgres:17.6.1.157`
- **Resultat:** 44 PASS, 0 FAIL
- public-schema/RLS verifierat: migration 010:s public-schema-del applicerades utan syntaxfel
- ingen RLS-recursion uppstod (`styrelse -> profiler` gav `2`, inte ett recursion-fel)
- profillös `authenticated` blockerad från samtliga 10 `public`-tabeller (0 rader)
- `entreprenör` och `styrelse` behöll avsedd läsåtkomst (gemensam läsning bevarad)
- `anon` blockerad överallt
- `service_role` bypass verifierad (`rolbypassrls`)
- `storage.objects` saknades i denna Postgres-only-avbildning → Storage-testet (mål 6) blev **SKIPPED**, inte falskt PASS eller FAIL
- **Detta är inte ett GoTrue/PostgREST/Storage API end-to-end-test** — se "Vad detta test faktiskt bevisar — och inte" nedan

Testcontainern stoppades efter körningen. Inget engångslösenord eller annan
hemlighet från körningen återges här eller någon annanstans i repot.

### Runtime-anpassningar som krävdes (nu inbyggda i testpaketet, inte manuella)

Körningen avslöjade tre fel i testpaketet självt, samtliga korrigerade i koden
(Fix Gate 3C) i stället för att bara noteras här:

1. `auth.users` i den verifierade avbildningen saknar kolumnen `email_confirmed_at`
   — rätt kolumnnamn är **`confirmed_at`**. Rättat i `setup_test_identities.sql`.
2. Boolesk text-cast (`::text` på en `boolean`) gav **`true`**, inte `t`, i denna
   miljö. `run_probe.sh` och `run_migrations.sh` accepterar nu båda formaten
   konsekvent överallt de förekommer.
3. `run_migrations.sh`s sökvägsdetektering för `db/` var hårdkodad för
   repo-layouten (tre nivåer upp) och fungerade inte i en plattkopierad
   NUC-katalog. Ersatt med en detektering som EXAKT provar de två kända
   layouterna (bredvid scriptet, eller tre nivåer upp) och stoppar med tydligt
   fel om ingen av dem matchar — aldrig en generisk uppåtsökning som skulle
   kunna hitta en oavsiktlig `db/`-katalog längre upp (t.ex. Djupviks).

Testar `db/010_require_profile_for_read_access.sql` + befintlig RLS i `db/001`–`009`
mot en **helt isolerad, engångs**-Postgres-container på NUC. Ingen Production-anslutning,
ingen Djupvik-påverkan, inga riktiga magic links/invites (identiteter simuleras direkt
via SQL + `set_config('request.jwt.claims', ...)`, enligt Supabases egen dokumenterade
metod för RLS-testning utanför GoTrue/PostgREST).

**Inget i denna katalog har körts än.** Allt nedan är instruktioner för dig att köra
på NUC efter en ny, uttrycklig gate — inte något som redan gjorts av Claude.

## Isoleringsgarantier

- Eget compose-projektnamn (`name: brfjlg-security-test` i `docker-compose.yml`) →
  egen Docker-nätverksnamnrymd, kolliderar inte med Djupviks compose-projekt.
- Egen namngiven volym `brfjlg_sectest_pgdata`, skapas av detta projekt — inte en
  delad eller extern volym, inte Djupviks volym.
- Egen container, `brfjlg_sectest_pg` — namnet är unikt och tydligt prefixat.
- Icke-standardport (default `55432` i `.env.example`), **bunden explicit till
  `127.0.0.1`** i `docker-compose.yml` — inte alla nätverksinterface. Varken
  Postgres standard `5432` eller Supabase lokala standard `54322`.
- Resursgränser satta (`mem_limit: 1g`, `cpus: 1.0`) — begränsar avtryck på en
  delad 8 GB-NUC.
- Engångslösenord du själv sätter i en lokal `.env` (aldrig committad, aldrig
  relaterad till någon riktig databas).
- Ingen `supabase link`, ingen `supabase/`-katalogstruktur skapas — matchar hur
  huvudrepot redan hanterar SQL (raw filer, inte CLI-migrationer).
- **`safety_guard.sh`** källas av både `run_migrations.sh` och `run_probe.sh`
  innan de rör containern — kodnivå-spärrar (inte bara denna README) som vägrar
  köra om: scriptets katalog inte innehåller `brfjlg-security-test`, skalets
  miljövariabler innehåller kända Production-/Djupvik-identifierare
  (`mghmedkjxrbolhtllkba`, `biindekdacqeouqfbzmr`, motsvarande org-slugs, eller
  `supabase.co`), containern kör fel avbildning, fel compose-projekt, eller är
  portpublicerad på annat än `127.0.0.1`.
- **`destroy.sh`** — enda avsedda sättet att montera ned miljön; visar exakt vad
  som kommer tas bort, kräver skriven bekräftelse, rör aldrig annat än detta
  projekts container/volym/nätverk (se avsnittet Nedstängning nedan).

## Pre-flight-kontroller (kör själv på NUC INNAN uppstart)

```bash
# Bekräfta att porten är ledig
ss -tlnp | grep 55432 || echo "port 55432 ledig"

# Bekräfta att namnen inte redan finns (skulle indikera kollision)
docker ps -a --format '{{.Names}}' | grep -i brfjlg_sectest || echo "inget container-namn krockar"
docker volume ls --format '{{.Name}}' | grep -i brfjlg_sectest || echo "ingen volym krockar"
docker network ls --format '{{.Name}}' | grep -i brfjlg-security-test || echo "inget nätverk krockar"

# Bekräfta att Djupviks miljö inte påverkas — lista dess containrar för jämförelse,
# rör dem INTE:
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}'
```

Om något av ovanstående visar en kollision: stanna och lös namnkonflikten innan du
går vidare (byt t.ex. `TEST_PG_PORT` i `.env`).

## Körordning (kör själv på NUC, efter godkänd gate)

```bash
# 1. Kopiera denna katalog till NUC, t.ex.:
#    /opt/docker/dev/brfjlg-security-test
cd /opt/docker/dev/brfjlg-security-test

# 2. Skapa .env från mallen och sätt ett engångslösenord
cp .env.example .env
# redigera .env: TEST_PG_PASSWORD=<valfritt starkt lösenord>

# 3. Starta ENDAST denna isolerade container
docker compose up -d

# 4. Vänta tills den är frisk
docker compose ps
# STATUS ska visa "healthy" (healthcheck i docker-compose.yml)

# 5. Applicera db/001-010 + testidentiteter
chmod +x run_migrations.sh run_probe.sh destroy.sh safety_guard.sh
./run_migrations.sh

# 6. Kör samtliga RLS-prober (mål 2-6)
./run_probe.sh
```

`run_probe.sh` avslutas med exit code 0 om alla prober är PASS, annars exit code 1
med en lista över vilka fall som misslyckades.

## Vad testas — och vad respektive resultat betyder

| Identitet | Förväntat på de 10 tabellerna + sba-foton | Betydelse om det INTE stämmer |
|---|---|---|
| `anon` | `ERROR: permission denied` | GRANT-lagret (`db/004`) saknar/gav av misstag rättigheter till anon |
| Profillös `authenticated` (cccccccc, ingen `profiler`-rad) | `0` rader, INGET fel | RLS-fixen (`db/010`) fungerar inte — huvudmålet för hela Fix Gate-spåret |
| `entreprenör` (bbbbbbbb) | Inget fel; `profiler` ger exakt `2` (ser båda testidentiteterna — bevisar "gemensam läsning" bevarad) | Antingen för snäv (bruten legitim åtkomst) eller för bred (kvarstående läckage) |
| `styrelse` (aaaaaaaa) | Inget fel; `profiler` ger exakt `2` — detta är också den explicita **recursion-kontrollen**: om `public.is_member()`-mönstret hade en rekursionsbugg skulle just detta anrop ge `ERROR: infinite recursion detected in policy for relation "profiler"` istället för `2` | Recursion-buggen beskriven i Fix Gate 1 har smugit sig in |
| `service_role` | Inget fel, `profiler` ger `2` trots att service_role inte har någon egen `auth.uid()`/profil — bevisar RLS-bypass är intakt; `rolbypassrls` ska vara `t` | Admin-API:erna (`src/lib/supabase/admin.ts`) skulle sluta fungera i Production |

**Viktig tolkningsskillnad:** ett `ERROR: permission denied for table X` betyder att
GRANT-lagret blockerar (rätt för `anon`, fel för alla andra). Ett resultat på `0`
rader utan fel betyder att RLS filtrerar bort raderna (rätt för profillös
`authenticated`). Dessa är två olika mekanismer — skriptet skiljer redan på dem,
men var uppmärksam om du läser rå psql-output manuellt.

## Vad detta test faktiskt bevisar — och inte

Uppdaterat efter Fix Gate 3B-granskningen, grundat på direkt läsning av källkoden
i `github.com/supabase/postgres` (init-scripts som körs av avbildningen):

| Egenskap | Status |
|---|---|
| SQL-syntax för migration 010 | **Bevisas fullt** — `run_migrations.sh` kör den faktiska filen mot en riktig Postgres 17-instans |
| RLS-recursion (`public.is_member()`-mönstret) | **Bevisas fullt** — `auth.users`-tabellen och `auth.uid()`/`auth.role()` är verifierat närvarande i avbildningens egna init-scripts, oberoende av GoTrue |
| `auth.uid()`-baserad policylogik | **Bevisas fullt**, med en viktig rättelse: den verkliga funktionen läser `current_setting('request.jwt.claim.sub', true)` (punktseparerad nyckel), INTE en JSON-blob under `request.jwt.claims` som tidigare antogs — `run_probe.sh` sätter nu båda konventionerna defensivt |
| Verklig användar-JWT | **Bevisas inte** — inga riktiga JWT:er utfärdas eller verifieras (medvetet, för att undvika GoTrue/riktiga inloggningar) |
| PostgREST-access | **Bevisas inte** — ingen PostgREST körs; testet går direkt mot Postgres via `SET ROLE`, inte via ett REST-anrop |
| Storage API-access | **Bevisas inte** — se nedan, `storage.objects`-existens är dessutom osäker i denna avbildning |
| GoTrue/signup | **Bevisas inte** — redan flaggat i Fix Gate 2 som kvarstående extern verifiering |
| service-role-bypass | **Bevisas fullt** — `rolbypassrls`-attributet kontrolleras direkt, verifierat mot samma källa (`create role service_role ... bypassrls`) |

**Detta är ett SQL/RLS-test med simulerade claims mot en isolerad Postgres-instans
— INTE ett fullständigt end-to-end Supabase-test.** Det bevisar att RLS-lagret i
sig (policyer, `is_member()`, recursion-frihet) fungerar korrekt givet en JWT med
ett visst `sub`/`role`. Det bevisar inte att GoTrue faktiskt utfärdar en sådan JWT
korrekt, eller att PostgREST/Storage API exponerar exakt detta beteende — de
frågorna kvarstår som separat extern verifiering (se Fix Gate 2-rapporten och
avsnittet nedan).

### Storage — `storage.objects`, inte "Storage API"

Detta test är, om det körs, ett **`storage.objects` RLS-test** — det skickar SQL
direkt mot tabellen, inte ett anrop mot Supabase Storage REST-API:et. Bekräftat
på NUC 2026-07-30: `storage.objects` finns INTE i
`ghcr.io/supabase/postgres:17.6.1.157` utan att Storage-API-tjänsten kört sina
egna migrationer (som inte startas i denna Postgres-only-miljö).

**Automatisk, reproducerbar fallback (inga manuella filer eller handpatchar
kvar från NUC-sessionen)** — `run_migrations.sh` kontrollerar
`to_regclass('storage.objects')` en gång, innan huvudloopen:

- **Om `storage.objects` finns:** hela `db/005` och hela `db/010` (inklusive
  storage-policyn) appliceras oförändrade, precis som mot Production.
- **Om `storage.objects` saknas:** `db/005` hoppas över helt (loggat tydligt,
  inte tyst). För `db/010` genereras en public-schema-only-variant
  **automatiskt, vid körningstillfället, från den riktiga Production-filen** —
  scriptet klipper filen vid dess egen markörrad
  (`-- ---------- Storage: sba-foton ----------`) och applicerar bara det som
  kommer före. Ingen handhållen kopia av `db/010` existerar någonstans i
  repot — filen som faktiskt appliceras skapas i en temp-fil och raderas
  direkt efteråt. Om markörraden någonsin flyttas/ändras i den riktiga
  `db/010` utan att testpaketet uppdateras, stoppar scriptet med ett tydligt
  fel istället för att klippa fel.
- **Production-filen `db/010_require_profile_for_read_access.sql` är och
  förblir oförändrad** — den innehåller fortfarande den fullständiga, avsedda
  fixen inklusive storage-policyn. Endast testpaketets egen körning mot en
  ofullständig lokal miljö anpassar sig, aldrig den verkliga migrationen.
- `run_probe.sh` gör motsvarande existenskontroll separat innan mål 6:s
  prober körs, och hoppar tydligt över dem (`SKIPPED`) om tabellen saknas —
  aldrig ett tyst eller felaktigt PASS.

## Kända öppna punkter att verifiera vid faktisk körning

Dessa kunde INTE bekräftas utan att faktiskt köra containern (vilket inte gjorts i
denna gate) — flaggas explicit istället för att gissas bort:

1. **`auth.users`-kolumnschemat** i `setup_test_identities.sql` bygger på det
   verifierade mönstret från `github.com/supabase/postgres` (20 kolumner, bl.a.
   `instance_id, id, aud, role, email, encrypted_password, ...`), men exakt
   kolumnlista kan ändå skilja sig i den specifika taggen som används. Om
   INSERT:en misslyckas: kör `\d auth.users` i containern och justera.
2. **`storage.objects`-existens/kolumnschema** — se ovan; hanteras nu med en
   explicit runtime-kontroll snarare än ett antagande.
3. **Bildtaggen** `ghcr.io/supabase/postgres:17.6.1.157` är den senast tillgängliga
   17.x-taggen vid tidpunkten för denna gate (Production kör `17.6.1.141` enligt
   tidigare verifierad projektmetadata) — nära men inte identisk patch-version.
   Bedöms fullt tillräckligt för RLS-/policy-/funktionsbeteende, men notera
   skillnaden om något oväntat inträffar.
4. Detta test täcker **inte** punkterna som redan flaggades som kvarstående extern
   verifiering i Fix Gate 2 (`inviteUserByEmail` + befintlig-användare-login med
   "Allow new users to sign up" = OFF) — de kräver GoTrue/Auth-lagret, som
   medvetet inte startas här (ingen risk för riktiga mejl/invites).

## Nedstängning och städning (efter avslutat test)

Använd **endast** `destroy.sh` — inte manuella Docker-kommandon:

```bash
./destroy.sh
```

Scriptet visar exakt vad som kommer tas bort (compose-projekt, volym, nätverk),
kräver att du skriver `RADERA brfjlg-security-test` för att bekräfta, och rör
aldrig något utanför detta projekts namngivna resurser. Ingen
`docker system prune`, ingen wildcard, ingen `rm -rf`. Detta rör **aldrig**
Djupviks volymer/nätverk/containrar eftersom alla namn i denna katalog är unikt
prefixade (`brfjlg_sectest_*` / `brfjlg-security-test`).
