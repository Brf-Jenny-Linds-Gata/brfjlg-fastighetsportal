-- =========================================================
-- Säkerhetsnät: skapar anon/authenticated/service_role ENDAST om
-- de saknas i avbildningen. Supabases officiella postgres-avbildning
-- ska redan innehålla dessa roller (samt auth-/storage-scheman) —
-- detta script är en fallback ifall den använda taggen saknar dem,
-- så att db/001–010 inte faller på "role ... does not exist".
--
-- service_role får BYPASSRLS, i linje med hur Supabase Production
-- är konfigurerat (service_role kringgår RLS helt, se
-- src/lib/supabase/admin.ts:5-9 i huvudrepot).
-- =========================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

-- Bekräfta explicit att service_role verkligen har BYPASSRLS (del av
-- testmål 5 — "service-role/admin-beteende inte påverkas").
select rolname, rolbypassrls
from pg_roles
where rolname in ('anon', 'authenticated', 'service_role');
