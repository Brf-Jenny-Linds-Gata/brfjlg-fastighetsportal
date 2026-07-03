-- =========================================================
-- BrfJLG Fastighetsportal — grunda GRANT för rollen "authenticated"
-- Kör i Supabase → SQL Editor
--
-- 001_init_schema.sql satte upp RLS-policyer men gav aldrig rollen
-- "authenticated" grundläggande tabellrättigheter. I Postgres krävs
-- BÅDE en GRANT och en matchande RLS-policy — utan GRANT nekas allt
-- med "permission denied for table X", oavsett hur RLS-policyerna
-- ser ut. Detta är standardmönstret Supabase själva sätter upp för
-- nya projekt (bred GRANT, RLS styr vad som faktiskt är synligt/
-- skrivbart per rad).
-- =========================================================

grant usage on schema public to authenticated;

grant select, insert, update, delete
  on all tables in schema public
  to authenticated;

-- Framtida tabeller i public-schemat får samma grund-rättigheter automatiskt.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
