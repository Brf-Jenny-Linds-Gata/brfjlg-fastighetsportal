"use client";

import { useState, useId } from "react";
import { HelpCircle } from "lucide-react";

// Litet frågetecken som visar en förklarande text vid hover/fokus. Byggd med
// vanliga Tailwind-klasser (fungerar även på sidor som annars är
// inline-stylade, som underhållsplanen) så den kan återanvändas överallt.
export function Hjalp({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-describedby={id}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-stone-600 hover:text-stone-900"
      >
        <HelpCircle size={18} strokeWidth={2.25} />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-1.5 w-64 -translate-x-1/2 rounded-md border border-stone-200 bg-white p-2.5 text-xs font-normal normal-case leading-snug text-stone-700 shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
