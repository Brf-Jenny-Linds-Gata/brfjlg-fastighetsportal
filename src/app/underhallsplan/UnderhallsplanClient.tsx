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
import { Pencil, Check, X, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { UhPost } from "@/lib/supabase/types";

const FASTIGHET_COLOR: Record<string, { dot: string; bg: string; text: string }> = {
  "Spetshandsken 1": { dot: "#a8562f", bg: "#f4e6dd", text: "#7c3d1f" },
  "Tumvanten 1": { dot: "#4a6b4d", bg: "#e3ebe1", text: "#33492f" },
  Gemensam: { dot: "#8a8478", bg: "#ede9e2", text: "#5c564a" },
};

const CURRENT_YEAR = new Date().getFullYear();
const CHART_TO_YEAR = CURRENT_YEAR + 20;

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

  const hasPending = draft !== items && JSON.stringify(draft) !== JSON.stringify(items);

  const visibleItems = useMemo(() => {
    const list =
      fastighetFilter === "Alla" ? draft : draft.filter((i) => i.fastighet_namn === fastighetFilter);
    return [...list].sort((a, b) => a.ar - b.ar);
  }, [draft, fastighetFilter]);

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

  const totalInvestering = visibleItems.reduce((s, i) => s + i.investering, 0);
  const totalUnderhall = visibleItems.reduce((s, i) => s + i.underhall, 0);

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

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "28px 20px 60px" }}>
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
          <h1 style={{ fontSize: 30, margin: "4px 0 0", fontWeight: 400 }}>
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
                color: fastighetFilter === f ? "#fff" : "#5c564a",
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
          <div className="sans" style={{ fontSize: 13, fontWeight: 600, color: "#5c564a", marginBottom: 8 }}>
            Total kostnad per år, {CURRENT_YEAR}–{CHART_TO_YEAR} ({fastighetFilter}) — underlag till budget
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee5d5" />
              <XAxis dataKey="ar" tick={{ fontSize: 11, fontFamily: "sans-serif" }} interval={1} />
              <YAxis tickFormatter={krCompact} tick={{ fontSize: 11, fontFamily: "sans-serif" }} width={60} />
              <Tooltip
                formatter={(v) => (v === undefined ? "" : kr(Number(v)))}
                labelFormatter={(l) => `År ${l}`}
                contentStyle={{ fontFamily: "sans-serif", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontFamily: "sans-serif", fontSize: 12 }} />
              <Bar dataKey="Nuvarande plan" fill="#4a6b4d" radius={[3, 3, 0, 0]} />
              {hasPending && <Bar dataKey="Simulerad ändring" fill="#c1592c" radius={[3, 3, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
          <div className="sans" style={{ fontSize: 12, color: "#8a8478", padding: "4px 0 14px" }}>
            Visar planens totala kostnad (investering + underhåll) per år. Fördelning på faktisk finansiering
            (avgift, lån, kassa) hanteras i föreningens ordinarie budgetprocess, inte här.
          </div>
        </div>

        <div className="sans" style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: 13 }}>
          <div style={{ background: "#fff", border: "1px solid #e4ddd0", borderRadius: 8, padding: "10px 16px", flex: 1 }}>
            <div style={{ color: "#8a8478" }}>Investering (lånefinansierat)</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{krCompact(totalInvestering)}</div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e4ddd0", borderRadius: 8, padding: "10px 16px", flex: 1 }}>
            <div style={{ color: "#8a8478" }}>Underhåll (fondfinansierat)</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{krCompact(totalUnderhall)}</div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e4ddd0", borderRadius: 8, padding: "10px 16px", flex: 1 }}>
            <div style={{ color: "#8a8478" }}>Antal poster</div>
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
        {saveError && <div className="sans" style={{ fontSize: 13, color: "#b23b3b", marginBottom: 12 }}>{saveError}</div>}
        {savedNote && <div className="sans" style={{ fontSize: 13, color: "#4a6b4d", marginBottom: 12 }}>{savedNote}</div>}

        <div style={{ background: "#fff", border: "1px solid #e4ddd0", borderRadius: 8, overflow: "hidden" }}>
          <div
            className="sans"
            style={{
              display: "grid",
              gridTemplateColumns: "70px 120px 1fr 110px 110px 40px",
              padding: "10px 14px",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#8a8478",
              borderBottom: "1px solid #eee5d5",
            }}
          >
            <div>År</div>
            <div>Fastighet</div>
            <div>Åtgärd</div>
            <div style={{ textAlign: "right" }}>Investering</div>
            <div style={{ textAlign: "right" }}>Underhåll</div>
            <div />
          </div>
          <div style={{ maxHeight: 480, overflowY: "auto" }}>
            {visibleItems.map((item) => {
              const c = FASTIGHET_COLOR[item.fastighet_namn ?? "Gemensam"] ?? FASTIGHET_COLOR.Gemensam;
              const isEditing = editingId === item.id;
              const changed = items.find((i) => i.id === item.id)?.ar !== item.ar;
              const kanFlyttas = kanRedigera && item.typ !== "löpande_buffert";
              return (
                <div
                  key={item.id}
                  className="row sans"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "70px 120px 1fr 110px 110px 40px",
                    padding: "9px 14px",
                    fontSize: 13,
                    borderBottom: "1px solid #f3eee3",
                    alignItems: "center",
                    background: changed ? "#fdf6ee" : "transparent",
                  }}
                >
                  <div>
                    {isEditing ? (
                      <input
                        autoFocus
                        type="number"
                        value={editYear}
                        onChange={(e) => setEditYear(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit(item);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        style={{ width: 60, padding: "3px 5px", border: "1px solid #c1592c", borderRadius: 4, fontFamily: "inherit" }}
                      />
                    ) : (
                      <span style={{ fontWeight: changed ? 700 : 400 }}>{item.ar}</span>
                    )}
                  </div>
                  <div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: c.bg,
                        color: c.text,
                        borderRadius: 12,
                        padding: "2px 8px",
                        fontSize: 11,
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot }} />
                      {item.fastighet_namn}
                    </span>
                  </div>
                  <div>
                    {item.namn}
                    <div style={{ fontSize: 11, color: "#a8a190" }}>
                      {item.kategori_namn} · {item.lage}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", color: item.investering ? "#2b2620" : "#c9c2b3" }}>
                    {item.investering ? krCompact(item.investering) : "—"}
                  </div>
                  <div style={{ textAlign: "right", color: item.underhall ? "#2b2620" : "#c9c2b3" }}>
                    {item.underhall ? krCompact(item.underhall) : "—"}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {kanFlyttas &&
                      (isEditing ? (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => commitEdit(item)} style={{ border: "none", background: "none", cursor: "pointer", color: "#4a6b4d" }}>
                            <Check size={15} />
                          </button>
                          <button onClick={cancelEdit} style={{ border: "none", background: "none", cursor: "pointer", color: "#b23b3b" }}>
                            <X size={15} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(item)}
                          style={{ border: "none", background: "none", cursor: "pointer", color: "#c9c2b3" }}
                          title="Flytta i planen"
                        >
                          <Pencil size={14} />
                        </button>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
