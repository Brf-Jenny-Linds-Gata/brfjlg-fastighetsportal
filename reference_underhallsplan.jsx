import React, { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Pencil, Check, X, RotateCcw } from "lucide-react";

const SEED_ITEMS = [{"id": "post-1", "fastighet": "Gemensam", "ar": 2025, "kategori": "Installationer", "lage": "Tvättstuga", "namn": "Torkfläktar", "investering": 50000, "underhall": 0}, {"id": "post-2", "fastighet": "Gemensam", "ar": 2026, "kategori": "Övrigt", "lage": "Övrigt", "namn": "Avsättning för årligt underhållsarbete", "investering": 62500, "underhall": 0}, {"id": "post-3", "fastighet": "Gemensam", "ar": 2026, "kategori": "Installationer", "lage": "Tvättstuga", "namn": "Mangel 2 st", "investering": 37500, "underhall": 0}, {"id": "post-4", "fastighet": "Tumvanten 1", "ar": 2026, "kategori": "Mark", "lage": "Utemiljö", "namn": "Murar gård Grön", "investering": 0, "underhall": 375000}, {"id": "post-5", "fastighet": "Tumvanten 1", "ar": 2026, "kategori": "Mark", "lage": "Utemiljö", "namn": "Provgrop gård \"grön\"", "investering": 0, "underhall": 37500}, {"id": "post-6", "fastighet": "Gemensam", "ar": 2026, "kategori": "Installationer", "lage": "Tvättstuga", "namn": "Torktumlare BLÅ 2 st", "investering": 62500, "underhall": 0}, {"id": "post-7", "fastighet": "Gemensam", "ar": 2026, "kategori": "Installationer", "lage": "Tvättstuga", "namn": "Tvättmaskin BLÅ 1 st", "investering": 43750, "underhall": 0}, {"id": "post-8", "fastighet": "Gemensam", "ar": 2026, "kategori": "Installationer", "lage": "Stamventiler", "namn": "Utbyte och injustering av stamventiler", "investering": 625000, "underhall": 0}, {"id": "post-9", "fastighet": "Gemensam", "ar": 2026, "kategori": "Installationer", "lage": "Energicentral", "namn": "Utbyte och injustering radiatorventiler", "investering": 625000, "underhall": 0}, {"id": "post-10", "fastighet": "Gemensam", "ar": 2026, "kategori": "Invändigt", "lage": "Tvättstuga", "namn": "Ytskikt i tvättstugor renoveras inkl torkrum", "investering": 0, "underhall": 750000}, {"id": "post-11", "fastighet": "Gemensam", "ar": 2027, "kategori": "Installationer", "lage": "Vatten och avlopp", "namn": "Avloppsstammar i källargolv utbytes", "investering": 2500000, "underhall": 0}, {"id": "post-12", "fastighet": "Gemensam", "ar": 2027, "kategori": "Installationer", "lage": "Kulvert", "namn": "Kulvert under gata", "investering": 750000, "underhall": 0}, {"id": "post-13", "fastighet": "Tumvanten 1", "ar": 2028, "kategori": "Installationer", "lage": "Ventilation", "namn": "Frånluftsfläktar gård Grön", "investering": 562500, "underhall": 0}, {"id": "post-14", "fastighet": "Spetshandsken 1", "ar": 2028, "kategori": "Mark", "lage": "Utemiljö", "namn": "Gård \"brun\" totalrenoveras inkl dagvatten", "investering": 4375000, "underhall": 0}, {"id": "post-15", "fastighet": "Gemensam", "ar": 2028, "kategori": "Besiktningar", "lage": "Kontroller/Besiktningar", "namn": "OVK besiktning", "investering": 0, "underhall": 50000}, {"id": "post-16", "fastighet": "Gemensam", "ar": 2029, "kategori": "Mark", "lage": "Garage/parkering", "namn": "Körbana i garage renoveras", "investering": 1875000, "underhall": 0}, {"id": "post-17", "fastighet": "Gemensam", "ar": 2030, "kategori": "Installationer", "lage": "El. Fastigheten", "namn": "Utbyte elstigare", "investering": 1625000, "underhall": 0}, {"id": "post-18", "fastighet": "Gemensam", "ar": 2030, "kategori": "Invändigt", "lage": "Källare", "namn": "Åtgärd sättningar i källargolv", "investering": 0, "underhall": 500000}, {"id": "post-19", "fastighet": "Gemensam", "ar": 2031, "kategori": "Övrigt", "lage": "Övrigt", "namn": "Avsättning för årligt underhållsarbete", "investering": 62500, "underhall": 0}, {"id": "post-20", "fastighet": "Gemensam", "ar": 2031, "kategori": "Fasad", "lage": "Dörrar entré", "namn": "Entréportar och dörrar renoveras", "investering": 0, "underhall": 125000}, {"id": "post-21", "fastighet": "Tumvanten 1", "ar": 2031, "kategori": "Installationer", "lage": "Tvättstuga", "namn": "Torskskåp GRÖN 1 st", "investering": 50000, "underhall": 0}, {"id": "post-22", "fastighet": "Gemensam", "ar": 2032, "kategori": "Yttertak", "lage": "Tak", "namn": "Målning plåttak lokaler/passager", "investering": 125000, "underhall": 0}, {"id": "post-23", "fastighet": "Tumvanten 1", "ar": 2032, "kategori": "Installationer", "lage": "Tvättstuga", "namn": "Tvättmaskiner GRÖN 2 st", "investering": 131250, "underhall": 0}, {"id": "post-24", "fastighet": "Gemensam", "ar": 2034, "kategori": "Besiktningar", "lage": "Kontroller/Besiktningar", "namn": "OVK besiktning", "investering": 0, "underhall": 50000}, {"id": "post-25", "fastighet": "Gemensam", "ar": 2035, "kategori": "Invändigt", "lage": "Allmänna utrymmen", "namn": "Trapphus målas", "investering": 1875000, "underhall": 0}, {"id": "post-26", "fastighet": "Gemensam", "ar": 2036, "kategori": "Övrigt", "lage": "Övrigt", "namn": "Avsättning för årligt underhållsarbete", "investering": 62500, "underhall": 0}, {"id": "post-27", "fastighet": "Gemensam", "ar": 2036, "kategori": "Fasad", "lage": "Balkong/terrass", "namn": "Balkonger (loftgångar) renoveras inkl räckesanpassning", "investering": 625000, "underhall": 0}, {"id": "post-28", "fastighet": "Gemensam", "ar": 2036, "kategori": "Installationer", "lage": "Energicentral", "namn": "Utbyte av fjärrvärmecentral", "investering": 500000, "underhall": 0}, {"id": "post-29", "fastighet": "Gemensam", "ar": 2036, "kategori": "Invändigt", "lage": "Energicentral", "namn": "Ytskikt renoveras i UC", "investering": 0, "underhall": 75000}, {"id": "post-30", "fastighet": "Gemensam", "ar": 2038, "kategori": "Installationer", "lage": "Solceller", "namn": "Solcellsanläggning, växelriktare", "investering": 75000, "underhall": 0}, {"id": "post-31", "fastighet": "Gemensam", "ar": 2038, "kategori": "Installationer", "lage": "Solceller", "namn": "Växelriktare Solceller", "investering": 312500, "underhall": 0}, {"id": "post-32", "fastighet": "Spetshandsken 1", "ar": 2040, "kategori": "Installationer", "lage": "Ventilation", "namn": "Frånluftsfläktar gård BRUN", "investering": 312500, "underhall": 0}, {"id": "post-33", "fastighet": "Gemensam", "ar": 2040, "kategori": "Besiktningar", "lage": "Kontroller/Besiktningar", "namn": "OVK besiktning", "investering": 0, "underhall": 50000}, {"id": "post-34", "fastighet": "Gemensam", "ar": 2040, "kategori": "Installationer", "lage": "Tvättstuga", "namn": "Torkfläktar", "investering": 50000, "underhall": 0}, {"id": "post-35", "fastighet": "Gemensam", "ar": 2041, "kategori": "Övrigt", "lage": "Övrigt", "namn": "Avsättning för årligt underhållsarbete", "investering": 62500, "underhall": 0}, {"id": "post-36", "fastighet": "Gemensam", "ar": 2041, "kategori": "Fasad", "lage": "Dörrar entré", "namn": "Entréportar och dörrar renoveras", "investering": 0, "underhall": 125000}, {"id": "post-37", "fastighet": "Gemensam", "ar": 2041, "kategori": "Installationer", "lage": "Tvättstuga", "namn": "Torktumlare BLÅ 2 st", "investering": 62500, "underhall": 0}, {"id": "post-38", "fastighet": "Gemensam", "ar": 2041, "kategori": "Installationer", "lage": "Tvättstuga", "namn": "Tvättmaskin BLÅ 1 st", "investering": 43750, "underhall": 0}, {"id": "post-39", "fastighet": "Gemensam", "ar": 2045, "kategori": "Installationer", "lage": "Energicentral", "namn": "Utbyte av expansionskärl", "investering": 62500, "underhall": 0}, {"id": "post-40", "fastighet": "Gemensam", "ar": 2046, "kategori": "Övrigt", "lage": "Övrigt", "namn": "Avsättning för årligt underhållsarbete", "investering": 62500, "underhall": 0}, {"id": "post-41", "fastighet": "Gemensam", "ar": 2046, "kategori": "Fasad", "lage": "Fönster", "namn": "Fönster målas", "investering": 500000, "underhall": 0}, {"id": "post-42", "fastighet": "Gemensam", "ar": 2046, "kategori": "Besiktningar", "lage": "Kontroller/Besiktningar", "namn": "OVK besiktning", "investering": 0, "underhall": 50000}, {"id": "post-43", "fastighet": "Tumvanten 1", "ar": 2046, "kategori": "Installationer", "lage": "Tvättstuga", "namn": "Torskskåp GRÖN 1 st", "investering": 50000, "underhall": 0}, {"id": "post-44", "fastighet": "Gemensam", "ar": 2047, "kategori": "Yttertak", "lage": "Tak", "namn": "Målning plåttak lokaler/passager", "investering": 125000, "underhall": 0}, {"id": "post-45", "fastighet": "Tumvanten 1", "ar": 2047, "kategori": "Installationer", "lage": "Tvättstuga", "namn": "Tvättmaskiner GRÖN 2 st", "investering": 131250, "underhall": 0}, {"id": "post-46", "fastighet": "Gemensam", "ar": 2051, "kategori": "Övrigt", "lage": "Övrigt", "namn": "Avsättning för årligt underhållsarbete", "investering": 62500, "underhall": 0}, {"id": "post-47", "fastighet": "Gemensam", "ar": 2051, "kategori": "Fasad", "lage": "Dörrar entré", "namn": "Entréportar och dörrar renoveras", "investering": 0, "underhall": 125000}, {"id": "post-48", "fastighet": "Gemensam", "ar": 2051, "kategori": "Installationer", "lage": "Energicentral", "namn": "Utbyte och injustering radiatorventiler", "investering": 625000, "underhall": 0}, {"id": "post-49", "fastighet": "Gemensam", "ar": 2052, "kategori": "Besiktningar", "lage": "Kontroller/Besiktningar", "namn": "OVK besiktning", "investering": 0, "underhall": 50000}, {"id": "post-50", "fastighet": "Gemensam", "ar": 2053, "kategori": "Installationer", "lage": "Solceller", "namn": "Byte solcellspaneler", "investering": 1562500, "underhall": 0}, {"id": "post-51", "fastighet": "Tumvanten 1", "ar": 2053, "kategori": "Installationer", "lage": "Ventilation", "namn": "Frånluftsfläktar gård Grön", "investering": 562500, "underhall": 0}, {"id": "post-52", "fastighet": "Gemensam", "ar": 2053, "kategori": "Installationer", "lage": "Solceller", "namn": "Solcellsanläggning, växelriktare", "investering": 75000, "underhall": 0}, {"id": "post-53", "fastighet": "Gemensam", "ar": 2053, "kategori": "Installationer", "lage": "Solceller", "namn": "Växelriktare Solceller", "investering": 312500, "underhall": 0}, {"id": "post-54", "fastighet": "Gemensam", "ar": 2055, "kategori": "Installationer", "lage": "Tvättstuga", "namn": "Torkfläktar", "investering": 50000, "underhall": 0}, {"id": "post-55", "fastighet": "Gemensam", "ar": 2056, "kategori": "Övrigt", "lage": "Övrigt", "namn": "Avsättning för årligt underhållsarbete", "investering": 62500, "underhall": 0}, {"id": "post-56", "fastighet": "Gemensam", "ar": 2056, "kategori": "Installationer", "lage": "Tvättstuga", "namn": "Mangel 2 st", "investering": 37500, "underhall": 0}, {"id": "post-57", "fastighet": "Tumvanten 1", "ar": 2056, "kategori": "Mark", "lage": "Utemiljö", "namn": "Murar gård Grön", "investering": 0, "underhall": 375000}, {"id": "post-58", "fastighet": "Gemensam", "ar": 2056, "kategori": "Installationer", "lage": "Tvättstuga", "namn": "Torktumlare BLÅ 2 st", "investering": 62500, "underhall": 0}, {"id": "post-59", "fastighet": "Gemensam", "ar": 2056, "kategori": "Installationer", "lage": "Tvättstuga", "namn": "Tvättmaskin BLÅ 1 st", "investering": 43750, "underhall": 0}, {"id": "post-60", "fastighet": "Gemensam", "ar": 2056, "kategori": "Installationer", "lage": "Energicentral", "namn": "Utbyte av fjärrvärmecentral", "investering": 500000, "underhall": 0}, {"id": "post-61", "fastighet": "Gemensam", "ar": 2056, "kategori": "Invändigt", "lage": "Tvättstuga", "namn": "Ytskikt i tvättstugor renoveras inkl torkrum", "investering": 0, "underhall": 750000}, {"id": "post-62", "fastighet": "Gemensam", "ar": 2057, "kategori": "Fasad", "lage": "Fasad", "namn": "Fasader tilläggsisolering, inkl nyputs", "investering": 11875000, "underhall": 0}, {"id": "post-63", "fastighet": "Gemensam", "ar": 2058, "kategori": "Besiktningar", "lage": "Kontroller/Besiktningar", "namn": "OVK besiktning", "investering": 0, "underhall": 50000}, {"id": "post-64", "fastighet": "Gemensam", "ar": 2058, "kategori": "Installationer", "lage": "Solceller", "namn": "Solcellsanläggning, tak", "investering": 1000000, "underhall": 0}, {"id": "post-65", "fastighet": "Spetshandsken 1", "ar": 2060, "kategori": "Installationer", "lage": "Ventilation", "namn": "Frånluftsfläktar gård BRUN", "investering": 312500, "underhall": 0}, {"id": "post-66", "fastighet": "Gemensam", "ar": 2061, "kategori": "Övrigt", "lage": "Övrigt", "namn": "Avsättning för årligt underhållsarbete", "investering": 62500, "underhall": 0}, {"id": "post-67", "fastighet": "Gemensam", "ar": 2061, "kategori": "Fasad", "lage": "Dörrar entré", "namn": "Entréportar och dörrar renoveras", "investering": 0, "underhall": 125000}, {"id": "post-68", "fastighet": "Tumvanten 1", "ar": 2061, "kategori": "Installationer", "lage": "Tvättstuga", "namn": "Torskskåp GRÖN 1 st", "investering": 50000, "underhall": 0}, {"id": "post-69", "fastighet": "Gemensam", "ar": 2062, "kategori": "Yttertak", "lage": "Tak", "namn": "Målning plåttak lokaler/passager", "investering": 125000, "underhall": 0}, {"id": "post-70", "fastighet": "Tumvanten 1", "ar": 2062, "kategori": "Installationer", "lage": "Tvättstuga", "namn": "Tvättmaskiner GRÖN 2 st", "investering": 131250, "underhall": 0}, {"id": "post-71", "fastighet": "Gemensam", "ar": 2063, "kategori": "Yttertak", "lage": "Tak", "namn": "Omläggning tak inkl plåt och taksäkerhet", "investering": 6250000, "underhall": 0}, {"id": "post-72", "fastighet": "Gemensam", "ar": 2064, "kategori": "Besiktningar", "lage": "Kontroller/Besiktningar", "namn": "OVK besiktning", "investering": 0, "underhall": 50000}, {"id": "post-73", "fastighet": "Gemensam", "ar": 2065, "kategori": "Invändigt", "lage": "Allmänna utrymmen", "namn": "Trapphus målas", "investering": 1875000, "underhall": 0}, {"id": "post-74", "fastighet": "Gemensam", "ar": 2066, "kategori": "Övrigt", "lage": "Övrigt", "namn": "Avsättning för årligt underhållsarbete", "investering": 62500, "underhall": 0}, {"id": "post-75", "fastighet": "Gemensam", "ar": 2066, "kategori": "Invändigt", "lage": "Energicentral", "namn": "Ytskikt renoveras i UC", "investering": 0, "underhall": 75000}, {"id": "post-76", "fastighet": "Spetshandsken 1", "ar": 2068, "kategori": "Mark", "lage": "Utemiljö", "namn": "Gård \"brun\" totalrenoveras inkl dagvatten", "investering": 4375000, "underhall": 0}, {"id": "post-77", "fastighet": "Gemensam", "ar": 2068, "kategori": "Installationer", "lage": "Solceller", "namn": "Solcellsanläggning, växelriktare", "investering": 75000, "underhall": 0}, {"id": "post-78", "fastighet": "Gemensam", "ar": 2068, "kategori": "Installationer", "lage": "Solceller", "namn": "Växelriktare Solceller", "investering": 312500, "underhall": 0}, {"id": "post-79", "fastighet": "Gemensam", "ar": 2070, "kategori": "Besiktningar", "lage": "Kontroller/Besiktningar", "namn": "OVK besiktning", "investering": 0, "underhall": 50000}, {"id": "post-80", "fastighet": "Gemensam", "ar": 2070, "kategori": "Installationer", "lage": "Tvättstuga", "namn": "Torkfläktar", "investering": 50000, "underhall": 0}, {"id": "post-81", "fastighet": "Gemensam", "ar": 2070, "kategori": "Installationer", "lage": "Energicentral", "namn": "Utbyte av expansionskärl", "investering": 62500, "underhall": 0}, {"id": "post-82", "fastighet": "Gemensam", "ar": 2071, "kategori": "Övrigt", "lage": "Övrigt", "namn": "Avsättning för årligt underhållsarbete", "investering": 62500, "underhall": 0}, {"id": "post-83", "fastighet": "Gemensam", "ar": 2071, "kategori": "Fasad", "lage": "Dörrar entré", "namn": "Entréportar och dörrar renoveras", "investering": 0, "underhall": 125000}, {"id": "post-84", "fastighet": "Gemensam", "ar": 2071, "kategori": "Installationer", "lage": "Tvättstuga", "namn": "Torktumlare BLÅ 2 st", "investering": 62500, "underhall": 0}, {"id": "post-85", "fastighet": "Gemensam", "ar": 2071, "kategori": "Installationer", "lage": "Tvättstuga", "namn": "Tvättmaskin BLÅ 1 st", "investering": 43750, "underhall": 0}];

