"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type {
  SbaAnmarkning,
  SbaKontroll,
  SbaKontrollpunkt,
  SbaKontrollResultat,
} from "@/lib/supabase/types";

type AnmarkningRad = SbaAnmarkning & { port_adress: string | null };

export function KontrollClient({
  kontroll,
  kontrollpunkter,
  initialResultat,
  initialAnmarkningar,
  portar,
  kanRedigeraKontroll,
  kanAtgardaAnmarkning,
  currentProfilId,
}: {
  kontroll: SbaKontroll;
  kontrollpunkter: SbaKontrollpunkt[];
  initialResultat: SbaKontrollResultat[];
  initialAnmarkningar: AnmarkningRad[];
  portar: { id: string; adress: string }[];
  kanRedigeraKontroll: boolean;
  kanAtgardaAnmarkning: boolean;
  currentProfilId: string | null;
}) {
  const [resultat, setResultat] = useState(initialResultat);
  const [anmarkningar, setAnmarkningar] = useState(initialAnmarkningar);
  const [status, setStatus] = useState(kontroll.status);
  const [savingPunkt, setSavingPunkt] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [nyBeskrivning, setNyBeskrivning] = useState("");
  const [nyPortId, setNyPortId] = useState("");
  const [nyPunktId, setNyPunktId] = useState("");
  const [savingAnmarkning, setSavingAnmarkning] = useState(false);

  const [atgardarId, setAtgardarId] = useState<string | null>(null);
  const [atgardKommentar, setAtgardKommentar] = useState("");

  function resultatFor(punktId: string) {
    return resultat.find((r) => r.punkt_id === punktId)?.godkand ?? null;
  }

  async function setGodkand(punktId: string, godkand: boolean) {
    setSavingPunkt(punktId);
    setErrorMsg("");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("sba_kontroll_resultat")
      .upsert({ kontroll_id: kontroll.id, punkt_id: punktId, godkand }, { onConflict: "kontroll_id,punkt_id" })
      .select("id, kontroll_id, punkt_id, godkand")
      .single();

    if (error) {
      setErrorMsg(
        `Kunde inte spara: ${error.message}. Om punkten redan var ifylld kan det bero på att UPDATE-policyn för sba_kontroll_resultat (migration 003) inte körts än.`
      );
      setSavingPunkt(null);
      return;
    }

    setResultat((prev) => [...prev.filter((r) => r.punkt_id !== punktId), data]);
    setSavingPunkt(null);
  }

  async function markeraKlar() {
    const supabase = createClient();
    const { error } = await supabase
      .from("sba_kontroller")
      .update({ status: "klar", utford_av: currentProfilId, utford_datum: new Date().toISOString().slice(0, 10) })
      .eq("id", kontroll.id);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setStatus("klar");
  }

  async function laggTillAnmarkning(e: React.FormEvent) {
    e.preventDefault();
    if (!nyBeskrivning.trim()) return;
    setSavingAnmarkning(true);
    setErrorMsg("");

    const supabase = createClient();
    const { data, error } = await supabase
      .from("sba_anmarkningar")
      .insert({
        kontroll_id: kontroll.id,
        punkt_id: nyPunktId || null,
        port_id: nyPortId || null,
        beskrivning: nyBeskrivning.trim(),
      })
      .select("id, kontroll_id, punkt_id, port_id, beskrivning, foto_url, status, atgardad_av, atgardad_datum, atgardskommentar, skapad_at")
      .single();

    if (error) {
      setErrorMsg(error.message);
      setSavingAnmarkning(false);
      return;
    }

    const port = portar.find((p) => p.id === data.port_id);
    setAnmarkningar((prev) => [{ ...data, port_adress: port?.adress ?? null }, ...prev]);
    setNyBeskrivning("");
    setNyPortId("");
    setNyPunktId("");
    setSavingAnmarkning(false);
  }

  async function atgardaAnmarkning(id: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("sba_anmarkningar")
      .update({
        status: "åtgärdad",
        atgardad_av: currentProfilId,
        atgardad_datum: new Date().toISOString().slice(0, 10),
        atgardskommentar: atgardKommentar.trim() || null,
      })
      .eq("id", id)
      .select("id, kontroll_id, punkt_id, port_id, beskrivning, foto_url, status, atgardad_av, atgardad_datum, atgardskommentar, skapad_at")
      .single();

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setAnmarkningar((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...data, port_adress: a.port_adress } : a))
    );
    setAtgardarId(null);
    setAtgardKommentar("");
  }

  return (
    <div className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/sba" className="text-sm text-stone-500 underline hover:text-stone-700">
          ← Alla kontroller
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-stone-800">
            {kontroll.fastighet_namn} · Q{kontroll.kvartal} {kontroll.ar}
          </h1>
          <div className="flex items-center gap-3">
            <span
              className={
                "rounded-full px-2 py-0.5 text-xs " +
                (status === "klar" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800")
              }
            >
              {status}
            </span>
            {kanRedigeraKontroll && status !== "klar" && (
              <button
                onClick={markeraKlar}
                className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
              >
                Markera klar
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-stone-500">Checklista</h2>
        <div className="mt-2 overflow-hidden rounded-lg border border-stone-200 bg-white">
          {kontrollpunkter.length === 0 && (
            <div className="px-4 py-6 text-sm text-stone-500">Inga checklistepunkter registrerade.</div>
          )}
          {kontrollpunkter.map((p) => {
            const varde = resultatFor(p.id);
            return (
              <div key={p.id} className="flex items-center justify-between gap-4 border-b border-stone-100 px-4 py-3 text-sm">
                <span>{p.text}</span>
                {kanRedigeraKontroll ? (
                  <div className="flex shrink-0 gap-2">
                    <button
                      disabled={savingPunkt === p.id}
                      onClick={() => setGodkand(p.id, true)}
                      className={
                        "rounded-md border px-2 py-1 text-xs " +
                        (varde === true
                          ? "border-green-600 bg-green-600 text-white"
                          : "border-stone-300 bg-white hover:bg-stone-50")
                      }
                    >
                      Godkänd
                    </button>
                    <button
                      disabled={savingPunkt === p.id}
                      onClick={() => setGodkand(p.id, false)}
                      className={
                        "rounded-md border px-2 py-1 text-xs " +
                        (varde === false
                          ? "border-red-600 bg-red-600 text-white"
                          : "border-stone-300 bg-white hover:bg-stone-50")
                      }
                    >
                      Ej godkänd
                    </button>
                  </div>
                ) : (
                  <span className="shrink-0 text-xs text-stone-500">
                    {varde === true ? "Godkänd" : varde === false ? "Ej godkänd" : "Ej bedömd"}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-stone-500">Anmärkningar</h2>
        <div className="mt-2 space-y-3">
          {anmarkningar.length === 0 && (
            <div className="rounded-lg border border-stone-200 bg-white px-4 py-6 text-sm text-stone-500">
              Inga anmärkningar registrerade.
            </div>
          )}
          {anmarkningar.map((a) => (
            <div key={a.id} className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p>{a.beskrivning}</p>
                  {a.port_adress && <p className="mt-1 text-xs text-stone-500">{a.port_adress}</p>}
                  {a.status === "åtgärdad" && a.atgardskommentar && (
                    <p className="mt-1 text-xs text-green-700">Åtgärd: {a.atgardskommentar}</p>
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

              {a.status === "öppen" && kanAtgardaAnmarkning && (
                <div className="mt-3">
                  {atgardarId === a.id ? (
                    <div className="flex gap-2">
                      <input
                        value={atgardKommentar}
                        onChange={(e) => setAtgardKommentar(e.target.value)}
                        placeholder="Kommentar om åtgärden (valfritt)"
                        className="flex-1 rounded-md border border-stone-300 px-2 py-1 text-xs"
                      />
                      <button
                        onClick={() => atgardaAnmarkning(a.id)}
                        className="rounded-md bg-stone-800 px-3 py-1 text-xs text-white hover:bg-stone-700"
                      >
                        Spara
                      </button>
                      <button
                        onClick={() => setAtgardarId(null)}
                        className="rounded-md border border-stone-300 px-3 py-1 text-xs hover:bg-stone-50"
                      >
                        Avbryt
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAtgardarId(a.id)}
                      className="rounded-md border border-stone-300 px-3 py-1 text-xs hover:bg-stone-50"
                    >
                      Markera åtgärdad
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {kanRedigeraKontroll && (
          <form
            onSubmit={laggTillAnmarkning}
            className="mt-4 space-y-3 rounded-lg border border-stone-200 bg-white p-4"
          >
            <div className="text-sm font-medium text-stone-700">Ny anmärkning</div>
            <textarea
              value={nyBeskrivning}
              onChange={(e) => setNyBeskrivning(e.target.value)}
              placeholder="Beskrivning av anmärkningen"
              rows={2}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-3">
              <select
                value={nyPortId}
                onChange={(e) => setNyPortId(e.target.value)}
                className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm"
              >
                <option value="">Ingen specifik port</option>
                {portar.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.adress}
                  </option>
                ))}
              </select>
              <select
                value={nyPunktId}
                onChange={(e) => setNyPunktId(e.target.value)}
                className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm"
              >
                <option value="">Ingen specifik checklistepunkt</option>
                {kontrollpunkter.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.text}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={savingAnmarkning || !nyBeskrivning.trim()}
              className="rounded-md bg-stone-800 px-3 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
            >
              {savingAnmarkning ? "Sparar…" : "Lägg till anmärkning"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
