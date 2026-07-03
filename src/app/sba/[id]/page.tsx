import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import type {
  SbaAnmarkning,
  SbaKontroll,
  SbaKontrollpunkt,
  SbaKontrollResultat,
} from "@/lib/supabase/types";
import { KontrollClient } from "./KontrollClient";

function fastighetSlug(namn: string): "spetshandsken" | "tumvanten" | "" {
  const first = namn.trim().split(" ")[0]?.toLowerCase();
  if (first === "spetshandsken" || first === "tumvanten") return first;
  return "";
}

export default async function SbaKontrollPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const profil = await getCurrentProfile();

  const { data: kontrollRow, error: kontrollError } = await supabase
    .from("sba_kontroller")
    .select("id, fastighet_id, kvartal, ar, utford_av, utford_datum, status, fastigheter(namn)")
    .eq("id", id)
    .single();

  if (kontrollError || !kontrollRow) {
    notFound();
  }

  const fastighet = Array.isArray(kontrollRow.fastigheter)
    ? kontrollRow.fastigheter[0]
    : kontrollRow.fastigheter;
  const kontroll: SbaKontroll = {
    id: kontrollRow.id,
    fastighet_id: kontrollRow.fastighet_id,
    fastighet_namn: fastighet?.namn ?? "",
    kvartal: kontrollRow.kvartal,
    ar: kontrollRow.ar,
    utford_av: kontrollRow.utford_av,
    utford_datum: kontrollRow.utford_datum,
    status: kontrollRow.status,
  };

  const slug = fastighetSlug(kontroll.fastighet_namn);

  const [{ data: punkterData }, { data: resultatData }, { data: anmarkningarData }, { data: portarData }] =
    await Promise.all([
      supabase
        .from("sba_kontrollpunkter")
        .select("id, text, galler_fastighet, ordning")
        .eq("aktiv", true)
        .in("galler_fastighet", slug ? ["alla", slug] : ["alla"])
        .order("ordning"),
      supabase
        .from("sba_kontroll_resultat")
        .select("id, kontroll_id, punkt_id, godkand")
        .eq("kontroll_id", id),
      supabase
        .from("sba_anmarkningar")
        .select(
          "id, kontroll_id, punkt_id, port_id, beskrivning, foto_url, status, atgardad_av, atgardad_datum, atgardskommentar, skapad_at, portar(adress)"
        )
        .eq("kontroll_id", id)
        .order("skapad_at", { ascending: false }),
      supabase.from("portar").select("id, adress").eq("fastighet_id", kontroll.fastighet_id).order("ordning"),
    ]);

  const kontrollpunkter: SbaKontrollpunkt[] = punkterData ?? [];
  const resultat: SbaKontrollResultat[] = resultatData ?? [];
  const anmarkningar: (SbaAnmarkning & { port_adress: string | null })[] = (anmarkningarData ?? []).map(
    (row) => {
      const port = Array.isArray(row.portar) ? row.portar[0] : row.portar;
      return { ...row, port_adress: port?.adress ?? null };
    }
  );
  const portar = portarData ?? [];

  const kanRedigeraKontroll = profil?.roll === "styrelse" || profil?.roll === "brandskyddsansvarig";
  const kanAtgardaAnmarkning =
    profil?.roll === "styrelse" || profil?.roll === "brandskyddsansvarig" || profil?.roll === "entreprenör";

  return (
    <KontrollClient
      kontroll={kontroll}
      kontrollpunkter={kontrollpunkter}
      initialResultat={resultat}
      initialAnmarkningar={anmarkningar}
      portar={portar}
      kanRedigeraKontroll={kanRedigeraKontroll}
      kanAtgardaAnmarkning={kanAtgardaAnmarkning}
      currentProfilId={profil?.id ?? null}
    />
  );
}