const FASTIGHET_COLOR = {
  "Spetshandsken 1": { dot: "#a8562f", bg: "#f4e6dd", text: "#7c3d1f" },
  "Tumvanten 1": { dot: "#4a6b4d", bg: "#e3ebe1", text: "#33492f" },
  "Gemensam": { dot: "#8a8478", bg: "#ede9e2", text: "#5c564a" },
};

const CURRENT_YEAR = 2026;
const HORIZON = 2076;

function kr(n) {
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(n) + " kr";
}
function krCompact(n) {
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1).replace(".0", "") + " mkr";
  if (Math.abs(n) >= 1000) return Math.round(n / 1000) + " tkr";
  return n + " kr";
}

function yearlyTotals(items, fastighetFilter, fromYear, toYear) {
  const filtered = fastighetFilter === "Alla" ? items : items.filter((i) => i.fastighet === fastighetFilter);
  const byYear = {};
  for (let y = fromYear; y <= toYear; y++) byYear[y] = { ar: y, investering: 0, underhall: 0 };
  filtered.forEach((it) => {
    if (it.ar >= fromYear && it.ar <= toYear) {
      byYear[it.ar].investering += it.investering;
      byYear[it.ar].underhall += it.underhall;
    }
  });
  return Object.values(byYear);
}

