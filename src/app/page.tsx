import Link from "next/link";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { farSe } from "@/lib/permissions";

export default async function Home() {
  const profil = await getCurrentProfile();

  const lankar = [
    { href: "/underhallsplan", label: "Öppna underhållsplan", sida: "underhallsplan" as const, primar: true },
    { href: "/sba", label: "Systematiskt brandskyddsarbete", sida: "sba" as const, primar: false },
    { href: "/anmarkningar", label: "Anmärkningar att åtgärda", sida: "anmarkningar" as const, primar: false },
    { href: "/admin", label: "Användarhantering", sida: "admin" as const, primar: false },
  ].filter((l) => farSe(l.sida, profil?.roll));

  return (
    <div className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-stone-800">BrfJLG Fastighetsportal</h1>
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="text-sm text-stone-600 underline hover:text-stone-700"
            >
              Logga ut
            </button>
          </form>
        </div>

        {profil ? (
          <>
            <p className="mt-4 text-stone-600">
              Inloggad som <strong>{profil.namn}</strong> ({profil.roll}).
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {lankar.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={
                    l.primar
                      ? "inline-block rounded-md bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
                      : "inline-block rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50"
                  }
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-4 text-stone-600">
            Ingen profil hittades för din inloggning i <code>profiler</code>-tabellen.
          </p>
        )}
      </div>
    </div>
  );
}
