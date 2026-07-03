import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import type { UhPost } from "@/lib/supabase/types";
import { UnderhallsplanClient } from "./UnderhallsplanClient";

export default async function UnderhallsplanPage() {
  const supabase = await createClient();
  const profil = await getCurrentProfile();

  const { data, error } = await supabase
    .from("uh_poster")
    .select(
      "id, fastighet_id, lage, namn, ar, investering, underhall, typ, status, fastigheter(namn), uh_kategorier(namn)"
    )
    .eq("status", "godkänd")
    .order("ar", { ascending: true });

  if (error) {
    return (
      <div className="p-8 text-sm text-red-600">
        Kunde inte hämta underhållsplanen: {error.message}
      </div>
    );
  }

  const items: UhPost[] = (data ?? []).map((row) => {
    const fastighet = Array.isArray(row.fastigheter) ? row.fastigheter[0] : row.fastigheter;
    const kategori = Array.isArray(row.uh_kategorier) ? row.uh_kategorier[0] : row.uh_kategorier;
    return {
      id: row.id,
      fastighet_id: row.fastighet_id,
      fastighet_namn: fastighet?.namn ?? "Gemensam",
      kategori_id: null,
      kategori_namn: kategori?.namn ?? null,
      lage: row.lage,
      namn: row.namn,
      ar: row.ar,
      investering: Number(row.investering),
      underhall: Number(row.underhall),
      typ: row.typ,
      status: row.status,
    };
  });

  return <UnderhallsplanClient initialItems={items} kanRedigera={profil?.roll === "styrelse"} />;
}
