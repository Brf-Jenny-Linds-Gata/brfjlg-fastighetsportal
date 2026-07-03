"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Check,
  X,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  SquarePen,
  CalendarClock,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { UhPost } from "@/lib/supabase/types";

const FASTIGHET_COLOR: Record<string, { dot: string; bg: string; text: string }> = {
  "Spetshandsken 1": { dot: "#a8562f", bg: "#f4e6dd", text: "#7c3d1f" },
  "Tumvanten 1": { dot: "#4a6b4d", bg: "#e3ebe1", text: "#33492f" },
  Gemensam: { dot: "#6b6459", bg: "#ede9e2", text: "#4a453b" },
};

const KATEGORI_PALETTE = [
  "#3d5b3f",
  "#a8562f",
  "#5b4d8a",
  "#2f6b78",
  "#a3813a",
  "#8a3d5c",
  "#4a7a3d",
  "#5c5c8a",
  "#8a5c3d",
  "#3d7a7a",
];

const CURRENT_YEAR = new Date().getFullYear();
const MUTED = "#6b6459";
const MUTED_DASH = "#a19a8c";
const ROW_COLS = "70px 120px 1fr 100px 100px 150px 190px";

function krCompact(n: number) {
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1).replace(".0", "") + " mkr";
  if (Math.abs(n) >= 1000) return Math.round(n / 1000) + " tkr";
  return n + " kr";
}
function kr(n: number) {
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(n) + " kr";
}

function GrafTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div
      className="sans"
      style={{ background: "#fff", border: "1px solid #e4ddd0", borderRadius: 6, padding: "8px 10px", fontSize: 12 }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>År {label}</div>
      {payload
        .filter((p) => (p.value ?? 0) > 0)
        .map((p) => (
          <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 6, color: "#3d382f" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{p.name}</span>
            <span>{kr(p.value ?? 0)}</span>
          </div>
        ))}
      <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px solid #eee5d5", display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
        <span>Totalt</span>
        <span>{kr(total)}</span>
      </div>
    </div>
  );
}

function yearlyTotals(items: UhPost[], fastighetFilter: string, fromYear: number, toYear: number) {
  const filtered =
    fastighetFilter === "Alla" ? items : items.filter((i) => i.fastighet_namn === fastighetFilter);
  const byYear: Record<number, { ar: number; investering: number; underhall: number }> = {};
  for (let y = fromYear; y <= toYear; y++) byYear[y] = { ar: y, investering: 0, underhall: 0 };
  filtered.forEach((it) => {
    if (it.ar >= fromYear && it.ar <= toYear) {
      byYear[it.ar].investering += it.investering;
      byYear[it.ar].underhall += it.underhall;
    }
  });
  return Object.values(byYear);
}

function kategoriStaplat(items: UhPost[], fastighetFilter: string, fromYear: number, toYear: number, kategoriNamn: string[]) {
  const filtered =
    fastighetFilter === "Alla" ? items : items.filter((i) => i.fastighet_namn === fastighetFilter);
  const byYear: Record<number, Record<string, number>> = {};
  for (let y = fromYear; y <= toYear; y++) {
    byYear[y] = { ar: y as unknown as number } as unknown as Record<string, number>;
    kategoriNamn.forEach((k) => (byYear[y][k] = 0));
  }
  filtered.forEach((it) => {
    if (it.ar >= fromYear && it.ar <= toYear) {
      const k = it.kategori_namn ?? "Övrigt";
      byYear[it.ar][k] = (byYear[it.ar][k] ?? 0) + it.investering + it.underhall;
    }
  });
  return Object.entries(byYear)
    .map(([ar, vals]) => ({ ar: Number(ar), ...vals }))
    .sort((a, b) => a.ar - b.ar);
}

function groupByYearAndKategori(items: UhPost[]) {
  const byYear = new Map<number, Map<string, UhPost[]>>();
  for (const item of items) {
    if (!byYear.has(item.ar)) byYear.set(item.ar, new Map());
    const kategori = item.kategori_namn ?? "Övrigt";
    const byKategori = byYear.get(item.ar)!;
    if (!byKategori.has(kategori)) byKategori.set(kategori, []);
    byKategori.get(kategori)!.push(item);
  }
  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ar, byKategori]) => ({
      ar,
      kategorier: [...byKategori.entries()].sort((a, b) => a[0].localeCompare(b[0], "sv")),
    }));
}

type ListPost = { id: string; namn: string };

