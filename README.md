# BrfJLG Fastighetsportal

Webbapp för Brf Jenny Linds Gata (Stockholm) som ersätter Excel/Planima för
underhållsplanering och SBA (systematiskt brandskyddsarbete).

> **Det här är ett levande dokument.** Det uppdateras löpande i takt med
> att appen byggs vidare, så att någon annan än den nuvarande
> styrelsemedlemmen kan ta över utan att behöva återupptäcka hur allt
> hänger ihop. Fält märkta 🔲 **FYLL I** nedan är sådant bara du (den
> nuvarande ägaren av kontona) kan fylla i.

## Innehåll

- [Överlämning – konton och åtkomst](#överlämning--konton-och-åtkomst)
- [Teknisk stack](#teknisk-stack)
- [Arkitektur & anslutna tjänster](#arkitektur--anslutna-tjänster)
- [Datamodell](#datamodell)
- [Autentisering](#autentisering)
- [Mappstruktur](#mappstruktur)
- [Kom igång lokalt](#kom-igång-lokalt)
- [Databasmigrationer](#databasmigrationer)
- [Kända begränsningar / kvar att göra](#kända-begränsningar--kvar-att-göra)

## Överlämning – konton och åtkomst

Om du lämnar styrelsen: se till att nästa ansvariga person får åtkomst
till kontona nedan **innan** du lämnar. Fyll i användarnamn/e-post här i
dokumentet (det är inte hemligt) — men skriv **aldrig lösenord eller
API-nycklar i klartext i den här filen**. Filen ligger i git och allt som
committas dit finns kvar för alltid i historiken, även om du tar bort det
senare, och blir läsbart för alla med tillgång till repot. Ange istället
var lösenordet/nyckeln förvaras (t.ex. namnet på posten i er
lösenordshanterare, eller vem som administrerar kontot).

| Tjänst | Vad den används till | Inloggning / kontoägare | Var lösenordet finns |
|---|---|---|---|
| Supabase (mghmedkjxrbolhtllkba.supabase.co) | Databas, auth, storage — hela appens backend | 🔲 FYLL I (e-post kopplad till Supabase-kontot) | 🔲 FYLL I |
| Resend (mail.brfjlg.se) | Skickar inloggningsmejl | 🔲 FYLL I | 🔲 FYLL I |
| GitHub-org Brf-Jenny-Linds-Gata | Tänkt kodhem (ej pushat än, se nedan) | 🔲 FYLL I | 🔲 FYLL I |
| Loopia AB | Domänregistrator för brfjlg.se (årsavgift, men INTE DNS-innehåll) | 🔲 FYLL I | 🔲 FYLL I |
| brfnet | Faktisk DNS-hantering för brfjlg.se (namnservrar ns3/ns4.brfnet.se) + cPanel för e-post | 🔲 FYLL I (kontaktväg/supportportal) | 🔲 FYLL I |
| Vercel | Planerad driftplattform, inte uppsatt än | 🔲 FYLL I när det skapas | 🔲 FYLL I |

**Rekommendation:** använd en delad lösenordshanterare för föreningen
(t.ex. Bitwarden Organizations, 1Password Families) så att åtkomst kan
överlämnas utan att lösenord behöver skickas i klartext via mejl/chatt.



## Teknisk stack

| Del | Val |
|---|---|
| Ramverk | Next.js 16 (App Router, Turbopack) |
| Språk | TypeScript |
| UI | Tailwind CSS 4 + en del handskrivna inline-stilar (se [Mappstruktur](#mappstruktur)) |
| Databas / Auth / Storage | Supabase (Postgres + Row Level Security, Auth, Storage) |
| Grafer | Recharts |
| Ikoner | lucide-react |
| Transaktionell e-post | Resend (via Supabase Auth SMTP-integration) |

**Viktigt:** appen kör Next.js 16, som har brutit mot flera konventioner
från äldre Next.js-versioner (t.ex. `middleware.ts` → `proxy.ts`, helt
asynkrona request-API:er). Se `AGENTS.md` i repo-roten och
`node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`
innan du antar hur något fungerar baserat på äldre kunskap.

## Arkitektur & anslutna tjänster

```
Webbläsare
   │
   ├─ Next.js-app (webapp/), körs lokalt (npm run dev) eller på Vercel
   │     ├─ src/proxy.ts          – körs på varje request, kräver inloggad
   │     │                          session för allt utom /login och /auth/*
   │     ├─ Server Components      – hämtar data direkt mot Supabase med
   │     │                          användarens session (RLS avgör vad som syns)
   │     └─ Client Components      – formulär/interaktivitet, skriver mot
   │                                Supabase via samma session
   │
   ├─ Supabase-projekt (mghmedkjxrbolhtllkba.supabase.co)
   │     ├─ Postgres – all data, se Datamodell nedan
   │     ├─ Row Level Security – styr vem som får läsa/skriva vad per roll
   │     ├─ Auth – magic link (e-post, ingen lösenordsinloggning)
   │     └─ Storage – bucket "sba-foton" (privat) för bilder på SBA-anmärkningar
   │
   ├─ Resend (mail.brfjlg.se) – skickar Supabase Auths inloggningsmejl.
   │     Kopplat till Supabase via Custom SMTP (Auth → Settings → SMTP).
   │     Domänverifiering sker via DNS-poster (DKIM/SPF) hos brfnet
   │     (se nedan).
   │
   ├─ DNS för brfjlg.se – registrator är Loopia AB, men DNS-zonen hanteras
   │     av brfnet (nameservers ns3/ns4.brfnet.se). Ändringar (t.ex. för
   │     Resend) görs via supportärende till brfnet, inte via Loopia eller
   │     det cPanel-konto föreningen har (som bara har e-postverktyg, ingen
   │     DNS-zonredigerare).
   │
   └─ GitHub-org Brf-Jenny-Linds-Gata – tänkt hem för koden. Lokalt
         git-repo finns i webapp/ men är ännu INTE pushat till någon remote.
```

**Vercel** är inte uppsatt än (inget projekt skapat), så appen finns bara
lokalt tills vidare.

### Nycklar och var de bor

| Nyckel | Var | Används av |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `webapp/.env.local` | Klient + server (publik, ok att exponera) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `webapp/.env.local` | Klient + server, RLS avgör åtkomst (publik, ok att exponera) |
| `SUPABASE_SERVICE_ROLE_KEY` | `webapp/.env.local` (endast lokalt) | **Bara** `scripts/`-verktyg, aldrig i appkoden. Kringgår RLS helt – får aldrig committas eller användas i klientkod. |

`.env.local` är gitignorat (`.env*` i `.gitignore`) och committas aldrig.

## Datamodell

Definierad i `db/001_init_schema.sql`, med tillägg i senare migrationsfiler
(se [Databasmigrationer](#databasmigrationer)).

- **fastigheter** – Spetshandsken 1 ("bruna gården") och Tumvanten 1
  ("gröna gården")
- **portar** – adresser per fastighet
- **profiler** – kompletterar `auth.users` med namn + roll
  (`styrelse` / `brandskyddsansvarig` / `medlem` / `entreprenör`)
- **uh_kategorier**, **uh_poster** – underhållsplanens poster, taggade per
  fastighet (eller `null` = Gemensam), kategori och år. `uh_andringslogg`
  loggar automatiskt år-/kostnads-/statusändringar via en databastrigger.
- **sba_kontrollpunkter**, **sba_kontroller**, **sba_kontroll_resultat**,
  **sba_anmarkningar** – SBA-checklistor per kvartal/fastighet, med
  anmärkningar (ev. med foto) kopplade till enskilda checklistepunkter
  eller portar.

All åtkomst styrs av Row Level Security-policyer (definierade i
migrationsfilerna) – inte av applikationskoden. Det betyder att samma
regler gäller oavsett vilket verktyg som pratar med databasen.

## Autentisering

Passwordless magic-link via Supabase Auth (`@supabase/ssr`):

- `src/lib/supabase/client.ts` / `server.ts` / `middleware.ts` – tre
  varianter av Supabase-klienten för respektive kontext
- `src/proxy.ts` – körs på varje request (Next.js 16-namnet för vad som
  tidigare hette `middleware.ts`), redirectar oinloggade till `/login`
- `src/app/login/page.tsx` – skickar magic link
- `src/app/auth/callback/route.ts` – tar emot PKCE-koden från den riktiga
  e-postlänken och upprättar sessionen

### Testa inloggning lokalt utan att vänta på e-post

`scripts/dev-magic-link.mjs` genererar en fungerande inloggningslänk via
Supabase Admin API, utan att skicka något mejl:

```bash
node --env-file=.env.local scripts/dev-magic-link.mjs poffe@amble.se
```

Länken landar på `src/app/auth/dev-session/page.tsx` – en dev-only sida
som hanterar den annorlunda tokenformen (`#access_token=` i stället för
`?code=`) som Admin API:et returnerar. Detta flöde används bara för lokal
utveckling, aldrig av riktiga användare.

## Mappstruktur

```
webapp/
├── src/app/
│   ├── login/                  – inloggningssida
│   ├── auth/callback/          – PKCE-callback för riktig e-postlänk
│   ├── auth/dev-session/       – dev-only, se ovan
│   ├── underhallsplan/         – underhållsplan (server + klientkomponent)
│   ├── sba/                    – SBA: lista, ny kontroll, kontrolldetalj
│   └── page.tsx                – startsida
├── src/lib/supabase/           – Supabase-klienter, typer, profil-helper
├── src/proxy.ts                – auth-skydd för alla routes
├── db/                         – SQL-migrationer, körs manuellt i Supabase
│   └── 001_init_schema.sql     – ursprungsschemat (kör detta först i ett
│                                  nytt Supabase-projekt, resten i
│                                  nummerordning)
├── scripts/                    – fristående Node-skript (kräver
│                                  service_role-nyckeln), inte del av appen
└── reference_underhallsplan.jsx – historisk UI-prototyp, ersatt av
                                    src/app/underhallsplan/, kvar som referens
```

De flesta sidor blandar Tailwind-klasser (SBA-sidorna, formulär) med
handskrivna inline-stilar (underhållsplan-sidan, som är porterad från en
tidigare fristående designprototyp). Följ respektive fils befintliga
mönster snarare än att blanda friskt.

## Kom igång lokalt

Förutsätter Node.js 20.9+ och att `.env.local` finns (se ovan).

```bash
npm install
npm run dev
```

Öppna `http://localhost:3000`. Utan session redirectar allt till
`/login`.

## Databasmigrationer

Filerna i `db/` körs manuellt i **Supabase → SQL Editor**, i nummerordning.
De är skrivna för att vara säkra att köra flera gånger (idempotenta där det
går) men körs inte automatiskt av något CI/CD-verktyg – det finns ingen
migrationsrunner kopplad till detta projekt.

| Fil | Vad den gör |
|---|---|
| `001_init_schema.sql` | Grundschema + RLS-policyer + seed-data |
| `002_add_entreprenor_role.sql` | Ny roll `entreprenör` för att åtgärda SBA-anmärkningar |
| `003_sba_resultat_update_policy.sql` | Tillåter rättning av redan ifyllda checklistepunkter |
| `004_grant_authenticated_privileges.sql` | **Kritisk fix** – grund-GRANT för rollen `authenticated` som saknades helt i 001, blockerade all dataåtkomst |
| `005_sba_foton_storage_policies.sql` | Läs-/skrivpolicyer för Storage-bucketen `sba-foton` |
| `006_uh_poster_genomford.sql` | Nya kolumner för "markera genomförd" + återkommande intervall |
| `007_uh_andringslogg_insert_policy.sql` | **Kritisk fix** – ändringsloggens trigger saknade INSERT-policy, blockerade alla år-/kostnadsändringar på UH-poster |

## Kända begränsningar / kvar att göra

- **Vercel-deploy**: inte uppsatt än, appen körs bara lokalt
- **GitHub-remote**: repot är inte pushat till `Brf-Jenny-Linds-Gata`-orgen än
- **Admin-vy för användarhantering**: planerad men inte påbörjad. Kräver
  `service_role`-nyckeln i en server-side Route Handler (för
  `auth.admin.inviteUserByEmail` m.m.) – ska inte byggas utan uttryckligt
  godkännande, se projektminnet
- **Mörkt läge**: medvetet inte implementerat. `color-scheme: light` är
  satt explicit i `globals.css` för att undvika att webbläsarens
  inbyggda mörka rendering ger osynlig text på ljusa bakgrunder
- **Ingen DELETE-policy** på de flesta tabeller (avsiktligt – poster
  raderas inte, bara ändrar status). Felaktigt skapade testposter måste
  tas bort manuellt via SQL Editor
- **K3-kategorisering**: avsiktligt utelämnad, kommer i senare fas
- **Fondsimulering**: avsiktligt utelämnad – appen visar bara summerad
  kostnad per år, ingen likviditets-/fondsimulering
