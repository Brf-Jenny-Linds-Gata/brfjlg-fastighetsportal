-- =========================================================
-- BrfJLG Fastighetsportal — kräv profiler-medlemskap för läsning
-- Kör i Supabase → SQL Editor
--
-- Bakgrund: samtliga SELECT-policyer i 001_init_schema.sql tillät
-- läsning av vem som helst med auth.role() = 'authenticated', utan
-- krav på att personen faktiskt har en rad i profiler. Eftersom
-- inloggningen (magic link) tidigare kunde skapa ett helt nytt
-- auth.users-konto åt en okänd e-postadress (se ändringen i
-- src/app/login/page.tsx, shouldCreateUser: false), kunde en sådan
-- profillös, oinbjuden användare läsa hela applikationens data via
-- ett direkt Supabase REST-anrop — förbi appens egna UI-spärrar,
-- som bara är ett bekvämlighetslager och inte en säkerhetsgräns
-- (se kommentaren i src/lib/permissions.ts).
--
-- Denna migration:
--   1. inför en icke-rekursiv medlemskapskontroll, public.is_member()
--   2. byter SELECT-villkoret på samtliga 10 applikationstabeller
--      samt sba-foton-bucketen från "auth.role() = 'authenticated'"
--      till "public.is_member()"
--
-- INSERT/UPDATE/DELETE-policyer rörs INTE här — den gemensamma
-- arbetskömodellen för styrelse/brandskyddsansvarig/entreprenör
-- och de befintliga rollkraven är oförändrade.
-- =========================================================

-- ---------- HELPER: public.is_member() ----------
-- SECURITY DEFINER krävs specifikt för att kunna slå upp medlemskap
-- i public.profiler UTAN rekursiv RLS-utvärdering på profiler självt:
-- om profilers egen SELECT-policy gjorde "select ... from profiler"
-- direkt i sin USING-klausul skulle Postgres ge felet
-- "infinite recursion detected in policy for relation profiler",
-- eftersom den inre SELECT:en i sig är underkastad samma policy.
-- SECURITY DEFINER kör den interna SELECT:en med funktionsägarens
-- rättigheter, vilket kringgår RLS helt internt och bryter
-- rekursionskedjan. Funktionen tar inga parametrar, kontrollerar
-- enbart den anropande sessionens egen auth.uid(), och returnerar
-- bara en boolean — ingen radata lämnar funktionen.
create or replace function public.is_member()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.profiler
    where id = auth.uid()
  );
$$;

-- CREATE FUNCTION ger som standard EXECUTE till PUBLIC (vilket i
-- praktiken även omfattar anon). Detta återkallas explicit — bara
-- authenticated ska kunna anropa funktionen.
revoke all on function public.is_member() from public;
revoke all on function public.is_member() from anon;
grant execute on function public.is_member() to authenticated;

-- ---------- SELECT-policyer: 10 applikationstabeller ----------
alter policy "läs alla" on fastigheter using (public.is_member());
alter policy "läs alla" on portar using (public.is_member());
alter policy "läs alla" on uh_kategorier using (public.is_member());
alter policy "läs alla" on uh_poster using (public.is_member());
alter policy "läs alla" on uh_andringslogg using (public.is_member());
alter policy "läs alla" on sba_kontrollpunkter using (public.is_member());
alter policy "läs alla" on sba_kontroller using (public.is_member());
alter policy "läs alla" on sba_kontroll_resultat using (public.is_member());
alter policy "läs alla" on sba_anmarkningar using (public.is_member());
alter policy "läs egen profil" on profiler using (public.is_member());

-- ---------- Storage: sba-foton ----------
alter policy "läs sba-foton" on storage.objects
  using (bucket_id = 'sba-foton' and public.is_member());
