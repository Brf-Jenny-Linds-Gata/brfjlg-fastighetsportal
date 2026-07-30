#!/usr/bin/env bash
# =========================================================
# RLS-integrationsprober mot den isolerade testcontainern.
# Körs SENARE på NUC, efter run_migrations.sh, inte i denna gate.
#
# Simulerar varje identitet genom SET ROLE + set_config('request.jwt.claims', ...)
# i en egen psql-session per prob (docker exec = ny anslutning varje
# gång, så inget läcker mellan identiteter). Inga riktiga JWT:er,
# inget GoTrue, inga magic links/invites är inblandade.
#
# Täcker testmål 2-6 från Fix Gate 3A:
#   2. profillös authenticated kan inte läsa data
#   3. styrelse/entreprenör har avsedd åtkomst (inkl. gemensam läsning)
#   4. anon har ingen åtkomst
#   5. service_role/admin-beteende opåverkat
#   6. storage-policyn för sba-foton fungerar
# =========================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER="brfjlg_sectest_pg"
PASS=0
FAIL=0
FAILED_CASES=()

# shellcheck source=safety_guard.sh
source "$SCRIPT_DIR/safety_guard.sh"

if ! docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true; then
  echo "FEL: containern $CONTAINER kör inte. Starta med 'docker compose up -d' och kör run_migrations.sh först."
  exit 1
fi

# --- mål 6 (storage) kräver att storage.objects faktiskt finns i denna
# avbildning innan container-start (bekräftat OSÄKERT vid Fix Gate 3B-
# granskningen — motstridiga fynd om huruvida den rena postgres-images
# init-scripts skapar storage.objects/storage.buckets, eller om det
# kräver att den separata Storage-API-tjänsten kört sina egna
# migrationer). Kontrollera existens explicit i stället för att anta —
# om tabellen saknas hoppas mål 6 över med ett tydligt SKIPPED, istället
# för att låta alla identiteters storage-prob visa "ERROR" och riskera
# att anon:s fall (som FÖRVÄNTAR sig ERROR) råkar se ut som ett giltigt
# PASS av fel anledning.
STORAGE_OK=$(docker exec -i "$CONTAINER" psql -U postgres -d postgres --no-psqlrc -X -q -A -t -c \
  "select (to_regclass('storage.objects') is not null)::text;" 2>/dev/null)

# Både "t" och "true" accepteras (samma boolesk textformat-variation som
# bekräftades för rolbypassrls på NUC 2026-07-30, se längre ned i scriptet).
if [ "$STORAGE_OK" != "t" ] && [ "$STORAGE_OK" != "true" ]; then
  echo "!! storage.objects hittades INTE i denna avbildning/containerstart."
  echo "!! Mål 6 (sba-foton) HOPPAS ÖVER — se README, avsnittet om storage-osäkerhet."
  echo "!! Mål 1-5 (migration/recursion/RLS/anon/service_role) påverkas inte."
  SKIP_STORAGE=1
else
  SKIP_STORAGE=0
  # --- syntetisk sba-foton-storageobjekt för mål 6 (skapas engångs, idempotent) ---
  docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
insert into storage.objects (bucket_id, name, owner, metadata)
select 'sba-foton', 'test/probe.jpg', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{}'::jsonb
where not exists (
  select 1 from storage.objects where bucket_id = 'sba-foton' and name = 'test/probe.jpg'
);
SQL
fi

