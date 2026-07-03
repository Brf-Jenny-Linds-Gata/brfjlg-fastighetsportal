-- =========================================================
-- BrfJLG Fastighetsportal — tillåt ändringsloggen att skrivas
-- Kör i Supabase → SQL Editor
--
-- uh_poster har en trigger (log_uh_andring) som automatiskt loggar
-- ändringar av år/kostnad/status till uh_andringslogg. Den tabellen
-- fick i 001_init_schema.sql bara en SELECT-policy ("läs alla"),
-- ingen INSERT-policy — så själva triggern (som körs med samma
-- rättigheter som den inloggade användaren, inte som superuser)
-- blockerades av RLS varje gång någon ändrade år eller kostnad på
-- en post. Felet syns som:
--   "new row violates row-level security policy for table uh_andringslogg"
-- =========================================================

create policy "styrelse loggar uh-ändringar" on uh_andringslogg for insert
  with check (exists (select 1 from profiler p where p.id = auth.uid() and p.roll = 'styrelse'));
