"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Anmarkning = {
  id: string;
  kontroll_id: string;
  beskrivning: string;
  foto_url: string | null;
  status: "öppen" | "åtgärdad";
  atgardad_datum: string | null;
  atgardad_av_namn: string | null;
  atgardskommentar: string | null;
  port_adress: string | null;
  punkt_text: string | null;
  kontroll_last: boolean;
  kontroll_kontext: string;
};

export function AnmarkningarClient({
  initialAnmarkningar,
  currentProfilId,
  currentProfilNamn,
}: {
  initialAnmarkningar: Anmarkning[];
  currentProfilId: string | null;
  currentProfilNamn: string | null;
}) {
  const [anmarkningar, setAnmarkningar] = useState(initialAnmarkningar);
  const [redigerarId, setRedigerarId] = useState<string | null>(null);
  const [kommentar, setKommentar] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const oppna = anmarkningar.filter((a) => a.status === "öppen");
  const atgardade = anmarkningar.filter((a) => a.status === "åtgärdad");

  async function atgarda(id: string) {
    setErrorMsg("");
    const idag = new Date().toISOString().slice(0, 10);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("sba_anmarkningar")
      .update({
        status: "åtgärdad",
        atgardad_av: currentProfilId,
        atgardad_datum: idag,
        atgardskommentar: kommentar.trim() || null,
      })
      .eq("id", id)
      .select("id, status, atgardad_datum, atgardskommentar")
      .single();

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setAnmarkningar((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...data, atgardad_av_namn: currentProfilNamn } : a))
    );
    setRedigerarId(null);
    setKommentar("");
  }

  function Kort({ a }: { a: Anmarkning }) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{a.kontroll_kontext}</p>
            <p className="mt-1 text-stone-800">{a.beskrivning}</p>
            <p className="mt-1 text-xs text-stone-600">
              {[a.punkt_text, a.port_adress].filter(Boolean).join(" · ") || "Ingen specifik plats angiven"}
            </p>
            {a.status === "åtgärdad" && (
              <p className="mt-1 text-xs text-green-700">
                Åtgärdad av {a.atgardad_av_namn ?? "okänd"}
                {a.atgardad_datum ? ` den ${a.atgardad_datum}` : ""}
                {a.atgardskommentar ? ` — ${a.atgardskommentar}` : ""}
              </p>
            )}
          </div>
          <span
            className={
              "shrink-0 rounded-full px-2 py-0.5 text-xs " +
              (a.status === "åtgärdad" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")
            }
          >
            {a.status}
          </span>
        </div>

        {a.status === "öppen" && a.kontroll_last && (
          <p className="mt-3 text-xs text-stone-500">
            Protokollet den här anmärkningen hör till är klarmarkerat och låst.
          </p>
        )}

        {a.status === "öppen" && !a.kontroll_last && (
          <div className="mt-3">
            {redigerarId === a.id ? (
              <div className="flex flex-wrap gap-2">
                <input
                  value={kommentar}
                  onChange={(e) => setKommentar(e.target.value)}
                  placeholder="Kommentar om åtgärden (valfritt)"
                  className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-900"
                />
                <button
                  onClick={() => atgarda(a.id)}
                  className="rounded-md bg-stone-800 px-3 py-1 text-xs text-white hover:bg-stone-700"
                >
                  Spara
                </button>
                <button
                  onClick={() => setRedigerarId(null)}
                  className="rounded-md border border-stone-300 px-3 py-1 text-xs hover:bg-stone-50"
                >
                  Avbryt
                </button>
              </div>
            ) : (
              <button
                onClick={() => setRedigerarId(a.id)}
                className="rounded-md border border-stone-300 px-3 py-1 text-xs hover:bg-stone-50"
              >
                Markera åtgärdad
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-stone-600 underline hover:text-stone-800">
          ← Startsida
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-stone-800">Anmärkningar att åtgärda</h1>

        {errorMsg && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-stone-600">
          Öppna ({oppna.length})
        </h2>
        <div className="mt-2 space-y-2">
          {oppna.length === 0 && (
            <div className="rounded-lg border border-stone-200 bg-white px-4 py-6 text-sm text-stone-600">
              Inga öppna anmärkningar just nu.
            </div>
          )}
          {oppna.map((a) => (
            <Kort key={a.id} a={a} />
          ))}
        </div>

        {atgardade.length > 0 && (
          <>
            <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-stone-600">
              Åtgärdade ({atgardade.length})
            </h2>
            <div className="mt-2 space-y-2">
              {atgardade.map((a) => (
                <Kort key={a.id} a={a} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
