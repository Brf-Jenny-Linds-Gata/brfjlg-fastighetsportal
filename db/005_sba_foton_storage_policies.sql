-- =========================================================
-- BrfJLG Fastighetsportal — åtkomstpolicyer för sba-foton-bucketen
-- Kör i Supabase → SQL Editor, EFTER att scripts/setup-storage.mjs
-- har skapat bucketen "sba-foton".
-- =========================================================

create policy "läs sba-foton" on storage.objects for select
  using (bucket_id = 'sba-foton' and auth.role() = 'authenticated');

create policy "ladda upp sba-foton" on storage.objects for insert
  with check (
    bucket_id = 'sba-foton'
    and exists (
      select 1 from profiler p
      where p.id = auth.uid() and p.roll in ('styrelse', 'brandskyddsansvarig')
    )
  );
