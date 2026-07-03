-- =========================================================
-- BrfJLG Fastighetsportal — lägg till roll 'entreprenör'
-- Kör i Supabase → SQL Editor
--
-- VIKTIGT: Postgres tillåter inte att ett nytt enum-värde
-- används i samma transaktion som det skapas i. Kör därför
-- STEG 1 och STEG 2 som två separata "Run"-klick (två
-- separata queries), inte som ett enda skript.
-- =========================================================

-- ---------- STEG 1 (kör för sig, klicka Run) ----------
alter type profil_roll add value if not exists 'entreprenör';


-- ---------- STEG 2 (kör efter att STEG 1 har körts klart) ----------

-- Entreprenör får bara markera befintliga anmärkningar som åtgärdade,
-- inte skapa nya anmärkningar eller röra kontroller/kontrollpunkter.
create policy "entreprenör åtgärdar anmarkningar" on sba_anmarkningar for update
  using (exists (select 1 from profiler p where p.id = auth.uid() and p.roll = 'entreprenör'));

-- Entreprenör behöver kunna läsa anmärkningar och relaterade kontroller/portar
-- för att veta vad som ska åtgärdas — täcks redan av befintliga
-- "läs alla"-policyer (auth.role() = 'authenticated'), ingen ändring behövs där.
