-- =========================================================
-- BrfJLG Fastighetsportal — initial schema
-- Kör hela filen i Supabase → SQL Editor → New query → Run
-- =========================================================

create extension if not exists pgcrypto;

-- ---------- ENUMS ----------
create type uh_typ as enum ('komponent', 'löpande_buffert');
create type uh_status as enum ('godkänd', 'föreslagen', 'avvisad');
create type sba_omfattning as enum ('alla', 'spetshandsken', 'tumvanten');
create type sba_kontroll_status as enum ('pågående', 'klar');
create type anmarkning_status as enum ('öppen', 'åtgärdad');
create type profil_roll as enum ('styrelse', 'brandskyddsansvarig', 'medlem');

-- ---------- PROFILER (kompletterar auth.users) ----------
create table profiler (
  id uuid primary key references auth.users (id) on delete cascade,
  namn text not null,
  roll profil_roll not null default 'medlem',
  skapad_at timestamptz not null default now()
);

-- ---------- FASTIGHETER & PORTAR ----------
create table fastigheter (
  id uuid primary key default gen_random_uuid(),
  namn text not null unique,
  adresser text
);

create table portar (
  id uuid primary key default gen_random_uuid(),
  fastighet_id uuid not null references fastigheter (id) on delete cascade,
  adress text not null,
  ordning int not null default 0
);
create index on portar (fastighet_id);

-- ---------- UNDERHÅLLSPLAN ----------
create table uh_kategorier (
  id uuid primary key default gen_random_uuid(),
  namn text not null unique
);

create table uh_poster (
  id uuid primary key default gen_random_uuid(),
  fastighet_id uuid references fastigheter (id),        -- null = Gemensam
  kategori_id uuid references uh_kategorier (id),
  lage text,
  namn text not null,
  ar int not null,
  investering numeric(12, 2) not null default 0,
  underhall numeric(12, 2) not null default 0,
  typ uh_typ not null default 'komponent',
  status uh_status not null default 'godkänd',
  -- k3_kategori_id uuid references k3_kategorier (id),  -- läggs till senare
  skapad_av uuid references profiler (id),
  skapad_at timestamptz not null default now(),
  uppdaterad_av uuid references profiler (id),
  uppdaterad_at timestamptz not null default now()
);
create index on uh_poster (ar);
create index on uh_poster (fastighet_id);
create index on uh_poster (status);

create table uh_andringslogg (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references uh_poster (id) on delete cascade,
  andrad_av uuid references profiler (id),
  tidpunkt timestamptz not null default now(),
  falt text not null,
  gammalt_varde text,
  nytt_varde text
);
create index on uh_andringslogg (post_id);

-- Trigger: logga år- och kostnadsändringar automatiskt
create or replace function log_uh_andring() returns trigger as $$
begin
  if old.ar is distinct from new.ar then
    insert into uh_andringslogg (post_id, andrad_av, falt, gammalt_varde, nytt_varde)
    values (new.id, new.uppdaterad_av, 'ar', old.ar::text, new.ar::text);
  end if;
  if old.investering is distinct from new.investering then
    insert into uh_andringslogg (post_id, andrad_av, falt, gammalt_varde, nytt_varde)
    values (new.id, new.uppdaterad_av, 'investering', old.investering::text, new.investering::text);
  end if;
  if old.underhall is distinct from new.underhall then
    insert into uh_andringslogg (post_id, andrad_av, falt, gammalt_varde, nytt_varde)
    values (new.id, new.uppdaterad_av, 'underhall', old.underhall::text, new.underhall::text);
  end if;
  if old.status is distinct from new.status then
    insert into uh_andringslogg (post_id, andrad_av, falt, gammalt_varde, nytt_varde)
    values (new.id, new.uppdaterad_av, 'status', old.status::text, new.status::text);
  end if;
  new.uppdaterad_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_log_uh_andring
  before update on uh_poster
  for each row execute function log_uh_andring();

