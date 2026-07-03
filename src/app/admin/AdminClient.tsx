"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ProfilRoll } from "@/lib/supabase/profile";

type AdminUser = {
  id: string;
  namn: string;
  roll: ProfilRoll;
  epost: string;
  senastInloggad: string | null;
};

const ROLLER: ProfilRoll[] = ["styrelse", "brandskyddsansvarig", "medlem", "entreprenör"];

function formatDatum(iso: string | null) {
  if (!iso) return "Aldrig inloggad";
  return new Date(iso).toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" });
}

export function AdminClient({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [visaInbjudan, setVisaInbjudan] = useState(false);

  function laddaAnvandare() {
    return fetch("/api/admin/users")
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) setErrorMsg(body.error ?? "Kunde inte hämta användare.");
        else setUsers(body.users);
      });
  }

  useEffect(() => {
    laddaAnvandare();
  }, []);

  async function andraRoll(id: string, roll: ProfilRoll) {
    setErrorMsg("");
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roll }),
    });
    const body = await res.json();
    if (!res.ok) {
      setErrorMsg(body.error ?? "Kunde inte ändra roll.");
      return;
    }
    setUsers((prev) => prev?.map((u) => (u.id === id ? { ...u, roll } : u)) ?? null);
  }

  async function taBort(id: string, namn: string) {
    if (!confirm(`Ta bort ${namn}? Detta går inte att ångra.`)) return;
    setErrorMsg("");
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      setErrorMsg(body.error ?? "Kunde inte ta bort användaren.");
      return;
    }
    setUsers((prev) => prev?.filter((u) => u.id !== id) ?? null);
  }

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-stone-600 underline hover:text-stone-800">
          ← Startsida
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-stone-800">Användarhantering</h1>
          <button
            onClick={() => setVisaInbjudan((v) => !v)}
            className="rounded-md bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
          >
            Bjud in ny användare
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {visaInbjudan && (
          <InbjudanForm
            onSkapad={(u) => {
              setUsers((prev) => (prev ? [...prev, u] : [u]));
              setVisaInbjudan(false);
            }}
            onFel={(msg) => setErrorMsg(msg)}
          />
        )}

        <div className="mt-6 overflow-hidden rounded-lg border border-stone-200 bg-white">
          <div className="hidden grid-cols-[1fr_1fr_160px_180px_40px] gap-2 border-b border-stone-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-600 sm:grid">
            <div>Namn</div>
            <div>E-post</div>
            <div>Roll</div>
            <div>Senast inloggad</div>
            <div />
          </div>

          {users === null && <div className="px-4 py-6 text-sm text-stone-600">Laddar…</div>}
          {users?.length === 0 && <div className="px-4 py-6 text-sm text-stone-600">Inga användare hittades.</div>}

          {users?.map((u) => (
            <div key={u.id} className="border-b border-stone-100 px-4 py-3 text-sm last:border-0">
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-[1fr_1fr_160px_180px_40px] sm:items-center sm:gap-2">
                <div className="font-medium text-stone-800">{u.namn}</div>
                <div className="text-stone-700">{u.epost}</div>
                <div>
                  <select
                    value={u.roll}
                    onChange={(e) => andraRoll(u.id, e.target.value as ProfilRoll)}
                    className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-900"
                  >
                    {ROLLER.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-xs text-stone-600">{formatDatum(u.senastInloggad)}</div>
                <div className="text-right">
                  {u.id !== currentUserId && (
                    <button
                      onClick={() => taBort(u.id, u.namn)}
                      className="text-xs text-red-600 underline hover:text-red-800"
                    >
                      Ta bort
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InbjudanForm({
  onSkapad,
  onFel,
}: {
  onSkapad: (u: AdminUser) => void;
  onFel: (msg: string) => void;
}) {
  const [namn, setNamn] = useState("");
  const [epost, setEpost] = useState("");
  const [roll, setRoll] = useState<ProfilRoll>("medlem");
  const [sparar, setSparar] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!namn.trim() || !epost.trim()) return;
    setSparar(true);
    onFel("");

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ namn: namn.trim(), email: epost.trim(), roll }),
    });
    const body = await res.json();
    setSparar(false);

    if (!res.ok) {
      onFel(body.error ?? "Kunde inte bjuda in användaren.");
      return;
    }

    onSkapad(body.user);
    setNamn("");
    setEpost("");
    setRoll("medlem");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white p-4"
    >
      <div>
        <label className="block text-xs font-medium text-stone-700">Namn</label>
        <input
          value={namn}
          onChange={(e) => setNamn(e.target.value)}
          className="mt-1 rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-700">E-post</label>
        <input
          type="email"
          value={epost}
          onChange={(e) => setEpost(e.target.value)}
          className="mt-1 rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-700">Roll</label>
        <select
          value={roll}
          onChange={(e) => setRoll(e.target.value as ProfilRoll)}
          className="mt-1 rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900"
        >
          {ROLLER.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={sparar}
        className="rounded-md bg-stone-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
      >
        {sparar ? "Skickar…" : "Skicka inbjudan"}
      </button>
    </form>
  );
}
