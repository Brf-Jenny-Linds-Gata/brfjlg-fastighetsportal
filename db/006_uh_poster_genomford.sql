-- =========================================================
-- BrfJLG Fastighetsportal — markera UH-post som genomförd
-- + valfritt återkommande intervall
-- Kör i Supabase → SQL Editor
-- =========================================================

alter table uh_poster
  add column if not exists genomford_datum date,
  add column if not exists aterkommande_intervall_ar int;