-- ---------- SBA (SYSTEMATISKT BRANDSKYDDSARBETE) ----------
create table sba_kontrollpunkter (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  galler_fastighet sba_omfattning not null default 'alla',
  ordning int not null default 0,
  aktiv boolean not null default true
);

create table sba_kontroller (
  id uuid primary key default gen_random_uuid(),
  fastighet_id uuid not null references fastigheter (id),
  kvartal int not null check (kvartal between 1 and 4),
  ar int not null,
  utford_av uuid references profiler (id),
  utford_datum date,
  status sba_kontroll_status not null default 'pågående',
  skapad_at timestamptz not null default now(),
  unique (fastighet_id, kvartal, ar)
);

create table sba_kontroll_resultat (
  id uuid primary key default gen_random_uuid(),
  kontroll_id uuid not null references sba_kontroller (id) on delete cascade,
  punkt_id uuid not null references sba_kontrollpunkter (id),
  godkand boolean,
  unique (kontroll_id, punkt_id)
);

create table sba_anmarkningar (
  id uuid primary key default gen_random_uuid(),
  kontroll_id uuid not null references sba_kontroller (id) on delete cascade,
  punkt_id uuid references sba_kontrollpunkter (id),
  port_id uuid references portar (id),        -- nullable, ex. UC/fläktrum har ingen specifik port
  beskrivning text not null,
  foto_url text,                               -- pekar mot Supabase Storage-bucket
  status anmarkning_status not null default 'öppen',
  atgardad_av uuid references profiler (id),
  atgardad_datum date,
  atgardskommentar text,
  skapad_at timestamptz not null default now()
);
create index on sba_anmarkningar (status);
create index on sba_anmarkningar (kontroll_id);

-- =========================================================
-- RLS — startpolicyer (läsbehörighet för alla inloggade,
-- skrivbehörighet enligt roll). Justera vid behov.
-- =========================================================
alter table fastigheter enable row level security;
alter table portar enable row level security;
alter table uh_kategorier enable row level security;
alter table uh_poster enable row level security;
alter table uh_andringslogg enable row level security;
alter table sba_kontrollpunkter enable row level security;
alter table sba_kontroller enable row level security;
alter table sba_kontroll_resultat enable row level security;
alter table sba_anmarkningar enable row level security;
alter table profiler enable row level security;

-- Läsning: alla inloggade medlemmar av föreningen
create policy "läs alla" on fastigheter for select using (auth.role() = 'authenticated');
create policy "läs alla" on portar for select using (auth.role() = 'authenticated');
create policy "läs alla" on uh_kategorier for select using (auth.role() = 'authenticated');
create policy "läs alla" on uh_poster for select using (auth.role() = 'authenticated');
create policy "läs alla" on uh_andringslogg for select using (auth.role() = 'authenticated');
create policy "läs alla" on sba_kontrollpunkter for select using (auth.role() = 'authenticated');
create policy "läs alla" on sba_kontroller for select using (auth.role() = 'authenticated');
create policy "läs alla" on sba_kontroll_resultat for select using (auth.role() = 'authenticated');
create policy "läs alla" on sba_anmarkningar for select using (auth.role() = 'authenticated');
create policy "läs egen profil" on profiler for select using (auth.role() = 'authenticated');

-- Skrivning: endast styrelseroll får ändra underhållsplan / godkänna
create policy "styrelse skriver uh_poster" on uh_poster for insert
  with check (exists (select 1 from profiler p where p.id = auth.uid() and p.roll = 'styrelse'));
create policy "styrelse uppdaterar uh_poster" on uh_poster for update
  using (exists (select 1 from profiler p where p.id = auth.uid() and p.roll = 'styrelse'));

-- Skrivning: styrelse + brandskyddsansvarig hanterar SBA
create policy "behöriga skriver sba_kontroller" on sba_kontroller for insert
  with check (exists (select 1 from profiler p where p.id = auth.uid() and p.roll in ('styrelse', 'brandskyddsansvarig')));
