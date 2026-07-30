# Drift och löpande underhåll – BRF JLG Fastighetsportal

## 1. Syfte

Det här dokumentet är den **praktiska driftkalendern** — vad som ska
kontrolleras, när, var, med vilket konto, och vad som händer när något
avviker. Det är avsiktligt **inte** en upprepning av
[`docs/HANDOVER.md`](HANDOVER.md), som beskriver hur systemet hänger
ihop och hur det tas över. HANDOVER förklarar principer; det här
dokumentet ger frekvenser och praktiska checklistor.

**Målgrupp:** teknisk driftansvarig och styrelsens systemansvariga.

**Grundprincip:** varje kontroll nedan ska vara **reproducerbar** (går
att köra likadant nästa gång) och **dokumenterad** (se
[avsnitt 14, Driftjournal](#14-driftjournal)).

**Viktigt om frekvenser:** alla intervall i det här dokumentet (efter
push, veckovis, månadsvis, kvartalsvis, årligen) är **rekommendationer**
tills styrelsen formellt beslutat ansvarig person och faktiskt
intervall utifrån verklig belastning. Se
[avsnitt 17, Öppna driftbeslut](#17-öppna-driftbeslut).

**Relaterade dokument:**

- [`../README.md`](../README.md) – lättläst systemöversikt
- [`HANDOVER.md`](HANDOVER.md) – teknisk överlämning, arkitektur, tjänste-/kontoregister
- [`SECURITY.md`](SECURITY.md) – säkerhetsmodell, roller, RLS, kvarstående säkerhetsspår
- [`CHANGELOG.md`](CHANGELOG.md) – historiska säkerhets- och driftförändringar

## 2. Grundregler för all drift

- **Verifiera alltid rätt konto** före en extern kontroll eller
  ändring. Rätt huvudkonto för det här projektet är `info@brfjlg.se`.
  Anta aldrig att rätt konto redan är inloggat.
- Verifiera **organisation, team, projekt och miljö** (Production vs.
  ev. testmiljö) innan du agerar i en extern tjänst.
- **Använd aldrig** konton för Djupviks Jaktlag, för
  bokförings-/fakturasystemet, eller andra privata/tekniska konton i
  det här projektet.
- **Skilj tydligt mellan read-only kontroll och ändring.** De flesta
  punkterna i det här dokumentet är avsedda att vara read-only.
- **Ingen Production-ändring utan en separat, uttrycklig gate** — en
  rutinkontroll ska aldrig glida över i en ändring.
- **Ingen SQL, Auth-, RLS-, Storage-, env-, Resend- eller DNS-ändring**
  som en del av en vanlig driftkontroll.
- **Dokumentera avvikelser innan åtgärd** — se
  [avsnitt 13](#13-incident--och-avvikelsehantering) och
  [avsnitt 14](#14-driftjournal).
- **Skriv aldrig hemligheter** i driftjournalen eller något annat
  dokument (lösenord, nycklar, tokens, JWT:er, connection strings).

## 3. System och kontrollpunkter

| Tjänst | Konto | Organisation/team/projekt | Kontrollplats | Normal kontroll |
|---|---|---|---|---|
| GitHub | `info@brfjlg.se` | Org `Brf-Jenny-Linds-Gata`, repo `brfjlg-fastighetsportal` | GitHub Dashboard/repo | Branch, Dependabot, Security Alerts, åtkomst |
| Vercel | `info@brfjlg.se` | Team `brf-jenny-linds-gata`, projekt `brfjlg-fastighetsportal` | Vercel Dashboard | Deployments, build-status, domäner, teammedlemmar |
| Supabase | `info@brfjlg.se` | Org `Brf Jenny Linds Gata`, project ref `mghmedkjxrbolhtllkba`, region `eu-west-2` | Supabase Dashboard | Projektstatus, Auth, databas, Storage, backups |
| Resend | `info@brfjlg.se` (att verifiera — se Manuellt kontrollkrav) | Manuellt kontrollkrav | Resend Dashboard | Domänstatus, leveransfel |
| DNS/brfnet | `info@brfjlg.se` (att verifiera) | Manuellt kontrollkrav | brfnet-portal/support | DNS-poster, förnyelse |

### GitHub

- Konto: `info@brfjlg.se`
- Organisation: `Brf-Jenny-Linds-Gata`
- Repo: `brfjlg-fastighetsportal`
- Kontrollera branch `main`
- Kontrollera Dependabot (alerts + security updates)
- Kontrollera Security Alerts
- Kontrollera misslyckade GitHub Actions **endast om workflows senare
  införs** — repot har inga `.github/workflows` vid det här
  dokumentets skrivande
- Kontrollera vem som har org- och repoåtkomst

### Vercel

- Konto: `info@brfjlg.se`
- Team: `brf-jenny-linds-gata`
- Projekt: `brfjlg-fastighetsportal`
- Kontrollera deployments
- Kontrollera build errors
- Kontrollera vilken commit som är Production
- Kontrollera Production-domäner
- Kontrollera miljövariabelnamn och ansvar — **aldrig värden i
  dokumentation**
- Kontrollera plan och fakturering
- Kontrollera teammedlemmar

### Supabase

- Konto: `info@brfjlg.se`
- Organisation: `Brf Jenny Linds Gata`
- Project ref: `mghmedkjxrbolhtllkba`
- Region: `eu-west-2`
- Kontrollera projektstatus
- Kontrollera plan och eventuell pausningsrisk
- Kontrollera databasens storlek och användning
- Kontrollera Auth-inställningar
- Kontrollera användare och profiler
- Kontrollera profillösa användare (se
  [`SECURITY.md`, §6](SECURITY.md#6-profilkravet))
- Kontrollera Logs
- Kontrollera Advisors
- Kontrollera Storage
- Kontrollera backups
- Kontrollera RLS-status och relevanta policyer — **endast read-only**
- Kontrollera migrationer i `db/` mot dokumenterad Production-status
  (senast applicerad: `010`, se [`SECURITY.md`, §7](SECURITY.md#7-migration-010-och-rls))

### Resend

- Rätt konto ska **först verifieras** som `info@brfjlg.se`
- Exakt team och konto: **manuellt kontrollkrav**
- Kontrollera domänstatus för `mail.brfjlg.se`
- Kontrollera leveransfel, studsningar och spärrar
- Kontrollera att Supabase SMTP fortfarande använder rätt konfiguration
- **Dokumentera aldrig SMTP-hemligheten**

### DNS/brfnet

- Kontrollera att rätt konto och åtkomst har verifierats
- Kontrollera relevanta DNS-poster
- Kontrollera domän- och DNS-förnyelse
- Kontrollera kontaktväg till brfnet
- **Ändra inga poster under en vanlig kontroll**

## 4. Driftkalender

| Frekvens | Kontrollområde | Vad ska kontrolleras | Normal avvikelsehantering |
|---|---|---|---|
| Efter varje push till `main` | Deploy | Se avsnitt 4.1 | Läs build-logg, ingen ny slumpmässig push |
| Veckovis | Grundläggande drift | Se avsnitt 4.2 | Journalför, eskalera vid behov |
| Månadsvis | GitHub/Vercel/Supabase/Resend/dokumentation | Se avsnitt 4.3 | Journalför, planera åtgärd |
| Kvartalsvis | Beroenden, säkerhet, backup-beredskap | Se avsnitt 5 | Kategorisera och planera separat gate |
| Årligen | Ägarskap, åtkomst, överlämningsövning | Se avsnitt 6 | Styrelsebeslut vid behov |

Samtliga intervall ovan är rekommendationer — se
[avsnitt 17](#17-öppna-driftbeslut).

### 4.1 Efter varje push till `main`

1. Rätt GitHub-konto, organisation och repo verifierat
2. Branch och pushad commit kontrollerad (`git log -1`)
3. Vercel har startat rätt deployment
4. Deploymenten bygger rätt commit-SHA
5. Build-status är Success
6. Production-URL laddar (`https://brfjlg-fastighetsportal.vercel.app`)
7. `/api/health` svarar korrekt
8. Den ändrade funktionen fungerar
9. Inga uppenbara regressionsfel finns
10. Login/logout testas om Auth berörts
11. Relevanta roller testas om behörighet berörts
12. Git-status är ren och HEAD = origin/main efter avslutat arbete
13. CHANGELOG eller annan dokumentation uppdateras vid betydande förändring

**Om Vercel-deployment misslyckas:**

- Gör **ingen ny slumpmässig push**
- Läs build-loggen
- Identifiera det första faktiska felet (inte bara det sista raden i loggen)
- Kontrollera om rätt commit byggdes
- Ändra **inget i Production** innan orsaken är förstådd
- Använd en **separat korrigeringsgate** för fixen

### 4.2 Veckovis

- Production-URL
- Health endpoint
- Vercel deployment-status
- Nya kritiska GitHub Security Alerts
- Supabase-projektet är aktivt
- Uppenbara fel i Supabase-/Vercel-loggar
- Resend-leveransfel om e-post används aktivt

För ett system med låg ändringsfrekvens kan detta senare beslutas som
varannan vecka — frekvensen är ännu bara en rekommendation.

### 4.3 Månadsvis

**GitHub**
- Dependabot alerts
- Security Alerts
- Öppna pull requests
- Inaktiva eller obehöriga användare i organisationen
- Branch protection och repo-inställningar — manuellt kontrollkrav

**Vercel**
- Deploymenthistorik
- Senaste misslyckade builds
- Rätt Production branch
- Domäner
- Teammedlemmar
- Plan/användning
- Miljövariabelnamn och ansvar

**Supabase**
- Plan och pausningsrisk
- Projektstatus
- Databasstorlek
- Auth-användare
- Antal profiler
- Profillösa användare
- Auth-loggar
- Databasloggar
- Storage-användning
- Advisors
- Backupstatus
- Relevanta säkerhetsvarningar

**Resend**
- Leveransgrad
- Studsningar
- Blockerade mottagare
- Domänstatus
- Eventuella SMTP-fel

**Dokumentation**
- Öppna risker (se [`SECURITY.md`, §13](SECURITY.md#13-kvarstående-säkerhetsspår))
- Incidenter
- Manuella kontrollkrav som blivit lösta
- Om CHANGELOG behöver uppdateras

## 5. Kvartalsvis underhåll

Kontrollera:

- Node.js-version
- Next.js-version
- React-version
- Supabase-paket (`@supabase/ssr`, `@supabase/supabase-js`)
- Övriga npm-beroenden
- `npm outdated`
- Dependabot
- Breaking changes och release notes
- GitHub-, Vercel- och Supabase-medlemmar
- MFA-status
- Recovery-hantering
- Lösenordshanterare
- Service-role-användning
- RLS-policyer
- Storage-policyer
- Migrationer
- Backup
- Återställningsberedskap
- Incidentkontakter
- Dokumentationsbaslinje

**Versionsuppdateringar ska inte installeras automatiskt under själva
kontrollen** — kontrollen är read-only, en eventuell uppdatering är en
separat gate (se [avsnitt 7](#7-kontroll-av-git-och-beroendeuppdateringar)).

Kontrollen ska resultera i en av följande:

- Inga åtgärder behövs
- Planerad mindre uppdatering
- Separat större uppdateringsgate
- Akut säkerhetsgate

## 6. Årlig kontroll

- Ägarskap av `info@brfjlg.se`
- MFA och recovery
- GitHub-orgägare
- Vercel-teamägare
- Supabase-orgägare
- Resend-åtkomst
- brfnet/DNS-åtkomst
- Domänförnyelse
- Fakturering
- Abonnemangsplaner
- Incidentkontakt
- Ansvarig teknisk förvaltare
- Personer som lämnat styrelsen
- Borttagning av gamla åtkomster
- Backup och återställning
- **Faktisk överlämningsövning** — kontrollera att en annan person kan:
  - hitta dokumentationen
  - öppna rätt repo
  - verifiera Git-baslinjen
  - hitta Production
  - verifiera health
  - hitta Supabase-projektet
  - förstå hur deploy sker
  - förstå hur en incident ska hanteras

## 7. Kontroll av Git och beroendeuppdateringar

### Read-only kontroll

```powershell
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
git rev-list --left-right --count HEAD...origin/main
git log --oneline --decorate -n 10
npm outdated
npm audit
```

De faktiska `npm`-scripten i detta repo (`package.json`) är begränsade
till `dev`, `build`, `start` och `lint` — lista inga fler
`npm run`-kommandon som om de fanns utan att först kontrollera
`package.json` på nytt.

**Vad som är read-only och vad som är en ändring:**

- `npm outdated` ändrar normalt inget.
- `npm audit` är analys, inte en ändring.
- `npm audit fix` är en ändring och **får inte köras** som en del av en
  read-only kontroll.
- `npm update` och `npm install` (med nya versioner) är ändringar.
- Lockfilen (`package-lock.json`) får **inte** ändras utan en separat
  gate.

### Bedömning av uppdateringar

Kategorisera varje tillgänglig uppdatering:

- patch
- minor
- major
- säkerhetsuppdatering
- ramverksuppdatering (Next.js/React)
- transitiv dependency

**För varje planerad uppdatering:**

1. Läs release notes
2. Kontrollera breaking changes (särskilt viktigt för Next.js — se
   `AGENTS.md` och README:s varning om Next.js 16)
3. Kontrollera kompatibilitet med övriga beroenden
4. Ändra en logisk grupp i taget, inte allt samtidigt
5. Kör lokal verifiering (`npm run lint`, `npm run build`)
6. Granska diffen (inklusive lockfilen)
7. Production-verifiera efter deploy (se avsnitt 4.1)

## 8. Supabase-kontroll

### Konto och projekt

Verifiera:

- Konto `info@brfjlg.se`
- Organisation `Brf Jenny Linds Gata`
- Project ref `mghmedkjxrbolhtllkba`
- Region `eu-west-2`

### Auth

Kontrollera:

- Signup OFF ("Allow new users to sign up")
- Confirm email ON
- Anonymous sign-ins OFF
- Manual linking OFF
- Oväntade användare
- Inaktiva användare
- Antal `auth.users`
- Antal `public.profiler`
- Profillösa auth-användare
- Rollfördelning
- Invite-flöden

**Gör ingen användar- eller rolländring inom en rutinkontroll.**

### Databas

Kontrollera:

- Projektstatus
- Databasstorlek
- Anslutningsfel
- Långsamma frågor eller Advisors-varningar
- RLS aktiverat på relevanta tabeller
- Dokumenterade policyer (jämför mot `db/*.sql`)
- Migrationer (jämför repots `db/`-filer mot vad som faktiskt är
  applicerat i Production)
- Backupstatus

**Kör ingen SQL utan en separat gate.** Om SQL behövs för en kontroll
ska den först tas fram, granskas och godkännas separat — aldrig
improviseras under en rutinkontroll.

### Storage

Kontrollera:

- Bucket `sba-foton`
- Användning
- Fel
- Policyer
- Onormala volymer
- Att Storage API end-to-end fortfarande är ett öppet
  verifieringsspår (se [`SECURITY.md`, S3](SECURITY.md#s3-storage-api-end-to-end))

### Secrets

Dokumentera **endast variabelnamn och ansvar** (se
[`HANDOVER.md`, §7](HANDOVER.md#7-hemligheter-och-konfigurationsansvar)).

Skriv **aldrig** ut:

- anon-key-värde
- service-role-key
- database password
- JWT secret
- SMTP password
- access token

## 9. Vercel-kontroll

Checklista:

- Konto
- Team
- Projekt
- Production branch
- Aktuell Production deployment
- Commit-SHA
- Build-status
- Build-logg
- Runtime-fel
- Domäner
- Miljövariabelnamn
- Plan/användning
- Teammedlemmar

**Hantering av en misslyckad deployment:**

1. Identifiera commit
2. Läs loggen
3. Skilj mellan build-fel och runtime-fel
4. Kontrollera om Production fortfarande pekar på föregående
   fungerande deployment
5. Använd **ingen force push**
6. Ta fram en separat fix
7. Verifiera efter ny deployment (avsnitt 4.1)

## 10. Resend och e-post

Kontrollera:

- Rätt konto
- Domänstatus
- SMTP-status
- Leveransfel
- Studsningar
- Spam complaints
- Blockerade mottagare
- Eventuella rate limits
- Att avsändardomänen (`mail.brfjlg.se`) fortfarande är korrekt

**Markera:**

- Exakt konto/team är **manuellt kontrollkrav**
- **Inga SMTP-hemligheter** får dokumenteras
- **Testutskick är en extern åtgärd** och kräver uttryckligt
  godkännande om verkliga mottagare används

## 11. DNS och domän

Kontrollera:

- Domänens ägare
- Förnyelsedatum
- Fakturering
- Nameservers
- Relevanta DNS-poster
- Resend-relaterade DNS-poster (DKIM/SPF)
- Eventuella custom domains i Vercel
- Kontaktväg till brfnet

**DNS-ändringar är högrisk:**

- Dokumentera nuvarande värden read-only innan ändring
- Ändra en post i taget
- Spara före/efter
- Planera rollback
- Verifiera propagation
- Kräver en separat gate

## 12. Backup och återställning

**Vad som kan kontrolleras read-only:**

- Om `scripts/backup-db.mjs` finns (kodverifierat, se
  [`HANDOVER.md`, §13](HANDOVER.md#13-backup-och-återställning))
- När en backup senast togs (om det är journalfört, se avsnitt 14)
- Backupfilens existens och storlek i `scripts/backups/` (lokalt,
  gitignorat)

**Principer:**

- Backupens innehåll kan vara känsligt (persondata) — hanteras därefter
- Backupen ska **aldrig committas**
- Backupen ska lagras säkert (inte i en delad, oskyddad mapp)
- En backup är **inte verifierad** förrän en återställning eller
  innehållskontroll faktiskt har testats och dokumenterats

**Rekommenderad kontroll:**

- Månadsvis kontroll av backupstatus
- Kvartalsvis kontroll av backup-rutinen
- Årlig, kontrollerad återställningsövning, om möjligt

**Ingen faktisk backup eller restore görs som en del av det här
dokumentets instruktioner** — det är en beskrivning av rutinen, inte
en utförd åtgärd.

## 13. Incident- och avvikelsehantering

Se även incidentchecklistan i
[`HANDOVER.md`, §15](HANDOVER.md#15-incidenthantering).

### Kritisk

Exempel:

- Obehörig dataåtkomst
- Läckt service-role key
- Production helt otillgänglig
- Felaktig Production-databasändring
- Fel DNS som gör tjänsten otillgänglig
- Omfattande e-postmissbruk

**Åtgärd:**

1. Stoppa ytterligare förändringar
2. Dokumentera tidpunkt
3. Säkra konton
4. Återkalla hemlighet vid behov — genom en separat incidentgate
5. Bevara loggar
6. Isolera felet
7. Eskalera

### Hög

- Login fungerar inte
- RLS-regression
- Storage fungerar inte
- Återkommande deploymentfel
- E-post levereras inte

### Normal

- Beroenden behöver uppdateras
- Dokumentation är gammal
- Enstaka leveransfel
- Varningar utan direkt påverkan

## 14. Driftjournal

Mall:

| Datum och tid | Utförd kontroll | Tjänst/miljö | Resultat | Avvikelse | Åtgärd eller beslut | Utförd av | Nästa kontroll |
|---|---|---|---|---|---|---|---|

**Principer:**

- Skriv **aldrig** lösenord eller nycklar i journalen
- Länka hellre till ett GitHub issue, en commit, en Vercel deployment
  eller ett internt ärendenummer än att skriva ut detaljer
- Personuppgifter ska minimeras
- Journalen **kan ligga utanför repot** om den innehåller intern
  driftinformation som inte hör hemma i ett publikt repo
- Beslut om var journalen faktiskt ska föras är ett **manuellt
  kontrollkrav** (se avsnitt 17)

**Exempellogg (neutrala exempel, inga riktiga personer eller hemligheter):**

| Datum och tid | Utförd kontroll | Tjänst/miljö | Resultat | Avvikelse | Åtgärd eller beslut | Utförd av | Nästa kontroll |
|---|---|---|---|---|---|---|---|
| 2026-07-30 14:00 | Veckovis grundkontroll | Production + Vercel + Supabase | OK | Ingen | Ingen åtgärd | Driftansvarig | 2026-08-06 |
| 2026-07-15 09:00 | Månadsvis Supabase-kontroll | Supabase | OK, en varning i Advisors | Advisor-varning om en icke-indexerad kolumn | Noterad för kvartalsvis uppföljning, ingen akut åtgärd | Driftansvarig | 2026-08-15 |

## 15. Checklista efter ändring

- [ ] Rätt konto verifierat
- [ ] Rätt organisation/team/projekt
- [ ] Rätt branch och commit
- [ ] Arbetskopian var ren före ändring
- [ ] Ändringen avgränsad
- [ ] Diff granskad
- [ ] Relevanta tester körda
- [ ] Ingen hemlighet i diff
- [ ] Commit godkänd
- [ ] Push godkänd
- [ ] Rätt Vercel-deployment
- [ ] Health endpoint kontrollerad
- [ ] Funktionell Production-kontroll genomförd
- [ ] Git-status kontrollerad efteråt
- [ ] CHANGELOG/dokumentation uppdaterad
- [ ] Avvikelse eller incident journalförd (om relevant)

## 16. När separat ändringsgate krävs

- `npm install`/`update`/`audit fix`
- Ändring i `package.json` eller lockfil
- Större Next.js-/React-/Node-uppdatering
- Migration
- SQL
- RLS
- Auth-inställning
- Användare eller roller
- Storage-policy
- Vercel env-variabel
- Supabase secrets
- Resend
- SMTP
- DNS
- Domän
- GitHub-orginställningar
- Vercel-teaminställningar
- Backup/restore
- Incidentåtgärd
- Rollback

## 17. Öppna driftbeslut

Följande är **ännu inte beslutade** och ska markeras som sådana tills
styrelsen tagit ställning:

- Vem som är ordinarie driftansvarig
- Vem som är reserv
- Var driftjournalen ska ligga
- Exakt veckovis/månadsvis frekvens
- Incidentkontakt
- Lösenordshanterare
- Backupdestination
- Återställningsintervall
- Godkännare för Production-ändringar
- Faktureringsägare
- Vem som äger domän och DNS
- Hur styrelsebyten hanteras

## 18. Dokumentunderhåll

- **Dokumentationsbaslinje:** 2026-07-30
- **Aktuell commit vid skapandet:** `545ac9289d30b1935596cea165961d8c9ae817ac`
- **Senaste verifieringsdatum:** 2026-07-30

Dokumentet ska uppdateras när:

- Tjänster ändras
- Konton ändras
- Intervall ändras (efter styrelsebeslut)
- Nya kontroller införs
- En incident inträffar
- Nya miljöer tillkommer
- Backup eller restore verifieras
