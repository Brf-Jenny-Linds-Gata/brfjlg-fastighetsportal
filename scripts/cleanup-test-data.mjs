// One-off cleanup script: removes the specific test rows created while
// building/testing the app (see chat history 2026-07-03). Not meant to be
// reused — hardcoded IDs on purpose, so it can't accidentally delete
// anything created later.
//
// Usage:
//   node --env-file=.env.local scripts/cleanup-test-data.mjs
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const TEST_KONTROLL_IDS = [
  "08777e2f-a161-4857-9e05-88cec6e2a131", // Spetshandsken 1, Q1 2026 (pågående)
  "0d4a0fcc-a84f-4c19-84c0-77eeb09b69d2", // Spetshandsken 1, Q2 2026 (pågående)
  "e689ae78-3218-4d98-ab17-0e239498a30c", // Tumvanten 1, Q1 2026 (klar)
];
const TEST_UH_POST_ID = "ae300a51-f2c7-4a16-9daa-cbe2605f03ce"; // "testrad"

const { error: kontrollError, count: kontrollCount } = await supabase
  .from("sba_kontroller")
  .delete({ count: "exact" })
  .in("id", TEST_KONTROLL_IDS);

if (kontrollError) {
  console.error("Kunde inte radera sba_kontroller:", kontrollError.message);
  process.exit(1);
}
console.log(`Raderade ${kontrollCount} sba_kontroller (checklistesvar och anmärkningar togs bort automatiskt via cascade).`);

const { error: uhError, count: uhCount } = await supabase
  .from("uh_poster")
  .delete({ count: "exact" })
  .eq("id", TEST_UH_POST_ID);

if (uhError) {
  console.error("Kunde inte radera uh_poster:", uhError.message);
  process.exit(1);
}
console.log(`Raderade ${uhCount} uh_poster ("testrad").`);
