"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Hjalp } from "@/components/Hjalp";

const CURRENT_YEAR = new Date().getFullYear();

export function NyKontrollForm({ fastigheter }: { fastigheter: { id: string; namn: string }[] }) {
  const router = useRouter();
  const [fastighetId, setFastighetId] = useState(fastigheter[0]?.id ?? "");
  const [kvartal, setKvartal] = useState(1);
  const [ar, setAr] = useState(CURRENT_YEAR);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");

    const supabase = createClient();
    const { data, error } = await supabase
      .from("sba_kontroller")
      .insert({ fastighet_id: fastighetId, kvartal, ar })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        setErrorMsg("Det finns redan en kontroll för den här fastigheten, kvartalet och året. Ändra något av valen ovan.");
      } else {
        setErrorMsg(error.message);
      }
      setSaving(false);
      return;
    }

    router.push(`/sba/${data.id}`);
  }

  return (
    <div className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-md">
        <Link href="/sba" className="text-sm text-stone-600 underline hover:text-stone-700">
          ← Tillbaka
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold text-stone-800">
          Ny SBA-kontroll
          <Hjalp text="Skapar en ny kvartalsvis brandskyddskontroll för vald fastighet. Det går bara att ha en kontroll per fastighet/kvartal/år — checklistan fylls i på nästa sida." />
        </h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-lg border border-stone-200 bg-white p-6">
          <div>
            <label className="block text-sm font-medium text-stone-700">Fastighet</label>
            <select
              value={fastighetId}
              onChange={(e) => setFastighetId(e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            >
              {fastigheter.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.namn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Kvartal</label>
            <select
              value={kvartal}
              onChange={(e) => setKvartal(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            >
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>
                  Q{q}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">År</label>
            <input
              type="number"
              value={ar}
              onChange={(e) => setAr(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
          <button
            type="submit"
            disabled={saving || !fastighetId}
            className="w-full rounded-md bg-stone-800 px-3 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
          >
            {saving ? "Skapar…" : "Skapa kontroll"}
          </button>
        </form>
      </div>
    </div>
  );
}
