"use client";

import Link from "next/link";
import { Hjalp } from "@/components/Hjalp";
import { SidbakgrundBild } from "@/components/SidbakgrundBild";

type LoggRad = {
  id: string;
  tidpunkt: string;
  falt: string;
  gammaltVarde: string | null;
  nyttVarde: string | null;
  postNamn: string;
  andradAvNamn: string;
};

const FALT_NAMN: Record<string, string> = {
  ar: "År",
  investering: "Investering",
  underhall: "Underhåll",
  status: "Status",
  namn: "Namn",
  fastighet: "Fastighet",
  kategori: "Kategori",
  genomförd: "Genomförd",
};

function formatTidpunkt(iso: string) {
  return new Date(iso).toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" });
}

function formatVarde(falt: string, varde: string | null) {
  if (varde === null || varde === "") return "—";
  if (falt === "investering" || falt === "underhall") {
    const n = Number(varde);
    return Number.isFinite(n) ? n.toLocaleString("sv-SE") + " kr" : varde;
  }
  return varde;
}

export function LoggClient({ rader }: { rader: LoggRad[] }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-stone-50 px-4 py-6 sm:px-6 sm:py-10">
      <SidbakgrundBild />
      <div className="relative mx-auto max-w-4xl">
        <Link href="/underhallsplan" className="text-sm text-stone-600 underline hover:text-stone-800">
          ← Underhållsplan
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold text-stone-800">
          Ändringslogg
          <Hjalp text="Visar de senaste ändringarna i underhållsplanen: vad som ändrades, från vilket till vilket värde, samt vem som gjorde ändringen och när. Ändringar loggas automatiskt av databasen." />
        </h1>

        {rader.length === 0 ? (
          <div className="mt-6 rounded-lg border border-stone-200 bg-white px-4 py-6 text-sm text-stone-600">
            Inga ändringar loggade ännu.
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-lg border border-stone-200 bg-white">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
                  <th className="px-4 py-2 font-semibold">Tidpunkt</th>
                  <th className="px-4 py-2 font-semibold">Post</th>
                  <th className="px-4 py-2 font-semibold">Fält</th>
                  <th className="px-4 py-2 font-semibold">Från</th>
                  <th className="px-4 py-2 font-semibold">Till</th>
                  <th className="px-4 py-2 font-semibold">Ändrad av</th>
                </tr>
              </thead>
              <tbody>
                {rader.map((r) => (
                  <tr key={r.id} className="border-b border-stone-100 align-top last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-stone-600">{formatTidpunkt(r.tidpunkt)}</td>
                    <td className="px-4 py-3 font-medium text-stone-800">{r.postNamn}</td>
                    <td className="px-4 py-3 text-stone-700">{FALT_NAMN[r.falt] ?? r.falt}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-stone-600">{formatVarde(r.falt, r.gammaltVarde)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-stone-800">{formatVarde(r.falt, r.nyttVarde)}</td>
                    <td className="px-4 py-3 text-xs text-stone-600">{r.andradAvNamn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
