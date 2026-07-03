"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ImageIcon, Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  SbaAnmarkning,
  SbaKontroll,
  SbaKontrollpunkt,
  SbaKontrollResultat,
} from "@/lib/supabase/types";

type AnmarkningRad = SbaAnmarkning & { port_adress: string | null };

function Foto({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.storage
      .from("sba-foton")
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (!cancelled && data) setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!url) return <span className="text-xs text-stone-500">Laddar bild…</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Foto på anmärkning" className="h-24 w-24 rounded-md border border-stone-200 object-cover" />
    </a>
  );
}

async function ladda_upp_foto(kontrollId: string, file: File): Promise<string | null> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${kontrollId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("sba-foton").upload(path, file);
  if (error) throw error;
  return path;
}

function AnmarkningKort({
  a,
  kanAtgardaAnmarkning,
  onAtgarda,
}: {
  a: AnmarkningRad;
  kanAtgardaAnmarkning: boolean;
  onAtgarda: (id: string, kommentar: string) => void;
}) {
  const [redigerar, setRedigerar] = useState(false);
  const [kommentar, setKommentar] = useState("");

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-stone-800">{a.beskrivning}</p>
          {a.port_adress && <p className="mt-0.5 text-xs text-stone-500">{a.port_adress}</p>}
          {a.foto_url && <Foto path={a.foto_url} />}
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
          {redigerar ? (
            <div className="flex flex-wrap gap-2">
              <input
                value={kommentar}
                onChange={(e) => setKommentar(e.target.value)}
                placeholder="Kommentar om åtgärden (valfritt)"
                className="min-w-0 flex-1 rounded-md border border-stone-300 px-2 py-1 text-xs"
              />
              <button
                onClick={() => onAtgarda(a.id, kommentar)}
                className="rounded-md bg-stone-800 px-3 py-1 text-xs text-white hover:bg-stone-700"
              >
                Spara
              </button>
              <button
                onClick={() => setRedigerar(false)}
                className="rounded-md border border-stone-300 px-3 py-1 text-xs hover:bg-stone-50"
              >
                Avbryt
              </button>
            </div>
          ) : (
            <button
              onClick={() => setRedigerar(true)}
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

function NyAnmarkningForm({
  kontrollId,
  punktId,
  portar,
  onSkapad,
  onAvbryt,
}: {
  kontrollId: string;
  punktId: string | null;
  portar: { id: string; adress: string }[];
  onSkapad: (a: AnmarkningRad) => void;
  onAvbryt?: () => void;
}) {
  const [beskrivning, setBeskrivning] = useState("");
  const [portId, setPortId] = useState("");
  const [fil, setFil] = useState<File | null>(null);
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!beskrivning.trim()) return;
    setSparar(true);
    setFel("");

    try {
      let fotoPath: string | null = null;
      if (fil) fotoPath = await ladda_upp_foto(kontrollId, fil);

      const supabase = createClient();
      const { data, error } = await supabase
        .from("sba_anmarkningar")
        .insert({
          kontroll_id: kontrollId,
          punkt_id: punktId,
          port_id: portId || null,
          beskrivning: beskrivning.trim(),
          foto_url: fotoPath,
        })
        .select(
          "id, kontroll_id, punkt_id, port_id, beskrivning, foto_url, status, atgardad_av, atgardad_datum, atgardskommentar, skapad_at"
        )
        .single();

      if (error) throw error;

      const port = portar.find((p) => p.id === data.port_id);
      onSkapad({ ...data, port_adress: port?.adress ?? null });
      setBeskrivning("");
      setPortId("");
      setFil(null);
    } catch (err) {
      setFel(err instanceof Error ? err.message : "Kunde inte spara anmärkningen");
    } finally {
      setSparar(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border border-stone-200 bg-white p-3">
      <textarea
        value={beskrivning}
        onChange={(e) => setBeskrivning(e.target.value)}
        placeholder="Beskrivning av anmärkningen"
        rows={2}
        className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        {portar.length > 0 && (
          <select
            value={portId}
            onChange={(e) => setPortId(e.target.value)}
            className="rounded-md border border-stone-300 px-2 py-1.5 text-sm"
          >
            <option value="">Ingen specifik port</option>
            {portar.map((p) => (
              <option key={p.id} value={p.id}>
                {p.adress}
              </option>
            ))}
          </select>
        )}
        <label className="flex cursor-pointer items-center gap-1 rounded-md border border-stone-300 px-2 py-1.5 text-sm text-stone-600 hover:bg-stone-50">
          <Paperclip size={14} />
          {fil ? fil.name.slice(0, 18) : "Bifoga bild"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => setFil(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      {fel && <p className="text-xs text-red-600">{fel}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={sparar || !beskrivning.trim()}
          className="rounded-md bg-stone-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
        >
          {sparar ? "Sparar…" : "Lägg till anmärkning"}
        </button>
        {onAvbryt && (
          <button
            type="button"
            onClick={onAvbryt}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            Avbryt
          </button>
        )}
      </div>
    </form>
  );
}

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
  const [formForPunkt, setFormForPunkt] = useState<string | null>(null);
  const [visaAllmanForm, setVisaAllmanForm] = useState(false);

  function resultatFor(punktId: string) {
    return resultat.find((r) => r.punkt_id === punktId)?.godkand ?? null;
  }
  function anmarkningarFor(punktId: string | null) {
    return anmarkningar.filter((a) => a.punkt_id === punktId);
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
      setErrorMsg(`Kunde inte spara: ${error.message}`);
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

  async function atgardaAnmarkning(id: string, kommentar: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("sba_anmarkningar")
      .update({
        status: "åtgärdad",
        atgardad_av: currentProfilId,
        atgardad_datum: new Date().toISOString().slice(0, 10),
        atgardskommentar: kommentar.trim() || null,
      })
      .eq("id", id)
      .select(
        "id, kontroll_id, punkt_id, port_id, beskrivning, foto_url, status, atgardad_av, atgardad_datum, atgardskommentar, skapad_at"
      )
      .single();

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setAnmarkningar((prev) => prev.map((a) => (a.id === id ? { ...a, ...data, port_adress: a.port_adress } : a)));
  }

  const allmannaAnmarkningar = anmarkningarFor(null);

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/sba" className="text-sm text-stone-600 underline hover:text-stone-800">
          ← Alla kontroller
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-stone-800 sm:text-xl">
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

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-stone-600">Checklista</h2>
        <div className="mt-2 space-y-2">
          {kontrollpunkter.length === 0 && (
            <div className="rounded-lg border border-stone-200 bg-white px-4 py-6 text-sm text-stone-600">
              Inga checklistepunkter registrerade.
            </div>
          )}
          {kontrollpunkter.map((p) => {
            const varde = resultatFor(p.id);
            const punktAnmarkningar = anmarkningarFor(p.id);
            return (
              <div key={p.id} className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-stone-800">{p.text}</span>
                  {kanRedigeraKontroll ? (
                    <div className="flex shrink-0 gap-2">
                      <button
                        disabled={savingPunkt === p.id}
                        onClick={() => setGodkand(p.id, true)}
                        className={
                          "rounded-md border px-2 py-1 text-xs " +
                          (varde === true
                            ? "border-green-600 bg-green-600 text-white"
                            : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50")
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
                            : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50")
                        }
                      >
                        Ej godkänd
                      </button>
                    </div>
                  ) : (
                    <span className="shrink-0 text-xs text-stone-600">
                      {varde === true ? "Godkänd" : varde === false ? "Ej godkänd" : "Ej bedömd"}
                    </span>
                  )}
                </div>

                {punktAnmarkningar.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {punktAnmarkningar.map((a) => (
                      <AnmarkningKort key={a.id} a={a} kanAtgardaAnmarkning={kanAtgardaAnmarkning} onAtgarda={atgardaAnmarkning} />
                    ))}
                  </div>
                )}

                {kanRedigeraKontroll && (
                  <div className="mt-2">
                    {formForPunkt === p.id ? (
                      <NyAnmarkningForm
                        kontrollId={kontroll.id}
                        punktId={p.id}
                        portar={portar}
                        onSkapad={(a) => {
                          setAnmarkningar((prev) => [a, ...prev]);
                          setFormForPunkt(null);
                        }}
                        onAvbryt={() => setFormForPunkt(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setFormForPunkt(p.id)}
                        className="flex items-center gap-1 text-xs text-stone-600 underline hover:text-stone-800"
                      >
                        <ImageIcon size={12} /> Lägg till anmärkning
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-stone-600">
          Övriga anmärkningar
        </h2>
        <p className="mt-1 text-xs text-stone-500">Anmärkningar som inte hör till en specifik checklistpunkt.</p>
        <div className="mt-2 space-y-2">
          {allmannaAnmarkningar.length === 0 && (
            <div className="rounded-lg border border-stone-200 bg-white px-4 py-6 text-sm text-stone-600">
              Inga övriga anmärkningar.
            </div>
          )}
          {allmannaAnmarkningar.map((a) => (
            <AnmarkningKort key={a.id} a={a} kanAtgardaAnmarkning={kanAtgardaAnmarkning} onAtgarda={atgardaAnmarkning} />
          ))}
        </div>

        {kanRedigeraKontroll && (
          <div className="mt-2">
            {visaAllmanForm ? (
              <NyAnmarkningForm
                kontrollId={kontroll.id}
                punktId={null}
                portar={portar}
                onSkapad={(a) => {
                  setAnmarkningar((prev) => [a, ...prev]);
                  setVisaAllmanForm(false);
                }}
                onAvbryt={() => setVisaAllmanForm(false)}
              />
            ) : (
              <button
                onClick={() => setVisaAllmanForm(true)}
                className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
              >
                Lägg till övrig anmärkning
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
