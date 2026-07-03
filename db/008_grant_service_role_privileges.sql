-- =========================================================
-- BrfJLG Fastighetsportal — grund-GRANT för rollen "service_role"
-- Kör i Supabase → SQL Editor
--
-- Samma rotorsak som 004_grant_authenticated_privileges.sql, fast för
-- service_role: Supabase brukar sätta upp detta automatiskt för nya
-- projekt, men det saknades här. service_role kringgår RLS helt, men
-- behöver ändå grundläggande GRANT för att nå tabellerna alls — annars
-- nekas admin-API:er (t.ex. användarhanteringen) med
-- "permission denied for table X".
-- =========================================================

grant usage on schema public to service_role;

grant select, insert, update, delete
  on all tables in schema public
  to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
