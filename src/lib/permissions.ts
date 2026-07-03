import type { ProfilRoll } from "@/lib/supabase/profile";

// Central karta över vilka roller som får se vilka delar av appen. Detta är
// bara UI-/sidåtkomst (bekvämlighet + tydlighet), INTE säkerhetsgränsen —
// den riktiga gränsen är RLS-policyerna i databasen (se db/*.sql), som
// gäller oavsett vad den här filen säger. Ändra bara den här filen om du
// vill flytta en flik/sida till en annan roll; RLS-policyerna styr
// fortfarande vad rollen faktiskt får läsa/skriva.
export type SidNyckel = "underhallsplan" | "sba" | "anmarkningar" | "admin" | "uh_logg";

const SID_ROLLER: Record<SidNyckel, ProfilRoll[]> = {
  underhallsplan: ["styrelse", "medlem"],
  sba: ["styrelse", "brandskyddsansvarig"],
  anmarkningar: ["styrelse", "brandskyddsansvarig", "entreprenör"],
  admin: ["styrelse"],
  uh_logg: ["styrelse", "medlem"],
};

export function farSe(sida: SidNyckel, roll: ProfilRoll | null | undefined): boolean {
  if (!roll) return false;
  return SID_ROLLER[sida].includes(roll);
}