const CHART_TO_YEAR = 2046;

export default function Underhallsplan() {
  const [items, setItems] = useState(SEED_ITEMS);
  const [draft, setDraft] = useState(SEED_ITEMS);
  const [fastighetFilter, setFastighetFilter] = useState("Alla");
  const [editingId, setEditingId] = useState(null);
  const [editYear, setEditYear] = useState("");
  const [savedNote, setSavedNote] = useState("");

  const hasPending = draft !== items && JSON.stringify(draft) !== JSON.stringify(items);

  const visibleItems = useMemo(() => {
    const list = fastighetFilter === "Alla" ? draft : draft.filter((i) => i.fastighet === fastighetFilter);
    return [...list].sort((a, b) => a.ar - b.ar);
  }, [draft, fastighetFilter]);

  const totalsCurrent = useMemo(() => yearlyTotals(items, fastighetFilter, CURRENT_YEAR, CHART_TO_YEAR), [items, fastighetFilter]);
  const totalsDraft = useMemo(() => yearlyTotals(draft, fastighetFilter, CURRENT_YEAR, CHART_TO_YEAR), [draft, fastighetFilter]);

  const chartData = totalsCurrent.map((row, idx) => ({
    ar: row.ar,
    "Nuvarande plan": row.investering + row.underhall,
    "Simulerad ändring": hasPending ? totalsDraft[idx].investering + totalsDraft[idx].underhall : undefined,
  }));

  function startEdit(item) {
    setEditingId(item.id);
    setEditYear(String(item.ar));
  }
  function commitEdit(item) {
    const newYear = parseInt(editYear, 10);
    if (!isNaN(newYear) && newYear >= 2020 && newYear <= 2100) {
      setDraft((prev) => prev.map((i) => (i.id === item.id ? { ...i, ar: newYear } : i)));
    }
    setEditingId(null);
  }
  function cancelEdit() {
    setEditingId(null);
  }
  function confirmChanges() {
    setItems(draft);
    setSavedNote("Ändringarna är bekräftade i planen (sparas lokalt i denna vy).");
    setTimeout(() => setSavedNote(""), 4000);
  }
  function discardChanges() {
    setDraft(items);
  }

  const totalInvestering = visibleItems.reduce((s, i) => s + i.investering, 0);
  const totalUnderhall = visibleItems.reduce((s, i) => s + i.underhall, 0);

  return (
    <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", background: "#faf7f2", minHeight: "100%", color: "#2b2620", padding: "0" }}>
      <style>{`
        * { box-sizing: border-box; }
        .sans { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        input[type=number]::-webkit-inner-spin-button { opacity: 1; }
        .row:hover { background: #f1ece2 !important; }
      `}</style>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "28px 20px 60px" }}>
        {/* Header */}
        <div style={{ borderBottom: "2px solid #c1592c", paddingBottom: 14, marginBottom: 20 }}>
          <div className="sans" style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a8562f", fontWeight: 600 }}>
            Brf Jenny Linds Gata · Spetshandsken 1 &amp; Tumvanten 1
          </div>
          <h1 style={{ fontSize: 30, margin: "4px 0 0", fontWeight: 400 }}>Underhållsplan &amp; ekonomisimulering</h1>
        </div>

        {/* Filter */}
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

        {/* Yearly cost chart */}
        <div style={{ background: "#fff", border: "1px solid #e4ddd0", borderRadius: 8, padding: "18px 16px 8px", marginBottom: 20 }}>
          <div className="sans" style={{ fontSize: 13, fontWeight: 600, color: "#5c564a", marginBottom: 8 }}>
            Total kostnad per år, {CURRENT_YEAR}–{CHART_TO_YEAR} ({fastighetFilter}) — underlag till budget
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee5d5" />
              <XAxis dataKey="ar" tick={{ fontSize: 11, fontFamily: "sans-serif" }} interval={1} />
              <YAxis tickFormatter={krCompact} tick={{ fontSize: 11, fontFamily: "sans-serif" }} width={60} />
              <Tooltip formatter={(v) => kr(v)} labelFormatter={(l) => `År ${l}`} contentStyle={{ fontFamily: "sans-serif", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontFamily: "sans-serif", fontSize: 12 }} />
              <Bar dataKey="Nuvarande plan" fill="#4a6b4d" radius={[3, 3, 0, 0]} />
              {hasPending && <Bar dataKey="Simulerad ändring" fill="#c1592c" radius={[3, 3, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
          <div className="sans" style={{ fontSize: 12, color: "#8a8478", padding: "4px 0 14px" }}>
            Visar planens totala kostnad (investering + underhåll) per år. Fördelning på faktisk finansiering (avgift, lån, kassa) hanteras i föreningens ordinarie budgetprocess, inte här.
          </div>
        </div>

        {/* Summary */}
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

        {/* Pending changes bar */}
        {hasPending && (
          <div className="sans" style={{ background: "#fdf1e7", border: "1px solid #e8b88f", borderRadius: 8, padding: "10px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#7c3d1f" }}>Osparade ändringar — se effekten i grafen ovan innan du bekräftar.</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={discardChanges} className="sans" style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 6, border: "1px solid #d8cfbe", background: "#fff", cursor: "pointer", fontSize: 13 }}><RotateCcw size={14} /> Ångra</button>
              <button onClick={confirmChanges} className="sans" style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 6, border: "none", background: "#c1592c", color: "#fff", cursor: "pointer", fontSize: 13 }}><Check size={14} /> Bekräfta ändring</button>
            </div>
          </div>
        )}
        {savedNote && <div className="sans" style={{ fontSize: 13, color: "#4a6b4d", marginBottom: 12 }}>{savedNote}</div>}

        {/* Table */}
        <div style={{ background: "#fff", border: "1px solid #e4ddd0", borderRadius: 8, overflow: "hidden" }}>
          <div className="sans" style={{ display: "grid", gridTemplateColumns: "70px 120px 1fr 110px 110px 40px", padding: "10px 14px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "#8a8478", borderBottom: "1px solid #eee5d5" }}>
            <div>År</div><div>Fastighet</div><div>Åtgärd</div><div style={{ textAlign: "right" }}>Investering</div><div style={{ textAlign: "right" }}>Underhåll</div><div />
          </div>
          <div style={{ maxHeight: 480, overflowY: "auto" }}>
            {visibleItems.map((item) => {
              const c = FASTIGHET_COLOR[item.fastighet];
              const isEditing = editingId === item.id;
              const changed = items.find((i) => i.id === item.id)?.ar !== item.ar;
              return (
                <div key={item.id} className="row sans" style={{ display: "grid", gridTemplateColumns: "70px 120px 1fr 110px 110px 40px", padding: "9px 14px", fontSize: 13, borderBottom: "1px solid #f3eee3", alignItems: "center", background: changed ? "#fdf6ee" : "transparent" }}>
                  <div>
                    {isEditing ? (
                      <input
                        autoFocus
                        type="number"
                        value={editYear}
                        onChange={(e) => setEditYear(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(item); if (e.key === "Escape") cancelEdit(); }}
                        style={{ width: 60, padding: "3px 5px", border: "1px solid #c1592c", borderRadius: 4, fontFamily: "inherit" }}
                      />
                    ) : (
                      <span style={{ fontWeight: changed ? 700 : 400 }}>{item.ar}</span>
                    )}
                  </div>
                  <div>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: c.bg, color: c.text, borderRadius: 12, padding: "2px 8px", fontSize: 11 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot }} />
                      {item.fastighet}
                    </span>
                  </div>
                  <div>
                    {item.namn}
                    <div style={{ fontSize: 11, color: "#a8a190" }}>{item.kategori} · {item.lage}</div>
                  </div>
                  <div style={{ textAlign: "right", color: item.investering ? "#2b2620" : "#c9c2b3" }}>{item.investering ? krCompact(item.investering) : "—"}</div>
                  <div style={{ textAlign: "right", color: item.underhall ? "#2b2620" : "#c9c2b3" }}>{item.underhall ? krCompact(item.underhall) : "—"}</div>
                  <div style={{ textAlign: "right" }}>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => commitEdit(item)} style={{ border: "none", background: "none", cursor: "pointer", color: "#4a6b4d" }}><Check size={15} /></button>
                        <button onClick={cancelEdit} style={{ border: "none", background: "none", cursor: "pointer", color: "#b23b3b" }}><X size={15} /></button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(item)} style={{ border: "none", background: "none", cursor: "pointer", color: "#c9c2b3" }} title="Flytta i planen"><Pencil size={14} /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="sans" style={{ fontSize: 12, color: "#a8a190", marginTop: 14, lineHeight: 1.6 }}>
          Data importerad från Planima-exporten (85 planerade åtgärder, 2025–2071). Fastighetstaggning bygger på nämnda "gård Grön"/"gård Brun" i åtgärdsnamnen — övriga poster är tillsvidare taggade som Gemensam i väntan på fördelningsnyckel.
        </div>
      </div>
    </div>
  );
}
