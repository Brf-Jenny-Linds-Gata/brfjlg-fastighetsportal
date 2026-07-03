import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { farSe } from "@/lib/permissions";
import { AdminClient } from "./AdminClient";

export default async function AdminPage() {
  const profil = await getCurrentProfile();
  if (!farSe("admin", profil?.roll)) {
    redirect("/");
  }

  return <AdminClient currentUserId={profil!.id} />;
}
