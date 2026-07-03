import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { NyKontrollForm } from "./NyKontrollForm";

export default async function NySbaKontrollPage() {
  const profil = await getCurrentProfile();
  const kanSkapa = profil?.roll === "styrelse" || profil?.roll === "brandskyddsansvarig";
  if (!kanSkapa) {
    redirect("/sba");
  }

  const supabase = await createClient();
  const { data: fastigheter, error } = await supabase
    .from("fastigheter")
    .select("id, namn")
    .order("namn");

  if (error) {
    return <div className="p-8 text-sm text-red-600">Kunde inte hämta fastigheter: {error.message}</div>;
  }

  return <NyKontrollForm fastigheter={fastigheter ?? []} />;
}
