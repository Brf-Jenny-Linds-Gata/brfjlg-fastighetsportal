import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { farSe } from "@/lib/permissions";
import type { UhPost } from "@/lib/supabase/types";
import { UnderhallsplanClient } from "./UnderhallsplanClient";

export default async function UnderhallsplanPage() {
  const supabase = await createClient();
  const profil = await getCurrentProfile();

  if (!farSe("underhallsplan", profil?.roll)) {
    redirect("/");
  }

  const [{ data, error }, { data: fastigheter }, { data: kategorier }] = await Promise.all([
    supabase
      .from("uh_poster")
      .select(
        "id, fastighet_id, kategori_id, lage, namn, ar, investering, underhall, typ, status, genomford_datum, aterkommande_intervall_ar, uppdaterad_at, fastigheter(namn), uh_kategorier(namn)"
      )
      .eq("status", "godkänd")
      .order("ar", { ascending: true }),
    supabase.from("fastigheter").select("id, namn").order("namn"),
    supabase.from("uh_kategorier").select("id, namn").order("namn"),
  ]);

  if (error) {
    return (
      <div className="p-8 text-sm text-red-600">
        Kunde inte hämta underhållsplanen: {error.message}
      </div>
    );
  }

  const senastUppdaterad = (data ?? []).reduce<string | null>((max, row) => {
    if (!row.uppdaterad_at) return max;
    return !max || row.uppdaterad_at > max ? row.uppdaterad_at : max;
  }, null);

  const items: UhPost[] = (data ?? []).map((row) => {
    const fastighet = Array.isArray(row.fastigheter) ? row.fastigheter[0] : row.fastigheter;
    const kategori = Array.isArray(row.uh_kategorier) ? row.uh_kategorier[0] : row.uh_kategorier;
    return {
      id: row.id,
      fastighet_id: row.fastighet_id,
      fastighet_namn: fastighet?.namn ?? "Gemensam",
      kategori_id: row.kategori_id,
      kategori_namn: kategori?.namn ?? null,
      lage: row.lage,
      namn: row.namn,
      ar: row.ar,
      investering: Number(row.investering),
      underhall: Number(row.underhall),
      typ: row.typ,
      status: row.status,
      genomford_datum: row.genomford_datum,
      aterkommande_intervall_ar: row.aterkommande_intervall_ar,
    };
  });

  return (
    <UnderhallsplanClient
      initialItems={items}
      kanRedigera={profil?.roll === "styrelse"}
      fastigheter={fastigheter ?? []}
      kategorier={kategorier ?? []}
      currentProfilId={profil?.id ?? null}
      senastUppdaterad={senastUppdaterad}
    />
  );
}
