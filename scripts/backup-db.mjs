// Dumpar alla tabeller till en tidsstämplad JSON-fil i scripts/backups/,
// så man har en återställningspunkt innan man labbar i produktions-DB.
// Detta är INTE ett substitut för riktiga databas-backuper (Supabase
// Dashboard → Database → Backups) — bara en snabb säkerhetsknapp för
// den här sortens experiment.
//
// Usage:
//   node --env-file=.env.local scripts/backup-db.mjs
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const TABELLER = [
  "profiler",
  "fastigheter",
  "portar",
  "uh_kategorier",
  "uh_poster",
  "uh_andringslogg",
  "sba_kontrollpunkter",
  "sba_kontroller",
  "sba_kontroll_resultat",
  "sba_anmarkningar",
];

const dump = {};

for (const tabell of TABELLER) {
  const { data, error } = await supabase.from(tabell).select("*");
  if (error) {
    console.error(`Kunde inte hämta ${tabell}:`, error.message);
    process.exit(1);
  }
  dump[tabell] = data;
  console.log(`${tabell}: ${data.length} rader`);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const backupDir = join(__dirname, "backups");
mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const filePath = join(backupDir, `backup-${stamp}.json`);
writeFileSync(filePath, JSON.stringify(dump, null, 2));

console.log(`\nBackup sparad: ${filePath}`);
