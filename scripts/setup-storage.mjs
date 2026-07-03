// One-off setup script: creates the private Storage bucket used for SBA
// anmärkning photos. Safe to rerun (checks if the bucket already exists).
//
// Usage:
//   node --env-file=.env.local scripts/setup-storage.mjs
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const BUCKET = "sba-foton";

const { data: existing } = await supabase.storage.getBucket(BUCKET);

if (existing) {
  console.log(`Bucket "${BUCKET}" finns redan.`);
} else {
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: "10MB",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic"],
  });
  if (error) {
    console.error("Kunde inte skapa bucket:", error.message);
    process.exit(1);
  }
  console.log(`Bucket "${BUCKET}" skapad.`);
}

console.log(
  `\nKör nu db/005_sba_foton_storage_policies.sql i Supabase SQL Editor för att sätta åtkomstpolicyer på bucketen.`
);