create policy "behöriga uppdaterar sba_kontroller" on sba_kontroller for update
  using (exists (select 1 from profiler p where p.id = auth.uid() and p.roll in ('styrelse', 'brandskyddsansvarig')));
create policy "behöriga skriver sba_resultat" on sba_kontroll_resultat for insert
  with check (exists (select 1 from profiler p where p.id = auth.uid() and p.roll in ('styrelse', 'brandskyddsansvarig')));
create policy "behöriga skriver anmarkningar" on sba_anmarkningar for insert
  with check (exists (select 1 from profiler p where p.id = auth.uid() and p.roll in ('styrelse', 'brandskyddsansvarig')));
create policy "behöriga uppdaterar anmarkningar" on sba_anmarkningar for update
  using (exists (select 1 from profiler p where p.id = auth.uid() and p.roll in ('styrelse', 'brandskyddsansvarig')));

-- =========================================================
-- SEED-DATA
-- =========================================================

-- Kategorier (från Planima)
insert into uh_kategorier (namn) values ('Besiktningar');
insert into uh_kategorier (namn) values ('Fasad');
insert into uh_kategorier (namn) values ('Installationer');
insert into uh_kategorier (namn) values ('Invändigt');
insert into uh_kategorier (namn) values ('Mark');
insert into uh_kategorier (namn) values ('Yttertak');
insert into uh_kategorier (namn) values ('Övrigt');

-- Fastigheter
insert into fastigheter (id, namn, adresser) values
  ('11111111-1111-1111-1111-111111111111', 'Spetshandsken 1', 'Anna Sandströms gata 1 / Jenny Linds Gata 2-18'),
  ('22222222-2222-2222-2222-222222222222', 'Tumvanten 1', 'Ellen Fries Gata 4 / Jenny Linds Gata 1-17 / Jenny Linds gata 10');

-- Portar (bruna gården = Spetshandsken, gröna gården = Tumvanten)
insert into portar (fastighet_id, adress, ordning) values
  ('11111111-1111-1111-1111-111111111111', 'Jenny Linds Gata 2', 1),
  ('11111111-1111-1111-1111-111111111111', 'Jenny Linds Gata 4', 2),
  ('11111111-1111-1111-1111-111111111111', 'Jenny Linds Gata 6', 3),
  ('11111111-1111-1111-1111-111111111111', 'Jenny Linds Gata 8', 4),
  ('11111111-1111-1111-1111-111111111111', 'Jenny Linds Gata 10', 5),
  ('11111111-1111-1111-1111-111111111111', 'Jenny Linds Gata 12', 6),
  ('11111111-1111-1111-1111-111111111111', 'Jenny Linds Gata 14', 7),
  ('11111111-1111-1111-1111-111111111111', 'Jenny Linds Gata 16', 8),
  ('11111111-1111-1111-1111-111111111111', 'Jenny Linds Gata 18', 9),
  ('22222222-2222-2222-2222-222222222222', 'Jenny Linds Gata 1', 1),
  ('22222222-2222-2222-2222-222222222222', 'Jenny Linds Gata 3', 2),
  ('22222222-2222-2222-2222-222222222222', 'Jenny Linds Gata 5', 3),
  ('22222222-2222-2222-2222-222222222222', 'Jenny Linds Gata 7', 4),
  ('22222222-2222-2222-2222-222222222222', 'Jenny Linds Gata 9', 5),
  ('22222222-2222-2222-2222-222222222222', 'Jenny Linds Gata 11', 6),
  ('22222222-2222-2222-2222-222222222222', 'Jenny Linds Gata 13', 7),
  ('22222222-2222-2222-2222-222222222222', 'Jenny Linds Gata 15', 8),
  ('22222222-2222-2222-2222-222222222222', 'Jenny Linds Gata 17', 9);

