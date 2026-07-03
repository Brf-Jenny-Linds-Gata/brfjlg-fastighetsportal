// Dev-only helper: generates a working magic-link sign-in URL without sending
// any email, using the Supabase admin API. Never used by the shipped app —
// run manually from a terminal when you need a real session for local testing.
//
// Usage:
//   node --env-file=.env.local scripts/dev-magic-link.mjs poffe@amble.se
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node --env-file=.env.local scripts/dev-magic-link.mjs <email>");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add SUPABASE_SERVICE_ROLE_KEY to webapp/.env.local (Supabase Dashboard → Settings → API → service_role secret) and rerun."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const { data, error } = await supabase.auth.admin.generateLink({
  type: "magiclink",
  email,
  options: { redirectTo: "http://localhost:3000/auth/dev-session" },
});

if (error) {
  console.error("Failed to generate link:", error.message);
  process.exit(1);
}

console.log("\nÖppna denna länk i webbläsaren (localhost:3000 måste köra):\n");
console.log(data.properties.action_link);
console.log();
