-- =========================================================
-- BrfJLG Fastighetsportal — utöka ändringsloggen till att även
-- fånga namn, fastighet, kategori och genomförd-markering
-- (tidigare loggades bara år/investering/underhåll/status)
-- Kör i Supabase → SQL Editor
-- =========================================================

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
  if old.namn is distinct from new.namn then
    insert into uh_andringslogg (post_id, andrad_av, falt, gammalt_varde, nytt_varde)
    values (new.id, new.uppdaterad_av, 'namn', old.namn, new.namn);
  end if;
  if old.fastighet_id is distinct from new.fastighet_id then
    insert into uh_andringslogg (post_id, andrad_av, falt, gammalt_varde, nytt_varde)
    values (
      new.id, new.uppdaterad_av, 'fastighet',
      (select namn from fastigheter where id = old.fastighet_id),
      (select namn from fastigheter where id = new.fastighet_id)
    );
  end if;
  if old.kategori_id is distinct from new.kategori_id then
    insert into uh_andringslogg (post_id, andrad_av, falt, gammalt_varde, nytt_varde)
    values (
      new.id, new.uppdaterad_av, 'kategori',
      (select namn from uh_kategorier where id = old.kategori_id),
      (select namn from uh_kategorier where id = new.kategori_id)
    );
  end if;
  if old.genomford_datum is distinct from new.genomford_datum then
    insert into uh_andringslogg (post_id, andrad_av, falt, gammalt_varde, nytt_varde)
    values (new.id, new.uppdaterad_av, 'genomförd', old.genomford_datum::text, new.genomford_datum::text);
  end if;
  new.uppdaterad_at = now();
  return new;
end;
$$ language plpgsql;
