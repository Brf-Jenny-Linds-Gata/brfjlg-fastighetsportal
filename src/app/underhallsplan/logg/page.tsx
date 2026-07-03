import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { farSe } from "@/lib/permissions";
import { LoggClient } from "./LoggClient";

export default async function UnderhallsplanLoggPage() {
  const supabase = await createClient();
  const profil = await getCurrentProfile();

  if (!farSe("uh_logg", profil?.roll)) {
    redirect("/");
  }

  const { data, error } = await supabase
    .from("uh_andringslogg")
    .select("id, tidpunkt, falt, gammalt_varde, nytt_varde, post_id, uh_poster(namn), profiler(namn)")
    .order("tidpunkt", { ascending: false })
    .limit(300);

  if (error) {
    return (
      <div className="p-8 text-sm text-red-600">
        Kunde inte hämta ändringsloggen: {error.message}
      </div>
    );
  }

  const rader = (data ?? []).map((row) => {
    const post = Array.isArray(row.uh_poster) ? row.uh_poster[0] : row.uh_poster;
    const profil = Array.isArray(row.profiler) ? row.profiler[0] : row.profiler;
    return {
      id: row.id,
      tidpunkt: row.tidpunkt,
      falt: row.falt,
      gammaltVarde: row.gammalt_varde,
      nyttVarde: row.nytt_varde,
      postNamn: post?.namn ?? "(borttagen post)",
      andradAvNamn: profil?.namn ?? "Okänd",
    };
  });

  return <LoggClient rader={rader} />;
}
