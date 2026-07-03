import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { farSe } from "@/lib/permissions";
import { Hjalp } from "@/components/Hjalp";
import { SidbakgrundBild } from "@/components/SidbakgrundBild";
import type { SbaKontroll } from "@/lib/supabase/types";

export default async function SbaPage() {
  const supabase = await createClient();
  const profil = await getCurrentProfile();

  if (!farSe("sba", profil?.roll)) {
    redirect("/");
  }

  const kanSkapa = profil?.roll === "styrelse" || profil?.roll === "brandskyddsansvarig";

  const { data, error } = await supabase
    .from("sba_kontroller")
    .select("id, fastighet_id, kvartal, ar, utford_av, utford_datum, status, fastigheter(namn)")
    .order("ar", { ascending: false })
    .order("kvartal", { ascending: false });

  if (error) {
    return <div className="p-8 text-sm text-red-600">Kunde inte hämta SBA-kontroller: {error.message}</div>;
  }

  const kontroller: SbaKontroll[] = (data ?? []).map((row) => {
    const fastighet = Array.isArray(row.fastigheter) ? row.fastigheter[0] : row.fastigheter;
    return {
      id: row.id,
      fastighet_id: row.fastighet_id,
      fastighet_namn: fastighet?.namn ?? "",
      kvartal: row.kvartal,
      ar: row.ar,
      utford_av: row.utford_av,
      utford_av_namn: null,
      utford_datum: row.utford_datum,
      status: row.status,
    };
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-stone-50 px-4 py-6 sm:px-6 sm:py-10">
      <SidbakgrundBild />
      <div className="relative mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/" className="text-sm text-stone-600 underline hover:text-stone-800">
              ← Startsida
            </Link>
            <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold text-stone-800">
              Systematiskt brandskyddsarbete
              <Hjalp text="Lista över alla SBA-kontroller (kvartalsvisa brandskyddsronderingar) per fastighet. Klicka på en rad för att se/fylla i checklistan. En kontroll som markerats klar går inte att ändra." />
            </h1>
          </div>
          {kanSkapa && (
            <Link
              href="/sba/ny"
              className="rounded-md bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
            >
              Ny kontroll
            </Link>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border border-stone-200 bg-white">
          <div className="hidden grid-cols-[100px_1fr_100px_140px_100px] gap-2 border-b border-stone-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-600 sm:grid">
            <div>Kvartal</div>
            <div>Fastighet</div>
            <div>År</div>
            <div>Utförd</div>
            <div>Status</div>
          </div>
          {kontroller.length === 0 && (
            <div className="px-4 py-6 text-sm text-stone-600">Inga kontroller registrerade ännu.</div>
          )}
          {kontroller.map((k) => (
            <Link key={k.id} href={`/sba/${k.id}`} className="block border-b border-stone-100 px-4 py-3 text-sm hover:bg-stone-50">
              {/* Mobil */}
              <div className="flex items-center justify-between sm:hidden">
                <div>
                  <div className="font-medium text-stone-800">
                    {k.fastighet_namn} · Q{k.kvartal} {k.ar}
                  </div>
                  <div className="text-xs text-stone-600">Utförd: {k.utford_datum ?? "—"}</div>
                </div>
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-xs " +
                    (k.status === "klar" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800")
                  }
                >
                  {k.status}
                </span>
              </div>
              {/* Desktop */}
              <div className="hidden grid-cols-[100px_1fr_100px_140px_100px] items-center gap-2 sm:grid">
                <div>Q{k.kvartal}</div>
                <div>{k.fastighet_namn}</div>
                <div>{k.ar}</div>
                <div>{k.utford_datum ?? "—"}</div>
                <div>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-xs " +
                      (k.status === "klar" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800")
                    }
                  >
                    {k.status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
