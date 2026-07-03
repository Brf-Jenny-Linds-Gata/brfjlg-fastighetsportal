-- =========================================================
-- BrfJLG Fastighetsportal — tillåt rättning av SBA-checklistesvar
-- Kör i Supabase → SQL Editor
--
-- 001_init_schema.sql gav sba_kontroll_resultat en INSERT-policy
-- men ingen UPDATE-policy, vilket gör att en kontrollpunkt inte
-- går att ändra efter att den sparats en gång (RLS nekar all
-- UPDATE när ingen policy för kommandot finns). Detta lägger till
-- samma behörighet för UPDATE som redan finns för INSERT.
-- =========================================================

create policy "behöriga uppdaterar sba_resultat" on sba_kontroll_resultat for update
  using (exists (select 1 from profiler p where p.id = auth.uid() and p.roll in ('styrelse', 'brandskyddsansvarig')));