export function UnderhallsplanClient({
  initialItems,
  kanRedigera,
  fastigheter,
  kategorier,
  currentProfilId,
  senastUppdaterad,
}: {
  initialItems: UhPost[];
  kanRedigera: boolean;
  fastigheter: ListPost[];
  kategorier: ListPost[];
  currentProfilId: string | null;
  senastUppdaterad: string | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [draft, setDraft] = useState(initialItems);
  const [fastighetFilter, setFastighetFilter] = useState("Alla");
  const [grafAr, setGrafAr] = useState(20);
  const [visning, setVisning] = useState<"plan" | "historik">("plan");
  const chartToYear = CURRENT_YEAR + grafAr;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editYear, setEditYear] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [genomforId, setGenomforId] = useState<string | null>(null);
  const [genomforIntervall, setGenomforIntervall] = useState("");
  const [redigerarId, setRedigerarId] = useState<string | null>(null);
  const [redigerNamn, setRedigerNamn] = useState("");
  const [redigerKategoriId, setRedigerKategoriId] = useState("");
  const [redigerInvestering, setRedigerInvestering] = useState("");
  const [redigerUnderhall, setRedigerUnderhall] = useState("");
  const [visaNyForm, setVisaNyForm] = useState(false);

  const hasPending = draft !== items && JSON.stringify(draft) !== JSON.stringify(items);

  const visibleItems = useMemo(() => {
    const list =
      fastighetFilter === "Alla" ? draft : draft.filter((i) => i.fastighet_namn === fastighetFilter);
    return [...list].sort((a, b) => a.ar - b.ar);
  }, [draft, fastighetFilter]);

  // Planen visar bara kommande/ej genomförda poster — historiken (nedan)
  // visar bara genomförda. Annars dubbelräknas samma poster i båda vyerna.
  const planItems = useMemo(() => visibleItems.filter((i) => !i.genomford_datum), [visibleItems]);

  const grouped = useMemo(() => groupByYearAndKategori(planItems), [planItems]);

  const alleKategoriNamn = useMemo(
    () => [...new Set(planItems.map((i) => i.kategori_namn ?? "Övrigt"))].sort((a, b) => a.localeCompare(b, "sv")),
    [planItems]
  );
  const kategoriColor = (namn: string) => KATEGORI_PALETTE[alleKategoriNamn.indexOf(namn) % KATEGORI_PALETTE.length];

  const [expandedYears, setExpandedYears] = useState<Set<number>>(() => {
    const nearest = visibleItems.map((i) => i.ar).find((y) => y >= CURRENT_YEAR);
    return new Set(nearest !== undefined ? [nearest] : []);
  });
  const [collapsedKategorier, setCollapsedKategorier] = useState<Set<string>>(new Set());

  function toggleYear(ar: number) {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(ar)) next.delete(ar);
      else next.add(ar);
      return next;
    });
  }
  function toggleKategori(nyckel: string) {
    setCollapsedKategorier((prev) => {
      const next = new Set(prev);
      if (next.has(nyckel)) next.delete(nyckel);
      else next.add(nyckel);
      return next;
    });
  }

  const itemsForPlan = useMemo(() => items.filter((i) => !i.genomford_datum), [items]);
  const draftForPlan = useMemo(() => draft.filter((i) => !i.genomford_datum), [draft]);

  const totalsCurrent = useMemo(
    () => yearlyTotals(itemsForPlan, fastighetFilter, CURRENT_YEAR, chartToYear),
    [itemsForPlan, fastighetFilter, chartToYear]
  );
  const totalsDraft = useMemo(
    () => yearlyTotals(draftForPlan, fastighetFilter, CURRENT_YEAR, chartToYear),
    [draftForPlan, fastighetFilter, chartToYear]
  );
  const staplatData = useMemo(
    () => kategoriStaplat(itemsForPlan, fastighetFilter, CURRENT_YEAR, chartToYear, alleKategoriNamn),
    [itemsForPlan, fastighetFilter, chartToYear, alleKategoriNamn]
  );

  const chartDataJamfor = totalsCurrent.map((row, idx) => ({
    ar: row.ar,
    "Nuvarande plan": row.investering + row.underhall,
    "Simulerad ändring": hasPending ? totalsDraft[idx].investering + totalsDraft[idx].underhall : undefined,
  }));

  function startEdit(item: UhPost) {
    setEditingId(item.id);
    setEditYear(String(item.ar));
  }
  function commitEdit(item: UhPost) {
    const newYear = parseInt(editYear, 10);
    if (!isNaN(newYear) && newYear >= 2020 && newYear <= 2100) {
      setDraft((prev) => prev.map((i) => (i.id === item.id ? { ...i, ar: newYear } : i)));
    }
    setEditingId(null);
  }
  function cancelEdit() {
    setEditingId(null);
  }

  async function confirmChanges() {
    const changed = draft.filter((d) => {
      const original = items.find((i) => i.id === d.id);
      return original && original.ar !== d.ar;
    });
    if (changed.length === 0) return;

    setSaving(true);
    setSaveError("");
    const supabase = createClient();

    for (const item of changed) {
      const { error } = await supabase
        .from("uh_poster")
        .update({ ar: item.ar, uppdaterad_av: currentProfilId })
        .eq("id", item.id);
      if (error) {
        setSaveError(`Kunde inte spara "${item.namn}": ${error.message}`);
        setSaving(false);
        return;
      }
    }

    setItems(draft);
    setSaving(false);
    setSavedNote("Ändringarna är sparade i underhållsplanen.");
    setTimeout(() => setSavedNote(""), 4000);
  }

  function discardChanges() {
    setDraft(items);
  }

  async function markeraGenomford(item: UhPost) {
    setSaveError("");
    const idag = new Date().toISOString().slice(0, 10);
    const intervall = genomforIntervall ? parseInt(genomforIntervall, 10) : null;
    const supabase = createClient();

    const { error: updateError } = await supabase
      .from("uh_poster")
      .update({ genomford_datum: idag, aterkommande_intervall_ar: intervall, uppdaterad_av: currentProfilId })
      .eq("id", item.id);

    if (updateError) {
      setSaveError(`Kunde inte markera som genomförd: ${updateError.message}`);
      return;
    }

    let nyPost: UhPost | null = null;
    if (intervall && intervall > 0) {
      const { data, error: insertError } = await supabase
        .from("uh_poster")
        .insert({
          fastighet_id: item.fastighet_id,
          kategori_id: item.kategori_id,
          lage: item.lage,
          namn: item.namn,
          ar: item.ar + intervall,
          investering: item.investering,
          underhall: item.underhall,
          typ: item.typ,
          status: "föreslagen",
          skapad_av: currentProfilId,
        })
        .select(
          "id, fastighet_id, lage, namn, ar, investering, underhall, typ, status, genomford_datum, aterkommande_intervall_ar"
        )
        .single();

      if (insertError) {
        setSaveError(`Genomförd sparades, men kunde inte skapa ny post för återkomst: ${insertError.message}`);
      } else if (data) {
        nyPost = {
          ...data,
          kategori_id: item.kategori_id,
          fastighet_namn: item.fastighet_namn,
          kategori_namn: item.kategori_namn,
        };
      }
    }

    const applyUpdate = (list: UhPost[]) => {
      const updated = list.map((i) =>
        i.id === item.id ? { ...i, genomford_datum: idag, aterkommande_intervall_ar: intervall } : i
      );
      return nyPost ? [...updated, nyPost] : updated;
    };
    setItems(applyUpdate);
    setDraft(applyUpdate);
    setGenomforId(null);
    setGenomforIntervall("");
  }

  function startRedigera(item: UhPost) {
    setRedigerarId(item.id);
    setRedigerNamn(item.namn);
    setRedigerKategoriId(item.kategori_id ?? "");
    setRedigerInvestering(String(item.investering));
    setRedigerUnderhall(String(item.underhall));
  }
  function avbrytRedigera() {
    setRedigerarId(null);
  }
  async function sparaRedigera(item: UhPost) {
    setSaveError("");
    const investering = Number(redigerInvestering) || 0;
    const underhall = Number(redigerUnderhall) || 0;
    const kategori = kategorier.find((k) => k.id === redigerKategoriId);

    const supabase = createClient();
    const { error } = await supabase
      .from("uh_poster")
      .update({
        namn: redigerNamn.trim() || item.namn,
        kategori_id: redigerKategoriId || null,
        investering,
        underhall,
        uppdaterad_av: currentProfilId,
      })
      .eq("id", item.id);

    if (error) {
      setSaveError(`Kunde inte spara ändringar: ${error.message}`);
      return;
    }

    const applyUpdate = (list: UhPost[]) =>
      list.map((i) =>
        i.id === item.id
          ? {
              ...i,
              namn: redigerNamn.trim() || item.namn,
              kategori_id: redigerKategoriId || null,
              kategori_namn: kategori?.namn ?? null,
              investering,
              underhall,
            }
          : i
      );
    setItems(applyUpdate);
    setDraft(applyUpdate);
    setRedigerarId(null);
  }

  const historikItems = useMemo(
    () => visibleItems.filter((i) => i.genomford_datum).sort((a, b) => (b.genomford_datum ?? "").localeCompare(a.genomford_datum ?? "")),
    [visibleItems]
  );

  const sammanfattningItems = visning === "plan" ? planItems : historikItems;
  const totalInvestering = sammanfattningItems.reduce((s, i) => s + i.investering, 0);
  const totalUnderhall = sammanfattningItems.reduce((s, i) => s + i.underhall, 0);

  function Rad({ item }: { item: UhPost }) {
    const c = FASTIGHET_COLOR[item.fastighet_namn ?? "Gemensam"] ?? FASTIGHET_COLOR.Gemensam;
    const isEditing = editingId === item.id;
    const isRedigering = redigerarId === item.id;
    const changed = items.find((i) => i.id === item.id)?.ar !== item.ar;
    const kanFlyttas = kanRedigera && item.typ !== "löpande_buffert";
    const arGenomford = !!item.genomford_datum;

    if (isRedigering) {
      return (
        <div className="sans" style={{ borderBottom: "1px solid #f3eee3", padding: "10px 14px", background: "#fdf6ee", fontSize: 13 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <input
              value={redigerNamn}
              onChange={(e) => setRedigerNamn(e.target.value)}
              placeholder="Åtgärd"
              style={{ flex: "1 1 200px", padding: "5px 8px", border: "1px solid #d8cfbe", borderRadius: 4 }}
            />
            <select
              value={redigerKategoriId}
              onChange={(e) => setRedigerKategoriId(e.target.value)}
              style={{ padding: "5px 8px", border: "1px solid #d8cfbe", borderRadius: 4 }}
            >
              <option value="">Ingen kategori</option>
              {kategorier.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.namn}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={redigerInvestering}
              onChange={(e) => setRedigerInvestering(e.target.value)}
              placeholder="Investering"
              style={{ width: 110, padding: "5px 8px", border: "1px solid #d8cfbe", borderRadius: 4 }}
            />
            <input
              type="number"
              value={redigerUnderhall}
              onChange={(e) => setRedigerUnderhall(e.target.value)}
              placeholder="Underhåll"
              style={{ width: 110, padding: "5px 8px", border: "1px solid #d8cfbe", borderRadius: 4 }}
            />
            <button onClick={() => sparaRedigera(item)} style={{ border: "none", background: "none", cursor: "pointer", color: "#3d5b3f" }}>
              <Check size={16} />
            </button>
            <button onClick={avbrytRedigera} style={{ border: "none", background: "none", cursor: "pointer", color: "#9a3232" }}>
              <X size={16} />
            </button>
          </div>
        </div>
      );
    }

    const fastighetBadge = (
      <span
        className="sans"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: c.bg,
          color: c.text,
          borderRadius: 12,
          padding: "2px 8px",
          fontSize: 11,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot }} />
        {item.fastighet_namn}
      </span>
    );

    const arVisning = isEditing ? (
      <input
        autoFocus
        type="number"
        value={editYear}
        onChange={(e) => setEditYear(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitEdit(item);
          if (e.key === "Escape") cancelEdit();
        }}
        className="sans"
        style={{ width: 60, padding: "3px 5px", border: "1px solid #c1592c", borderRadius: 4 }}
      />
    ) : (
      <span style={{ fontWeight: changed ? 700 : 400 }}>{item.ar}</span>
    );

    const knappStil = {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      border: "1px solid #d8cfbe",
      borderRadius: 6,
      background: "#fff",
      color: "#3d382f",
      padding: "3px 8px",
      fontSize: 11,
      cursor: "pointer",
    } as const;

    const atgardsKnappar = (
      <div className="sans" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {kanFlyttas &&
          (isEditing ? (
            <>
              <button onClick={() => commitEdit(item)} style={{ border: "none", background: "none", cursor: "pointer", color: "#3d5b3f" }}>
                <Check size={15} />
              </button>
              <button onClick={cancelEdit} style={{ border: "none", background: "none", cursor: "pointer", color: "#9a3232" }}>
                <X size={15} />
              </button>
            </>
          ) : (
            <button onClick={() => startEdit(item)} style={knappStil} title="Flytta åtgärden till ett annat år">
              <CalendarClock size={13} /> Flytta år
            </button>
          ))}
        {kanRedigera && !isEditing && (
          <button
            onClick={() => startRedigera(item)}
            style={knappStil}
            title="Redigera namn, kategori och kostnad"
          >
            <SquarePen size={13} /> Redigera
          </button>
        )}
      </div>
    );

    const genomfordAktion = kanRedigera ? (
      arGenomford ? (
        <span
          className="sans"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#3d5b3f" }}
        >
          <CheckCircle2 size={13} /> Genomförd {item.genomford_datum}
          {item.aterkommande_intervall_ar ? ` · åter ${item.ar + item.aterkommande_intervall_ar}` : ""}
        </span>
      ) : genomforId === item.id ? (
        <div className="sans" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <input
            type="number"
            placeholder="Återkom om X år"
            value={genomforIntervall}
            onChange={(e) => setGenomforIntervall(e.target.value)}
            style={{ width: 120, padding: "3px 5px", border: "1px solid #d8cfbe", borderRadius: 4, fontSize: 12 }}
          />
          <button
            onClick={() => markeraGenomford(item)}
            className="rounded-md bg-stone-800 px-2 py-1 text-xs text-white hover:bg-stone-700"
          >
            Spara
          </button>
          <button
            onClick={() => {
              setGenomforId(null);
              setGenomforIntervall("");
            }}
            className="rounded-md border border-stone-300 px-2 py-1 text-xs hover:bg-stone-50"
          >
            Avbryt
          </button>
        </div>
      ) : (
        <button
          onClick={() => setGenomforId(item.id)}
          className="sans"
          style={{ fontSize: 11, color: MUTED, border: "1px solid #d8cfbe", borderRadius: 12, padding: "2px 8px", background: "#fff", cursor: "pointer" }}
        >
          Markera genomförd
        </button>
      )
    ) : arGenomford ? (
      <span className="sans" style={{ fontSize: 11, color: "#3d5b3f" }}>
        Genomförd {item.genomford_datum}
      </span>
    ) : null;

    return (
      <div
        className="row"
        style={{
          borderBottom: "1px solid #f3eee3",
          background: changed ? "#fdf6ee" : "transparent",
          padding: "10px 14px",
        }}
      >
        {/* Mobil: stapeltkort */}
        <div className="sans sm:hidden" style={{ fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {arVisning}
            {fastighetBadge}
          </div>
          <div style={{ marginTop: 4 }}>
            {item.namn}
            <div style={{ fontSize: 11, color: MUTED }}>
              {item.kategori_namn} · {item.lage}
            </div>
          </div>
          <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 14 }}>
              <span style={{ color: item.investering ? "#2b2620" : MUTED_DASH }}>
                {item.investering ? "Inv " + krCompact(item.investering) : "—"}
              </span>
              <span style={{ color: item.underhall ? "#2b2620" : MUTED_DASH }}>
                {item.underhall ? "Uh " + krCompact(item.underhall) : "—"}
              </span>
            </div>
            {atgardsKnappar}
          </div>
          {genomfordAktion && <div style={{ marginTop: 6 }}>{genomfordAktion}</div>}
        </div>

        {/* Desktop/tablet: rad-layout */}
        <div className="sans hidden sm:grid" style={{ gridTemplateColumns: ROW_COLS, gap: 8, alignItems: "center", fontSize: 13 }}>
          <div>{arVisning}</div>
          <div>{fastighetBadge}</div>
          <div>
            {item.namn}
            <div style={{ fontSize: 11, color: MUTED }}>
              {item.kategori_namn} · {item.lage}
            </div>
          </div>
          <div style={{ textAlign: "right", color: item.investering ? "#2b2620" : MUTED_DASH }}>
            {item.investering ? krCompact(item.investering) : "—"}
          </div>
          <div style={{ textAlign: "right", color: item.underhall ? "#2b2620" : MUTED_DASH }}>
            {item.underhall ? krCompact(item.underhall) : "—"}
          </div>
          <div>{genomfordAktion}</div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>{atgardsKnappar}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: "Georgia, 'Times New Roman', serif",
        background: "#faf7f2",
        minHeight: "100%",
        color: "#2b2620",
        padding: "0",
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        .sans { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        input[type=number]::-webkit-inner-spin-button { opacity: 1; }
        .row:hover { background: #f1ece2 !important; }
      `}</style>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 60px" }}>
        <Link href="/" className="sans" style={{ fontSize: 13, color: MUTED, textDecoration: "underline" }}>
          ← Startsida
        </Link>

        <div style={{ borderBottom: "2px solid #c1592c", paddingBottom: 14, marginTop: 10, marginBottom: 20 }}>
          <div
            className="sans"
            style={{
              fontSize: 12,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#a8562f",
              fontWeight: 600,
            }}
          >
            Brf Jenny Linds Gata · Spetshandsken 1 &amp; Tumvanten 1
          </div>
          <h1 style={{ fontSize: 26, margin: "4px 0 0", fontWeight: 400 }}>
            Underhållsplan &amp; ekonomisimulering
          </h1>
          {senastUppdaterad && (
            <p className="sans" style={{ fontSize: 12, color: MUTED, margin: "6px 0 0" }}>
              Senast uppdaterad{" "}
              {new Date(senastUppdaterad).toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
        </div>

        <div className="sans" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {["Alla", "Spetshandsken 1", "Tumvanten 1", "Gemensam"].map((f) => (
            <button
              key={f}
              onClick={() => setFastighetFilter(f)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: fastighetFilter === f ? "1px solid #c1592c" : "1px solid #d8cfbe",
                background: fastighetFilter === f ? "#c1592c" : "#fff",
                color: fastighetFilter === f ? "#fff" : "#3d382f",
                fontSize: 13,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="sans" style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {(["plan", "historik"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVisning(v)}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                borderBottom: visning === v ? "2px solid #c1592c" : "2px solid transparent",
                background: "transparent",
                color: visning === v ? "#2b2620" : MUTED,
                fontSize: 13,
                cursor: "pointer",
                fontWeight: visning === v ? 600 : 500,
              }}
            >
              {v === "plan" ? "Plan" : "Historik"}
            </button>
          ))}
        </div>

        <div
          style={{
            display: visning === "plan" ? "block" : "none",
            background: "#fff",
            border: "1px solid #e4ddd0",
            borderRadius: 8,
            padding: "18px 16px 8px",
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            <div className="sans" style={{ fontSize: 13, fontWeight: 600, color: "#3d382f" }}>
              Total kostnad per år, {CURRENT_YEAR}–{chartToYear} ({fastighetFilter}) — underlag till budget
            </div>
            <select
              value={grafAr}
              onChange={(e) => setGrafAr(Number(e.target.value))}
              className="sans"
              style={{ fontSize: 12, padding: "3px 6px", border: "1px solid #d8cfbe", borderRadius: 4, color: "#3d382f" }}
            >
              <option value={5}>5 år</option>
              <option value={10}>10 år</option>
              <option value={20}>20 år</option>
              <option value={30}>30 år</option>
              <option value={50}>50 år</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            {hasPending ? (
              <BarChart data={chartDataJamfor} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee5d5" />
                <XAxis dataKey="ar" tick={{ fontSize: 11, fontFamily: "sans-serif" }} interval={1} />
                <YAxis tickFormatter={krCompact} tick={{ fontSize: 11, fontFamily: "sans-serif" }} width={55} />
                <Tooltip
                  formatter={(v) => (v === undefined ? "" : kr(Number(v)))}
                  labelFormatter={(l) => `År ${l}`}
                  contentStyle={{ fontFamily: "sans-serif", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontFamily: "sans-serif", fontSize: 12 }} />
                <Bar dataKey="Nuvarande plan" fill="#3d5b3f" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Simulerad ändring" fill="#c1592c" radius={[3, 3, 0, 0]} />
              </BarChart>
            ) : (
              <BarChart data={staplatData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee5d5" />
                <XAxis dataKey="ar" tick={{ fontSize: 11, fontFamily: "sans-serif" }} interval={1} />
                <YAxis tickFormatter={krCompact} tick={{ fontSize: 11, fontFamily: "sans-serif" }} width={55} />
                <Tooltip content={<GrafTooltip />} />
                <Legend wrapperStyle={{ fontFamily: "sans-serif", fontSize: 12 }} />
                {alleKategoriNamn.map((k) => (
                  <Bar key={k} dataKey={k} stackId="a" fill={kategoriColor(k)} />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
          <div className="sans" style={{ fontSize: 12, color: MUTED, padding: "4px 0 14px" }}>
            Visar planens totala kostnad (investering + underhåll) per år, färgad per kategori. Fördelning på
            faktisk finansiering (avgift, lån, kassa) hanteras i föreningens ordinarie budgetprocess, inte här.
          </div>
        </div>

        <div className="sans" style={{ display: "flex", gap: 12, marginBottom: 16, fontSize: 13, flexWrap: "wrap" }}>
          <div style={{ background: "#fff", border: "1px solid #e4ddd0", borderRadius: 8, padding: "10px 16px", flex: "1 1 140px" }}>
            <div style={{ color: MUTED }}>
              Investering (lånefinansierat){visning === "historik" && ", genomfört"}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{krCompact(totalInvestering)}</div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e4ddd0", borderRadius: 8, padding: "10px 16px", flex: "1 1 140px" }}>
            <div style={{ color: MUTED }}>
              Underhåll (fondfinansierat){visning === "historik" && ", genomfört"}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{krCompact(totalUnderhall)}</div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e4ddd0", borderRadius: 8, padding: "10px 16px", flex: "1 1 140px" }}>
            <div style={{ color: MUTED }}>{visning === "plan" ? "Kommande poster" : "Genomförda poster"}</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{sammanfattningItems.length}</div>
          </div>
        </div>

        {hasPending && (
          <div
            className="sans"
            style={{
              background: "#fdf1e7",
              border: "1px solid #e8b88f",
              borderRadius: 8,
              padding: "10px 16px",
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 13, color: "#7c3d1f" }}>
              Osparade ändringar — se effekten i grafen ovan innan du bekräftar.
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={discardChanges}
                disabled={saving}
                className="sans"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #d8cfbe",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                <RotateCcw size={14} /> Ångra
              </button>
              <button
                onClick={confirmChanges}
                disabled={saving}
                className="sans"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: "#c1592c",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                <Check size={14} /> {saving ? "Sparar…" : "Bekräfta ändring"}
              </button>
            </div>
          </div>
        )}
        {saveError && <div className="sans" style={{ fontSize: 13, color: "#9a3232", marginBottom: 12 }}>{saveError}</div>}
        {savedNote && <div className="sans" style={{ fontSize: 13, color: "#3d5b3f", marginBottom: 12 }}>{savedNote}</div>}

        {visning === "plan" && kanRedigera && (
          <div style={{ marginBottom: 16 }}>
            {visaNyForm ? (
              <NyPostForm
                fastigheter={fastigheter}
                kategorier={kategorier}
                currentProfilId={currentProfilId}
                onSkapad={(post) => {
                  setItems((prev) => [...prev, post]);
                  setDraft((prev) => [...prev, post]);
                  setVisaNyForm(false);
                }}
                onAvbryt={() => setVisaNyForm(false)}
              />
            ) : (
              <button
                onClick={() => setVisaNyForm(true)}
                className="sans"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #d8cfbe",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                <Plus size={14} /> Lägg till ny post
              </button>
            )}
          </div>
        )}

        {visning === "plan" && (
        <>
        <div className="sans hidden sm:grid" style={{ gridTemplateColumns: ROW_COLS, gap: 8, padding: "0 14px 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED }}>
          <div>År</div>
          <div>Fastighet</div>
          <div>Åtgärd</div>
          <div style={{ textAlign: "right" }}>Investering</div>
          <div style={{ textAlign: "right" }}>Underhåll</div>
          <div>Status</div>
          <div style={{ textAlign: "right" }}>Hantera</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {grouped.map(({ ar, kategorier: katGrupper }) => {
            const expanded = expandedYears.has(ar);
            const antal = katGrupper.reduce((s, [, items]) => s + items.length, 0);
            const summa = katGrupper.reduce(
              (s, [, items]) => s + items.reduce((s2, i) => s2 + i.investering + i.underhall, 0),
              0
            );
            return (
              <div key={ar} style={{ background: "#fff", border: "1px solid #e4ddd0", borderRadius: 8, overflow: "hidden" }}>
                <button
                  onClick={() => toggleYear(ar)}
                  className="sans"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    border: "none",
                    background: "#faf7f2",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#2b2620",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    {ar}
                    <span style={{ fontWeight: 400, color: MUTED, fontSize: 12 }}>
                      ({antal} {antal === 1 ? "post" : "poster"})
                    </span>
                  </span>
                  <span style={{ fontWeight: 600 }}>{krCompact(summa)}</span>
                </button>
                {expanded && (
                  <div>
                    {katGrupper.map(([kategori, katItems]) => {
                      const nyckel = `${ar}::${kategori}`;
                      const katExpanded = !collapsedKategorier.has(nyckel);
                      const katSumma = katItems.reduce((s, i) => s + i.investering + i.underhall, 0);
                      return (
                        <div key={kategori}>
                          <button
                            onClick={() => toggleKategori(nyckel)}
                            className="sans"
                            style={{
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "6px 14px",
                              border: "none",
                              borderTop: "1px solid #eee5d5",
                              background: "#fbf9f5",
                              cursor: "pointer",
                              fontSize: 11,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              color: MUTED,
                            }}
                          >
                            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {katExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: kategoriColor(kategori) }} />
                              {kategori} ({katItems.length})
                            </span>
                            <span>{krCompact(katSumma)}</span>
                          </button>
                          {katExpanded && katItems.map((item) => <Rad key={item.id} item={item} />)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </>
        )}

        {visning === "historik" && <Historik items={visibleItems} />}

        <div className="sans" style={{ fontSize: 12, color: MUTED, marginTop: 14, lineHeight: 1.6 }}>
          Data importerad från Planima-exporten (85 planerade åtgärder, 2025–2071). Fastighetstaggning bygger på nämnda &quot;gård Grön&quot;/&quot;gård Brun&quot; i åtgärdsnamnen — övriga poster är tillsvidare taggade som Gemensam i väntan på fördelningsnyckel.
        </div>
      </div>
    </div>
  );
}

function Historik({ items }: { items: UhPost[] }) {
  const genomforda = useMemo(
    () =>
      items
        .filter((i) => i.genomford_datum)
        .sort((a, b) => (b.genomford_datum ?? "").localeCompare(a.genomford_datum ?? "")),
    [items]
  );

  if (genomforda.length === 0) {
    return (
      <div className="sans" style={{ background: "#fff", border: "1px solid #e4ddd0", borderRadius: 8, padding: 20, fontSize: 13, color: MUTED }}>
        Inga genomförda åtgärder registrerade ännu. Markera en post som &quot;genomförd&quot; i planen för att se den här.
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e4ddd0", borderRadius: 8, overflow: "hidden" }}>
      <div className="sans hidden sm:grid" style={{ gridTemplateColumns: "110px 120px 1fr 100px 100px 80px", gap: 8, padding: "8px 14px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, borderBottom: "1px solid #eee5d5" }}>
        <div>Genomfört</div>
        <div>Fastighet</div>
        <div>Åtgärd</div>
        <div style={{ textAlign: "right" }}>Investering</div>
        <div style={{ textAlign: "right" }}>Underhåll</div>
        <div>Återkommer</div>
      </div>
      {genomforda.map((item) => {
        const c = FASTIGHET_COLOR[item.fastighet_namn ?? "Gemensam"] ?? FASTIGHET_COLOR.Gemensam;
        return (
          <div key={item.id} className="sans" style={{ borderBottom: "1px solid #f3eee3", padding: "10px 14px", fontSize: 13 }}>
            <div className="sm:hidden">
              <div style={{ fontWeight: 600 }}>{item.genomford_datum}</div>
              <div style={{ marginTop: 2 }}>{item.namn}</div>
              <div style={{ fontSize: 11, color: MUTED }}>
                {item.fastighet_namn} · {item.kategori_namn} · ursprungligen {item.ar}
              </div>
              <div style={{ marginTop: 4, display: "flex", gap: 14 }}>
                <span>{item.investering ? "Inv " + krCompact(item.investering) : "—"}</span>
                <span>{item.underhall ? "Uh " + krCompact(item.underhall) : "—"}</span>
              </div>
            </div>
            <div className="hidden sm:grid" style={{ gridTemplateColumns: "110px 120px 1fr 100px 100px 80px", gap: 8, alignItems: "center" }}>
              <div>{item.genomford_datum}</div>
              <div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: c.bg, color: c.text, borderRadius: 12, padding: "2px 8px", fontSize: 11 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot }} />
                  {item.fastighet_namn}
                </span>
              </div>
              <div>
                {item.namn}
                <div style={{ fontSize: 11, color: MUTED }}>
                  {item.kategori_namn} · ursprungligen planerad {item.ar}
                </div>
              </div>
              <div style={{ textAlign: "right", color: item.investering ? "#2b2620" : MUTED_DASH }}>
                {item.investering ? krCompact(item.investering) : "—"}
              </div>
              <div style={{ textAlign: "right", color: item.underhall ? "#2b2620" : MUTED_DASH }}>
                {item.underhall ? krCompact(item.underhall) : "—"}
              </div>
              <div style={{ fontSize: 12, color: MUTED }}>
                {item.aterkommande_intervall_ar ? `om ${item.aterkommande_intervall_ar} år` : "—"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NyPostForm({
  fastigheter,
  kategorier,
  currentProfilId,
  onSkapad,
  onAvbryt,
}: {
  fastigheter: ListPost[];
  kategorier: ListPost[];
  currentProfilId: string | null;
  onSkapad: (post: UhPost) => void;
  onAvbryt: () => void;
}) {
  const [fastighetId, setFastighetId] = useState("");
  const [kategoriId, setKategoriId] = useState("");
  const [namn, setNamn] = useState("");
  const [lage, setLage] = useState("");
  const [ar, setAr] = useState(String(CURRENT_YEAR));
  const [investering, setInvestering] = useState("0");
  const [underhall, setUnderhall] = useState("0");
  const [typ, setTyp] = useState<"komponent" | "löpande_buffert">("komponent");
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!namn.trim()) return;
    setSparar(true);
    setFel("");

    const supabase = createClient();
    const { data, error } = await supabase
      .from("uh_poster")
      .insert({
        fastighet_id: fastighetId || null,
        kategori_id: kategoriId || null,
        lage: lage || null,
        namn: namn.trim(),
        ar: Number(ar),
        investering: Number(investering) || 0,
        underhall: Number(underhall) || 0,
        typ,
        status: "godkänd",
        skapad_av: currentProfilId,
      })
      .select(
        "id, fastighet_id, kategori_id, lage, namn, ar, investering, underhall, typ, status, genomford_datum, aterkommande_intervall_ar"
      )
      .single();

    if (error) {
      setFel(error.message);
      setSparar(false);
      return;
    }

    const fastighet = fastigheter.find((f) => f.id === fastighetId);
    const kategori = kategorier.find((k) => k.id === kategoriId);
    onSkapad({ ...data, fastighet_namn: fastighet?.namn ?? "Gemensam", kategori_namn: kategori?.namn ?? null });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="sans"
      style={{ background: "#fff", border: "1px solid #e4ddd0", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 11, color: MUTED }}>Fastighet</span>
          <select value={fastighetId} onChange={(e) => setFastighetId(e.target.value)} style={{ padding: "6px 8px", border: "1px solid #d8cfbe", borderRadius: 4 }}>
            <option value="">Gemensam</option>
            {fastigheter.map((f) => (
              <option key={f.id} value={f.id}>
                {f.namn}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 11, color: MUTED }}>Kategori</span>
          <select value={kategoriId} onChange={(e) => setKategoriId(e.target.value)} style={{ padding: "6px 8px", border: "1px solid #d8cfbe", borderRadius: 4 }}>
            <option value="">Ingen kategori</option>
            {kategorier.map((k) => (
              <option key={k.id} value={k.id}>
                {k.namn}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 11, color: MUTED }}>Typ</span>
          <select value={typ} onChange={(e) => setTyp(e.target.value as "komponent" | "löpande_buffert")} style={{ padding: "6px 8px", border: "1px solid #d8cfbe", borderRadius: 4 }}>
            <option value="komponent">Komponent (enskild åtgärd)</option>
            <option value="löpande_buffert">Löpande buffert (årlig avsättning)</option>
          </select>
        </label>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 200px" }}>
          <span style={{ fontSize: 11, color: MUTED }}>Åtgärd (namn på posten)</span>
          <input value={namn} onChange={(e) => setNamn(e.target.value)} placeholder="T.ex. Byte av takpapp" style={{ padding: "6px 8px", border: "1px solid #d8cfbe", borderRadius: 4 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 140px" }}>
          <span style={{ fontSize: 11, color: MUTED }}>Läge (var i fastigheten, valfritt)</span>
          <input value={lage} onChange={(e) => setLage(e.target.value)} placeholder="T.ex. Tvättstuga, Tak, Garage" style={{ padding: "6px 8px", border: "1px solid #d8cfbe", borderRadius: 4 }} />
        </label>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 11, color: MUTED }}>År</span>
          <input type="number" value={ar} onChange={(e) => setAr(e.target.value)} style={{ width: 90, padding: "6px 8px", border: "1px solid #d8cfbe", borderRadius: 4 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 11, color: MUTED }}>Investering, kr (lånefinansierad engångskostnad)</span>
          <input type="number" value={investering} onChange={(e) => setInvestering(e.target.value)} style={{ width: 160, padding: "6px 8px", border: "1px solid #d8cfbe", borderRadius: 4 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 11, color: MUTED }}>Underhåll, kr (fondfinansierad direktkostnad)</span>
          <input type="number" value={underhall} onChange={(e) => setUnderhall(e.target.value)} style={{ width: 160, padding: "6px 8px", border: "1px solid #d8cfbe", borderRadius: 4 }} />
        </label>
      </div>
      <p style={{ fontSize: 11, color: MUTED, margin: 0 }}>
        Fyll bara i det ena av Investering/Underhåll om posten bara är av ena typen (lämna den andra som 0) —
        de summeras separat i planen.
      </p>
      {fel && <p style={{ color: "#9a3232", fontSize: 12 }}>{fel}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          disabled={sparar || !namn.trim()}
          style={{ background: "#c1592c", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", cursor: "pointer", opacity: sparar ? 0.6 : 1 }}
        >
          {sparar ? "Sparar…" : "Skapa post"}
        </button>
        <button type="button" onClick={onAvbryt} style={{ border: "1px solid #d8cfbe", background: "#fff", borderRadius: 6, padding: "8px 14px", cursor: "pointer" }}>
          Avbryt
        </button>
      </div>
    </form>
  );
}
