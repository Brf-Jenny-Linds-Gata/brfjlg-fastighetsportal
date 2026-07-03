import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { AdminClient } from "./AdminClient";

export default async function AdminPage() {
  const profil = await getCurrentProfile();
  if (!profil || profil.roll !== "styrelse") {
    redirect("/");
  }

  return <AdminClient currentUserId={profil.id} />;
}
