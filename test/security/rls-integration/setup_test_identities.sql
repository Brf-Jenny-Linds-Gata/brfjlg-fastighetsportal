-- =========================================================
-- Syntetiska testidentiteter — SKAPAS DIREKT VIA SQL, ALDRIG VIA
-- RIKTIG SIGNUP/MAGIC LINK/INVITE. Ingen e-post skickas någonsin
-- av detta script; auth.users-raderna sätts in för hand för att
-- kunna simulera JWT-claims lokalt med set_config() i run_probe.sh.
--
-- Fasta, lätt igenkännliga test-UUID:er (inga riktiga personer):
--   aaaaaaaa-...  = testanvändare MED profiler-rad, roll 'styrelse'
--   bbbbbbbb-...  = testanvändare MED profiler-rad, roll 'entreprenör'
--   cccccccc-...  = testanvändare UTAN profiler-rad (profillös,
--                   simulerar en oinbjuden självregistrerad session)
--
-- OBS: kolumnlistan nedan är VERIFIERAD (inte längre bara antagen) mot
-- ghcr.io/supabase/postgres:17.6.1.157 via faktisk NUC-körning
-- 2026-07-30 (se test/security/rls-integration/README.md, "Verifierat
-- NUC-resultat"). Den ursprungliga kolumnen "email_confirmed_at" fanns
-- inte i den taggen — rätt kolumnnamn är "confirmed_at". Framtida
-- supabase/postgres-taggar kan ändå skilja sig; om INSERT:en misslyckas
-- på en annan tagg, kör "\d auth.users" i psql och justera.
-- =========================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
) values
  ('00000000-0000-0000-0000-000000000000',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'authenticated', 'authenticated', 'test-styrelse@example.invalid',
   crypt('not-used-bypasses-gotrue', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),
  ('00000000-0000-0000-0000-000000000000',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'authenticated', 'authenticated', 'test-entreprenor@example.invalid',
   crypt('not-used-bypasses-gotrue', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),
  ('00000000-0000-0000-0000-000000000000',
   'cccccccc-cccc-cccc-cccc-cccccccccccc',
   'authenticated', 'authenticated', 'test-profillos@example.invalid',
   crypt('not-used-bypasses-gotrue', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false)
on conflict (id) do nothing;

-- profiler-rader för de två som SKA vara medlemmar.
-- cccccccc (profillös) får medvetet INGEN rad här.
insert into public.profiler (id, namn, roll) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Styrelse', 'styrelse'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Test Entreprenör', 'entreprenör')
on conflict (id) do nothing;

-- Snabb koll direkt i loggen: bekräfta att cccccccc verkligen saknar profil.
select
  u.email,
  u.id,
  (p.id is not null) as har_profiler_rad,
  p.roll
from auth.users u
left join public.profiler p on p.id = u.id
where u.id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc'
)
order by u.email;
