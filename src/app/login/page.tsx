"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-stone-50 px-4">
      <div
        className="pointer-events-none absolute inset-0 bg-[url('/images/tulpaner.webp')] bg-cover bg-top opacity-55"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(250,250,249,0.85)_0%,rgba(250,250,249,0.8)_35%,rgba(250,250,249,0.4)_65%,rgba(250,250,249,0.05)_100%)]"
        aria-hidden="true"
      />
      <div className="relative w-full max-w-sm rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-stone-800">BrfJLG Fastighetsportal</h1>
        <p className="mt-1 text-sm text-stone-600">Logga in med din e-postadress.</p>

        {status === "sent" ? (
          <p className="mt-6 text-sm text-stone-700">
            Vi har skickat en inloggningslänk till <strong>{email}</strong>. Öppna den för att
            logga in.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-stone-700">
                E-post
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="namn@brfjlg.se"
                className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none"
              />
            </div>
            {status === "error" && <p className="text-sm text-red-600">{errorMsg}</p>}
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-md bg-stone-800 px-3 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
            >
              {status === "sending" ? "Skickar länk…" : "Skicka inloggningslänk"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
