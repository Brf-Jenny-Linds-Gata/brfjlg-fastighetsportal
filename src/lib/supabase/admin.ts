import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getCurrentProfile, type Profil } from "@/lib/supabase/profile";
import { farSe } from "@/lib/permissions";

// Service-role client — bypasses Row Level Security entirely. Only ever
// call this from Route Handlers, and only after requireStyrelse() has
// confirmed the caller's session belongs to a styrelse member. Never use
// this client's result to answer requests from an unverified caller, and
// never import it into client-side code.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY saknas i .env.local — krävs för admin-funktioner (se README, avsnittet Överlämning)."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Verifies the current session belongs to a styrelse member. Returns the
// profile if so, otherwise null — callers must reject the request (403)
// when this returns null, since admin routes use the service-role client
// which has no RLS to fall back on.
export async function requireStyrelse(): Promise<Profil | null> {
  const profil = await getCurrentProfile();
  if (!farSe("admin", profil?.roll)) return null;
  return profil;
}