-- SBA-kontrollpunkter (kvartalsvis, per fastighet)
insert into sba_kontrollpunkter (text, galler_fastighet, ordning) values
  ('Utrymningsvägar fria från hinder (trapphus, källargångar)', 'alla', 1),
  ('Branddörrar stänger och går i lås ordentligt', 'alla', 2),
  ('Brandsläckare i garage JLG 1 – på plats, giltighetsdatum ej passerat', 'spetshandsken', 3),
  ('Brandvarnare i gemensamma utrymmen fungerar (testknapp)', 'alla', 4),
  ('Skyltning för utrymningsväg synlig och korrekt', 'alla', 5),
  ('Elcentraler tillgängliga, inget blockerar framför', 'alla', 6),
  ('Inget brandfarligt (cyklar, barnvagnar, möbler) i trapphus/utrymningsväg', 'alla', 7),
  ('Fläktrum – inga obehöriga föremål, städat', 'tumvanten', 8),
  ('Undercentral (UC) – inga obehöriga föremål, städat', 'spetshandsken', 9),
  ('Rökluckor går att öppna, ej blockerade', 'alla', 10);

-- Underhållsposter (85 st, importerat från Planima-export, fastighetstaggat
-- utifrån "grön"/"brun" i åtgärdsnamnet — övriga är Gemensam)
insert into uh_poster (fastighet_id, kategori_id, lage, namn, ar, investering, underhall, typ, status) values
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Tvättstuga', 'Torkfläktar', 2025, 50000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Övrigt'), 'Övrigt', 'Avsättning för årligt underhållsarbete', 2026, 62500, 0, 'löpande_buffert', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Tvättstuga', 'Mangel 2 st', 2026, 37500, 0, 'komponent', 'godkänd'),
  ('22222222-2222-2222-2222-222222222222', (select id from uh_kategorier where namn = 'Mark'), 'Utemiljö', 'Murar gård Grön', 2026, 0, 375000, 'komponent', 'godkänd'),
  ('22222222-2222-2222-2222-222222222222', (select id from uh_kategorier where namn = 'Mark'), 'Utemiljö', 'Provgrop gård "grön"', 2026, 0, 37500, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Tvättstuga', 'Torktumlare BLÅ 2 st', 2026, 62500, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Tvättstuga', 'Tvättmaskin BLÅ 1 st', 2026, 43750, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Stamventiler', 'Utbyte och injustering av stamventiler', 2026, 625000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Energicentral', 'Utbyte och injustering radiatorventiler', 2026, 625000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Invändigt'), 'Tvättstuga', 'Ytskikt i tvättstugor renoveras inkl torkrum', 2026, 0, 750000, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Vatten och avlopp', 'Avloppsstammar i källargolv utbytes', 2027, 2500000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Kulvert', 'Kulvert under gata', 2027, 750000, 0, 'komponent', 'godkänd'),
  ('22222222-2222-2222-2222-222222222222', (select id from uh_kategorier where namn = 'Installationer'), 'Ventilation', 'Frånluftsfläktar gård Grön', 2028, 562500, 0, 'komponent', 'godkänd'),
  ('11111111-1111-1111-1111-111111111111', (select id from uh_kategorier where namn = 'Mark'), 'Utemiljö', 'Gård "brun" totalrenoveras inkl dagvatten', 2028, 4375000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Besiktningar'), 'Kontroller/Besiktningar', 'OVK besiktning', 2028, 0, 50000, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Mark'), 'Garage/parkering', 'Körbana i garage renoveras', 2029, 1875000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'El. Fastigheten', 'Utbyte elstigare', 2030, 1625000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Invändigt'), 'Källare', 'Åtgärd sättningar i källargolv', 2030, 0, 500000, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Övrigt'), 'Övrigt', 'Avsättning för årligt underhållsarbete', 2031, 62500, 0, 'löpande_buffert', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Fasad'), 'Dörrar entré', 'Entréportar och dörrar renoveras', 2031, 0, 125000, 'komponent', 'godkänd'),
  ('22222222-2222-2222-2222-222222222222', (select id from uh_kategorier where namn = 'Installationer'), 'Tvättstuga', 'Torskskåp GRÖN 1 st', 2031, 50000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Yttertak'), 'Tak', 'Målning plåttak lokaler/passager', 2032, 125000, 0, 'komponent', 'godkänd'),
  ('22222222-2222-2222-2222-222222222222', (select id from uh_kategorier where namn = 'Installationer'), 'Tvättstuga', 'Tvättmaskiner GRÖN 2 st', 2032, 131250, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Besiktningar'), 'Kontroller/Besiktningar', 'OVK besiktning', 2034, 0, 50000, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Invändigt'), 'Allmänna utrymmen', 'Trapphus målas', 2035, 1875000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Övrigt'), 'Övrigt', 'Avsättning för årligt underhållsarbete', 2036, 62500, 0, 'löpande_buffert', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Fasad'), 'Balkong/terrass', 'Balkonger (loftgångar) renoveras inkl räckesanpassning', 2036, 625000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Energicentral', 'Utbyte av fjärrvärmecentral', 2036, 500000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Invändigt'), 'Energicentral', 'Ytskikt renoveras i UC', 2036, 0, 75000, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Solceller', 'Solcellsanläggning, växelriktare', 2038, 75000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Solceller', 'Växelriktare Solceller', 2038, 312500, 0, 'komponent', 'godkänd'),
  ('11111111-1111-1111-1111-111111111111', (select id from uh_kategorier where namn = 'Installationer'), 'Ventilation', 'Frånluftsfläktar gård BRUN', 2040, 312500, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Besiktningar'), 'Kontroller/Besiktningar', 'OVK besiktning', 2040, 0, 50000, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Tvättstuga', 'Torkfläktar', 2040, 50000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Övrigt'), 'Övrigt', 'Avsättning för årligt underhållsarbete', 2041, 62500, 0, 'löpande_buffert', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Fasad'), 'Dörrar entré', 'Entréportar och dörrar renoveras', 2041, 0, 125000, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Tvättstuga', 'Torktumlare BLÅ 2 st', 2041, 62500, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Tvättstuga', 'Tvättmaskin BLÅ 1 st', 2041, 43750, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Energicentral', 'Utbyte av expansionskärl', 2045, 62500, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Övrigt'), 'Övrigt', 'Avsättning för årligt underhållsarbete', 2046, 62500, 0, 'löpande_buffert', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Fasad'), 'Fönster', 'Fönster målas', 2046, 500000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Besiktningar'), 'Kontroller/Besiktningar', 'OVK besiktning', 2046, 0, 50000, 'komponent', 'godkänd'),
  ('22222222-2222-2222-2222-222222222222', (select id from uh_kategorier where namn = 'Installationer'), 'Tvättstuga', 'Torskskåp GRÖN 1 st', 2046, 50000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Yttertak'), 'Tak', 'Målning plåttak lokaler/passager', 2047, 125000, 0, 'komponent', 'godkänd'),
  ('22222222-2222-2222-2222-222222222222', (select id from uh_kategorier where namn = 'Installationer'), 'Tvättstuga', 'Tvättmaskiner GRÖN 2 st', 2047, 131250, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Övrigt'), 'Övrigt', 'Avsättning för årligt underhållsarbete', 2051, 62500, 0, 'löpande_buffert', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Fasad'), 'Dörrar entré', 'Entréportar och dörrar renoveras', 2051, 0, 125000, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Energicentral', 'Utbyte och injustering radiatorventiler', 2051, 625000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Besiktningar'), 'Kontroller/Besiktningar', 'OVK besiktning', 2052, 0, 50000, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Solceller', 'Byte solcellspaneler', 2053, 1562500, 0, 'komponent', 'godkänd'),
  ('22222222-2222-2222-2222-222222222222', (select id from uh_kategorier where namn = 'Installationer'), 'Ventilation', 'Frånluftsfläktar gård Grön', 2053, 562500, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Solceller', 'Solcellsanläggning, växelriktare', 2053, 75000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Solceller', 'Växelriktare Solceller', 2053, 312500, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Tvättstuga', 'Torkfläktar', 2055, 50000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Övrigt'), 'Övrigt', 'Avsättning för årligt underhållsarbete', 2056, 62500, 0, 'löpande_buffert', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Tvättstuga', 'Mangel 2 st', 2056, 37500, 0, 'komponent', 'godkänd'),
  ('22222222-2222-2222-2222-222222222222', (select id from uh_kategorier where namn = 'Mark'), 'Utemiljö', 'Murar gård Grön', 2056, 0, 375000, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Tvättstuga', 'Torktumlare BLÅ 2 st', 2056, 62500, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Tvättstuga', 'Tvättmaskin BLÅ 1 st', 2056, 43750, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Energicentral', 'Utbyte av fjärrvärmecentral', 2056, 500000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Invändigt'), 'Tvättstuga', 'Ytskikt i tvättstugor renoveras inkl torkrum', 2056, 0, 750000, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Fasad'), 'Fasad', 'Fasader tilläggsisolering, inkl nyputs', 2057, 11875000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Besiktningar'), 'Kontroller/Besiktningar', 'OVK besiktning', 2058, 0, 50000, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Solceller', 'Solcellsanläggning, tak', 2058, 1000000, 0, 'komponent', 'godkänd'),
  ('11111111-1111-1111-1111-111111111111', (select id from uh_kategorier where namn = 'Installationer'), 'Ventilation', 'Frånluftsfläktar gård BRUN', 2060, 312500, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Övrigt'), 'Övrigt', 'Avsättning för årligt underhållsarbete', 2061, 62500, 0, 'löpande_buffert', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Fasad'), 'Dörrar entré', 'Entréportar och dörrar renoveras', 2061, 0, 125000, 'komponent', 'godkänd'),
  ('22222222-2222-2222-2222-222222222222', (select id from uh_kategorier where namn = 'Installationer'), 'Tvättstuga', 'Torskskåp GRÖN 1 st', 2061, 50000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Yttertak'), 'Tak', 'Målning plåttak lokaler/passager', 2062, 125000, 0, 'komponent', 'godkänd'),
  ('22222222-2222-2222-2222-222222222222', (select id from uh_kategorier where namn = 'Installationer'), 'Tvättstuga', 'Tvättmaskiner GRÖN 2 st', 2062, 131250, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Yttertak'), 'Tak', 'Omläggning tak inkl plåt och taksäkerhet', 2063, 6250000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Besiktningar'), 'Kontroller/Besiktningar', 'OVK besiktning', 2064, 0, 50000, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Invändigt'), 'Allmänna utrymmen', 'Trapphus målas', 2065, 1875000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Övrigt'), 'Övrigt', 'Avsättning för årligt underhållsarbete', 2066, 62500, 0, 'löpande_buffert', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Invändigt'), 'Energicentral', 'Ytskikt renoveras i UC', 2066, 0, 75000, 'komponent', 'godkänd'),
  ('11111111-1111-1111-1111-111111111111', (select id from uh_kategorier where namn = 'Mark'), 'Utemiljö', 'Gård "brun" totalrenoveras inkl dagvatten', 2068, 4375000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Solceller', 'Solcellsanläggning, växelriktare', 2068, 75000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Solceller', 'Växelriktare Solceller', 2068, 312500, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Besiktningar'), 'Kontroller/Besiktningar', 'OVK besiktning', 2070, 0, 50000, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Tvättstuga', 'Torkfläktar', 2070, 50000, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Energicentral', 'Utbyte av expansionskärl', 2070, 62500, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Övrigt'), 'Övrigt', 'Avsättning för årligt underhållsarbete', 2071, 62500, 0, 'löpande_buffert', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Fasad'), 'Dörrar entré', 'Entréportar och dörrar renoveras', 2071, 0, 125000, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Tvättstuga', 'Torktumlare BLÅ 2 st', 2071, 62500, 0, 'komponent', 'godkänd'),
  (null, (select id from uh_kategorier where namn = 'Installationer'), 'Tvättstuga', 'Tvättmaskin BLÅ 1 st', 2071, 43750, 0, 'komponent', 'godkänd');