# raw() kör en fråga som en given roll/identitet och returnerar
# antingen ett radantal (siffra) eller texten ERROR om Postgres
# kastade ett fel (t.ex. permission denied ELLER en eventuell
# recursion-bugg — båda syns här som ERROR, se recursion-fallet
# särskilt längre ned).
#
# VIKTIGT (uppdaterat vid Fix Gate 3B-granskning): auth.uid()/auth.role()
# i Supabases faktiska postgres-avbildning (verifierat mot källan i
# github.com/supabase/postgres, migrations/db/init-scripts/00000000000001-auth-schema.sql)
# läser INTE en enda JSON-blob under "request.jwt.claims" som tidigare
# antogs här — de läser separata, punktseparerade GUC-nycklar:
#   auth.uid()  -> current_setting('request.jwt.claim.sub', true)
#   auth.role() -> current_setting('request.jwt.claim.role', true)
# Båda konventionerna sätts därför defensivt nedan (den punktseparerade,
# som är den bekräftade, PLUS JSON-blobben som redundans om en annan
# image-variant skulle använda den) — annars skulle auth.uid() alltid
# returnera NULL och samtliga "styrelse"/"entreprenör"-prober falla
# igenom (högt, inte tyst — se README "Risk för falskt PASS").
raw() {
  local pg_role="$1" sub="$2" query="$3"
  local claims
  if [ -n "$sub" ]; then
    claims="{\"sub\":\"$sub\",\"role\":\"$pg_role\"}"
  else
    claims="{\"role\":\"$pg_role\"}"
  fi
  local out
  out=$(docker exec -i "$CONTAINER" psql -U postgres -d postgres --no-psqlrc -X -q -A -t 2>&1 <<SQL
set role $pg_role;
select set_config('request.jwt.claims', '$claims', false);
select set_config('request.jwt.claim.sub', '$sub', false);
select set_config('request.jwt.claim.role', '$pg_role', false);
$query
SQL
  )
  if echo "$out" | grep -qi "ERROR"; then
    echo "ERROR: $(echo "$out" | grep -i "ERROR" | head -1)"
  else
    echo "$out" | tail -1 | tr -d '[:space:]'
  fi
}

check() {
  local label="$1" result="$2" expect="$3"
  local status="FAIL"
  case "$expect" in
    error)   [[ "$result" == ERROR:* ]] && status="PASS" ;;
    zero)    [[ "$result" == "0" ]] && status="PASS" ;;
    nonzero) [[ "$result" =~ ^[0-9]+$ && "$result" != "0" ]] && status="PASS" ;;
    two)     [[ "$result" == "2" ]] && status="PASS" ;;
  esac
  if [ "$status" == "PASS" ]; then
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1))
    FAILED_CASES+=("$label (förväntat: $expect, fick: $result)")
  fi
  printf "%-70s %-6s (%s)\n" "$label" "$status" "$result"
}

TABLES="profiler fastigheter portar uh_kategorier uh_poster uh_andringslogg sba_kontrollpunkter sba_kontroller sba_kontroll_resultat sba_anmarkningar"

echo "=== Mål 4: anon har ingen åtkomst (förväntat: ERROR/permission denied) ==="
for t in $TABLES; do
  r=$(raw "anon" "" "select count(*) from $t;")
  check "anon -> $t" "$r" "error"
done
if [ "$SKIP_STORAGE" -eq 0 ]; then
  r=$(raw "anon" "" "select count(*) from storage.objects where bucket_id='sba-foton';")
  check "anon -> storage.objects(sba-foton)" "$r" "error"
else
  echo "anon -> storage.objects(sba-foton)                                    SKIPPED (tabell saknas)"
fi

echo ""
echo "=== Mål 2: profillös authenticated (cccccccc, ingen profiler-rad) -> 0 rader överallt ==="
for t in $TABLES; do
  r=$(raw "authenticated" "cccccccc-cccc-cccc-cccc-cccccccccccc" "select count(*) from $t;")
  check "profillös -> $t" "$r" "zero"
done
if [ "$SKIP_STORAGE" -eq 0 ]; then
  r=$(raw "authenticated" "cccccccc-cccc-cccc-cccc-cccccccccccc" "select count(*) from storage.objects where bucket_id='sba-foton';")
  check "profillös -> storage.objects(sba-foton)" "$r" "zero"
else
  echo "profillös -> storage.objects(sba-foton)                               SKIPPED (tabell saknas)"
fi

