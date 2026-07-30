# Ändringslogg – säkerhet och drift

Den här filen kompletterar Git-historiken — den ersätter den inte.
Bara **betydande säkerhets-, auth-, databas-, drift- och
deployförändringar** behöver dokumenteras här; för allt annat räcker
`git log`. Nyaste posten ligger överst. Tekniska detaljer länkas vidare
till [`docs/SECURITY.md`](SECURITY.md), [`docs/HANDOVER.md`](HANDOVER.md)
och relevanta commits istället för att upprepas i sin helhet.

## 2026-07-30 – Säkring av medlemsåtkomst och logout

### Bakgrund

Ett bekräftat Production-fynd: magic-link-anropet (`signInWithOtp`)
kunde tidigare tillåta att ett helt nytt `auth.users`-konto skapades åt
en godtycklig, okänd e-postadress. Samtidigt kontrollerade
läspolicyerna på applikationens tabeller autentisering
(`auth.role() = 'authenticated'`), men inte alltid att den inloggade
personen faktiskt hade en kopplad medlemsprofil i `public.profiler`. I
kombination innebar det att ett självregistrerat, profillöst
auth-konto utgjorde en läsrisk för föreningens driftdata vid ett
direkt Supabase API-anrop, förbi appens UI-spärrar (som bara är ett
bekvämlighetslager, inte en säkerhetsgräns).

### Åtgärder

- Supabase Auth: **"Allow new users to sign up" satt till OFF**
  (Production-verifierat 2026-07-30, dashboardinställning).
- `src/app/login/page.tsx`: `signInWithOtp` anropas nu med
  **`shouldCreateUser: false`**.
- Login-sidan hanterar felkoden `signup_disabled` med ett tydligt
  svenskt meddelande.
- `db/010_require_profile_for_read_access.sql`: inför
  **`public.is_member()`** (SECURITY DEFINER, STABLE, låst
  `search_path`, EXECUTE endast för `authenticated`) och byter **10
  SELECT-policyer** samt Storage-policyn för bucketen **`sba-foton`**
  från `auth.role() = 'authenticated'` till `public.is_member()`.
- Den tidigare profillösa användaren togs bort (Production-verifierat
  2026-07-30, uppgivet i överlämningsunderlaget).
- `src/app/auth/logout/route.ts`: redirect efter utloggning ändrad från
  ett implicit HTTP **307** till ett explicit HTTP **303**, så att en
  POST-utloggning alltid följs upp med en GET mot `/login` i stället för
  att webbläsaren försöker POST:a mot en sida som inte stödjer det.

Se [`docs/SECURITY.md`](SECURITY.md#6-profilkravet) för hur
`public.is_member()` fungerar tekniskt och varför `SECURITY DEFINER`
krävs för att undvika RLS-självrekursion.

### Verifiering

- Migration `010` applicerad och verifierad i Production
  (Production-verifierat 2026-07-30).
- RLS fortsatt aktiverat på samtliga berörda tabeller.
- `auth.users = 6`, `public.profiler = 6`, `profileless_auth_users = 0`
  (Production-verifierat 2026-07-30, uppgivet i överlämningsunderlaget).
- Production-inloggning verifierad för en befintlig, avsedd användare.
- Portaldata laddar normalt efter fixen.
- Ingen RLS-regression observerad.
- Logout avslutar sessionen korrekt; `/login` visas utan HTTP 405.
- Isolerat RLS-integrationstest: **44 PASS / 0 FAIL**, se
  [`../test/security/rls-integration/RESULTS_2026-07-30.md`](../test/security/rls-integration/RESULTS_2026-07-30.md).
- Vercel-deployment: success.

### Commits

- `54a90f7d6c80c61206818404c5fb4228fc94d051` — "fix: require profile
  membership for read access, block unauthenticated signup" (Git-
  verifierat, full hash) — innehåller `shouldCreateUser: false`,
  migration 010, och det isolerade RLS-testpaketet.
- `545ac9289d30b1935596cea165961d8c9ae817ac` — "fix: use get redirect
  after logout" (Git-verifierat, full hash) — ändrar
  `src/app/auth/logout/route.ts` från implicit 307 till explicit 303.

### Kvarstående spår

Fem punkter är **inte** del av denna fix och är dokumenterade som
separata, framtida säkerhetsspår i
[`docs/SECURITY.md`, avsnitt 13](SECURITY.md#13-kvarstående-säkerhetsspår):

- **S1** — `sba_anmarkningar`-kolumnintegritet (entreprenörens
  UPDATE-policy saknar `WITH CHECK`/kolumnbegränsning)
- **S2** — `inviteUserByEmail` med signup OFF, kräver egen verifiering
- **S3** — Storage API end-to-end
- **S4** — PostgREST end-to-end
- **S5** — Framtida e-post/lösenordsinloggning (inte implementerad)
