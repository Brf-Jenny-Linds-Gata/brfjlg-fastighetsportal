import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { farSe } from "@/lib/permissions";
import { AnmarkningarClient } from "./AnmarkningarClient";

export default async function AnmarkningarPage() {
  const supabase = await createClient();
  const profil = await getCurrentProfile();

  if (!farSe("anmarkningar", profil?.roll)) {
    redirect("/");
  }

  const { data, error } = await supabase
    .from("sba_anmarkningar")
    .select(
      "id, kontroll_id, punkt_id, port_id, beskrivning, foto_url, status, atgardad_av, atgardad_datum, atgardskommentar, skapad_at, portar(adress), sba_kontrollpunkter(text), sba_kontroller(kvartal, ar, status, fastigheter(namn)), profiler(namn)"
    )
    .order("status", { ascending: true })
    .order("skapad_at", { ascending: false });

  if (error) {
    return <div className="p-8 text-sm text-red-600">Kunde inte hämta anmärkningar: {error.message}</div>;
  }

  const anmarkningar = (data ?? []).map((row) => {
    const port = Array.isArray(row.portar) ? row.portar[0] : row.portar;
    const punkt = Array.isArray(row.sba_kontrollpunkter) ? row.sba_kontrollpunkter[0] : row.sba_kontrollpunkter;
    const kontroll = Array.isArray(row.sba_kontroller) ? row.sba_kontroller[0] : row.sba_kontroller;
    const fastighet = kontroll ? (Array.isArray(kontroll.fastigheter) ? kontroll.fastigheter[0] : kontroll.fastigheter) : null;
    const atgardare = Array.isArray(row.profiler) ? row.profiler[0] : row.profiler;
    return {
      id: row.id,
      kontroll_id: row.kontroll_id,
      beskrivning: row.beskrivning,
      foto_url: row.foto_url,
      status: row.status,
      atgardad_datum: row.atgardad_datum,
      atgardad_av_namn: atgardare?.namn ?? null,
      atgardskommentar: row.atgardskommentar,
      port_adress: port?.adress ?? null,
      punkt_text: punkt?.text ?? null,
      kontroll_last: kontroll?.status === "klar",
      kontroll_kontext: kontroll ? `${fastighet?.namn ?? "Okänd fastighet"} · Q${kontroll.kvartal} ${kontroll.ar}` : "",
    };
  });

  return <AnmarkningarClient initialAnmarkningar={anmarkningar} currentProfilId={profil?.id ?? null} currentProfilNamn={profil?.namn ?? null} />;
}