echo ""
echo "=== Mål 3: entreprenör (bbbbbbbb) har avsedd åtkomst ==="
for t in $TABLES; do
  r=$(raw "authenticated" "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" "select count(*) from $t;")
  # uh_andringslogg/sba_kontroller/sba_kontroll_resultat/sba_anmarkningar är
  # legitimt tomma i seed-datan (0 är alltså inte ett fel för just dessa) —
  # den riktiga signalen är FRÅNVARO av ERROR, kontrollerat separat nedan.
  if [[ "$r" == ERROR:* ]]; then
    FAIL=$((FAIL+1)); FAILED_CASES+=("entreprenör -> $t gav oväntat ERROR: $r")
    printf "%-70s %-6s (%s)\n" "entreprenör -> $t (ska INTE ge ERROR)" "FAIL" "$r"
  else
    PASS=$((PASS+1))
    printf "%-70s %-6s (%s)\n" "entreprenör -> $t (ska INTE ge ERROR)" "PASS" "$r"
  fi
done
r=$(raw "authenticated" "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" "select count(*) from profiler;")
check "entreprenör -> profiler (gemensam läsning, ska se BÅDA raderna = 2)" "$r" "two"
if [ "$SKIP_STORAGE" -eq 0 ]; then
  r=$(raw "authenticated" "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" "select count(*) from storage.objects where bucket_id='sba-foton';")
  check "entreprenör -> storage.objects(sba-foton)" "$r" "nonzero"
else
  echo "entreprenör -> storage.objects(sba-foton)                             SKIPPED (tabell saknas)"
fi

echo ""
echo "=== Mål 3: styrelse (aaaaaaaa) har avsedd åtkomst + recursion-kontroll på profiler ==="
r=$(raw "authenticated" "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" "select count(*) from profiler;")
check "styrelse -> profiler (recursion-kontroll: ska ge 2, INTE ERROR)" "$r" "two"
for t in $TABLES; do
  r=$(raw "authenticated" "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" "select count(*) from $t;")
  if [[ "$r" == ERROR:* ]]; then
    FAIL=$((FAIL+1)); FAILED_CASES+=("styrelse -> $t gav oväntat ERROR: $r")
    printf "%-70s %-6s (%s)\n" "styrelse -> $t (ska INTE ge ERROR)" "FAIL" "$r"
  else
    PASS=$((PASS+1))
    printf "%-70s %-6s (%s)\n" "styrelse -> $t (ska INTE ge ERROR)" "PASS" "$r"
  fi
done
if [ "$SKIP_STORAGE" -eq 0 ]; then
  r=$(raw "authenticated" "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" "select count(*) from storage.objects where bucket_id='sba-foton';")
  check "styrelse -> storage.objects(sba-foton)" "$r" "nonzero"
else
  echo "styrelse -> storage.objects(sba-foton)                                SKIPPED (tabell saknas)"
fi

echo ""
echo "=== Mål 5: service_role kringgår RLS helt (ingen jwt-koppling behövs) ==="
r=$(raw "service_role" "" "select count(*) from profiler;")
check "service_role -> profiler (bypass, ska ge 2 trots ingen egen auth.uid())" "$r" "two"
r=$(raw "service_role" "" "select rolbypassrls::text from pg_roles where rolname='service_role';")
# psql:s booleska textrepresentation skiljer sig mellan versioner/lägen
# ("t" vs "true") — bekräftat "true" mot ghcr.io/supabase/postgres:17.6.1.157
# på NUC 2026-07-30. Båda accepteras som PASS, allt annat är fortsatt FAIL.
if [[ "$r" == "t" || "$r" == "true" ]]; then
  PASS=$((PASS+1)); printf "%-70s %-6s (%s)\n" "service_role rolbypassrls = true" "PASS" "$r"
else
  FAIL=$((FAIL+1)); FAILED_CASES+=("service_role rolbypassrls förväntades 't'/'true', fick $r")
  printf "%-70s %-6s (%s)\n" "service_role rolbypassrls = true" "FAIL" "$r"
fi

echo ""
echo "=========================================================="
echo "RESULTAT: $PASS PASS, $FAIL FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Misslyckade fall:"
  for c in "${FAILED_CASES[@]}"; do echo "  - $c"; done
  exit 1
fi
echo "Alla prober godkända."
echo "=========================================================="
