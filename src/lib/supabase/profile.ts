import { createClient } from "@/lib/supabase/server";

export type ProfilRoll = "styrelse" | "brandskyddsansvarig" | "medlem" | "entreprenör";

export type Profil = {
  id: string;
  namn: string;
  roll: ProfilRoll;
};

export async function getCurrentProfile(): Promise<Profil | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiler")
    .select("id, namn, roll")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;

  return data;
}
