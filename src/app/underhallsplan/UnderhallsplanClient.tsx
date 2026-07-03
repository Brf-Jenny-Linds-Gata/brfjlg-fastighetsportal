"use client";

import { useMemo, useState } from "react";
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
import { Pencil, Check, X, RotateCcw, ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { UhPost } from "@/lib/supabase/types";

const FASTIGHET_COLOR: Record<string, { dot: string; bg: string; text: string }> = {
  "Spetshandsken 1": { dot: "#a8562f", bg: "#f4e6dd", text: "#7c3d1f" },
  "Tumvanten 1": { dot: "#4a6b4d", bg: "#e3ebe1", text: "#33492f" },
  Gemensam: { dot: "#6b6459", bg: "#ede9e2", text: "#4a453b" },
};

const CURRENT_YEAR = new Date().getFullYear();
const CHART_TO_YEAR = CURRENT_YEAR + 20;
const MUTED = "#6b6459";
const MUTED_DASH = "#a19a8c";

function krCompact(n: number) {
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1).replace(".0", "") + " mkr";
  if (Math.abs(n) >= 1000) return Math.round(n / 1000) + " tkr";
  return n + " kr";
}
function kr(n: number) {
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(n) + " kr";
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

export function UnderhallsplanClient({
  initialItems,
  kanRedigera,
}: {
  initialItems: UhPost[];
  kanRedigera: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [draft, setDraft] = useState(initialItems);
  const [fastighetFilter, setFastighetFilter] = useState("Alla");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editYear, setEditYear] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [genomforId, setGenomforId] = useState<string | null>(null);
  const [genomforIntervall, setGenomforIntervall] = useState("");

  const hasPending = draft !== items && JSON.stringify(draft) !== JSON.stringify(items);

  const visibleItems = useMemo(() => {
    const list =
      fastighetFilter === "Alla" ? draft : draft.filter((i) => i.fastighet_namn === fastighetFilter);
    return [...list].sort((a, b) => a.ar - b.ar);
  }, [draft, fastighetFilter]);

  const grouped = useMemo(() => groupByYearAndKategori(visibleItems), [visibleItems]);

  const [expandedYears, setExpandedYears] = useState<Set<number>>(() => {
    const nearest = visibleItems.map((i) => i.ar).find((y) => y >= CURRENT_YEAR);
    return new Set(nearest !== undefined ? [nearest] : []);
  });

  function toggleYear(ar: number) {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(ar)) next.delete(ar);
      else next.add(ar);
      return next;
    });
  }

  const totalsCurrent = useMemo(
    () => yearlyTotals(items, fastighetFilter, CURRENT_YEAR, CHART_TO_YEAR),
    [items, fastighetFilter]
  );
  const totalsDraft = useMemo(
    () => yearlyTotals(draft, fastighetFilter, CURRENT_YEAR, CHART_TO_YEAR),
    [draft, fastighetFilter]
  );

  const chartData = totalsCurrent.map((row, idx) => ({
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
      const { error } = await supabase.from("uh_poster").update({ ar: item.ar }).eq("id", item.id);
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
      .update({ genomford_datum: idag, aterkommande_intervall_ar: intervall })
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

  const totalInvestering = visibleItems.reduce((s, i) => s + i.investering, 0);
  const totalUnderhall = visibleItems.reduce((s, i) => s + i.underhall, 0);

  function Rad({ item }: { item: UhPost }) {
    const c = FASTIGHET_COLOR[item.fastighet_namn ?? "Gemensam"] ?? FASTIGHET_COLOR.Gemensam;
    const isEditing = editingId === item.id;
    const changed = items.find((i) => i.id === item.id)?.ar !== item.ar;
    const kanFlyttas = kanRedigera && item.typ !== "löpande_buffert";
    const arGenomford = !!item.genomford_datum;

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

    const flyttaKnapp = kanFlyttas ? (
      isEditing ? (
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => commitEdit(item)} style={{ border: "none", background: "none", cursor: "pointer", color: "#3d5b3f" }}>
            <Check size={15} />
          </button>
          <button onClick={cancelEdit} style={{ border: "none", background: "none", cursor: "pointer", color: "#9a3232" }}>
            <X size={15} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => startEdit(item)}
          style={{ border: "none", background: "none", cursor: "pointer", color: MUTED }}
          title="Flytta i planen"
        >
          <Pencil size={14} />
        </button>
      )
    ) : null;

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
        <div className="sans" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            placeholder="Återkom om X år (valfritt)"
            value={genomforIntervall}
            onChange={(e) => setGenomforIntervall(e.target.value)}
            style={{ width: 150, padding: "3px 5px", border: "1px solid #d8cfbe", borderRadius: 4, fontSize: 12 }}
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
            {flyttaKnapp}
          </div>
          {genomfordAktion && <div style={{ marginTop: 6 }}>{genomfordAktion}</div>}
        </div>

        {/* Desktop/tablet: rad-layout */}
        <div
          className="sans hidden sm:grid"
          style={{ gridTemplateColumns: "70px 120px 1fr 100px 100px 90px 30px", gap: 8, alignItems: "center", fontSize: 13 }}
        >
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
          <div style={{ textAlign: "right" }}>{flyttaKnapp}</div>
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
        <div style={{ borderBottom: "2px solid #c1592c", paddingBottom: 14, marginBottom: 20 }}>
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

        <div
          style={{
            background: "#fff",
            border: "1px solid #e4ddd0",
            borderRadius: 8,
            padding: "18px 16px 8px",
            marginBottom: 20,
          }}
        >
          <div className="sans" style={{ fontSize: 13, fontWeight: 600, color: "#3d382f", marginBottom: 8 }}>
            Total kostnad per år, {CURRENT_YEAR}–{CHART_TO_YEAR} ({fastighetFilter}) — underlag till budget
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
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
              {hasPending && <Bar dataKey="Simulerad ändring" fill="#c1592c" radius={[3, 3, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
          <div className="sans" style={{ fontSize: 12, color: MUTED, padding: "4px 0 14px" }}>
            Visar planens totala kostnad (investering + underhåll) per år. Fördelning på faktisk finansiering
            (avgift, lån, kassa) hanteras i föreningens ordinarie budgetprocess, inte här.
          </div>
        </div>

        <div className="sans" style={{ display: "flex", gap: 12, marginBottom: 16, fontSize: 13, flexWrap: "wrap" }}>
          <div style={{ background: "#fff", border: "1px solid #e4ddd0", borderRadius: 8, padding: "10px 16px", flex: "1 1 140px" }}>
            <div style={{ color: MUTED }}>Investering (lånefinansierat)</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{krCompact(totalInvestering)}</div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e4ddd0", borderRadius: 8, padding: "10px 16px", flex: "1 1 140px" }}>
            <div style={{ color: MUTED }}>Underhåll (fondfinansierat)</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{krCompact(totalUnderhall)}</div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e4ddd0", borderRadius: 8, padding: "10px 16px", flex: "1 1 140px" }}>
            <div style={{ color: MUTED }}>Antal poster</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{visibleItems.length}</div>
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

        <div className="sans hidden sm:grid" style={{ gridTemplateColumns: "70px 120px 1fr 100px 100px 90px 30px", gap: 8, padding: "0 14px 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED }}>
          <div>År</div>
          <div>Fastighet</div>
          <div>Åtgärd</div>
          <div style={{ textAlign: "right" }}>Investering</div>
          <div style={{ textAlign: "right" }}>Underhåll</div>
          <div>Status</div>
          <div />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {grouped.map(({ ar, kategorier }) => {
            const expanded = expandedYears.has(ar);
            const antal = kategorier.reduce((s, [, items]) => s + items.length, 0);
            const summa = kategorier.reduce(
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
                    {kategorier.map(([kategori, items]) => (
                      <div key={kategori}>
                        <div
                          className="sans"
                          style={{
                            padding: "6px 14px",
                            fontSize: 11,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            color: MUTED,
                            background: "#fbf9f5",
                            borderTop: "1px solid #eee5d5",
                          }}
                        >
                          {kategori}
                        </div>
                        {items.map((item) => (
                          <Rad key={item.id} item={item} />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="sans" style={{ fontSize: 12, color: MUTED, marginTop: 14, lineHeight: 1.6 }}>
          Data importerad från Planima-exporten (85 planerade åtgärder, 2025–2071). Fastighetstaggning bygger på nämnda &quot;gård Grön&quot;/&quot;gård Brun&quot; i åtgärdsnamnen — övriga poster är tillsvidare taggade som Gemensam i väntan på fördelningsnyckel.
        </div>
      </div>
    </div>
  );
}
