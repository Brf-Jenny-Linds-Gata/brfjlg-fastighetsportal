#!/usr/bin/env bash
# =========================================================
# Applicerar db/001-010 + testidentiteter mot den isolerade
# testcontainern. Körs SENARE på NUC, inte i denna gate.
#
# Förutsätter att docker-compose.yml i denna katalog redan är
# uppe (se README.md) och att containern brfjlg_sectest_pg svarar.
# =========================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER="brfjlg_sectest_pg"

# shellcheck source=safety_guard.sh
source "$SCRIPT_DIR/safety_guard.sh"

# Robust db/-detektering: scriptet måste fungera både körande direkt ur
# repo-layouten (test/security/rls-integration/, db/ tre nivåer upp) och
# ur en NUC-kopia där hela katalogen kopierats platt och db/ i stället
# ligger bredvid scriptet (bekräftat på NUC 2026-07-30). Kontrollerar
# EXAKT dessa två kända layouter — faller aldrig tillbaka på en generisk
# uppåtsökning som skulle kunna hitta en godtycklig, oavsiktlig db/-
# katalog (t.ex. Djupviks) längre upp i katalogträdet.
if [ -f "$SCRIPT_DIR/db/001_init_schema.sql" ]; then
  REPO_ROOT="$SCRIPT_DIR"
elif [ -f "$SCRIPT_DIR/../../../db/001_init_schema.sql" ]; then
  REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
else
  echo "FEL: hittar inte db/001_init_schema.sql varken bredvid scriptet"
  echo "($SCRIPT_DIR/db/) eller tre nivåer upp ($SCRIPT_DIR/../../../db/)."
  echo "Kontrollera att repo-/NUC-layouten är intakt — ingen annan sökväg provas."
  exit 1
fi
echo "db/-katalog: $REPO_ROOT/db"

if ! docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true; then
  echo "FEL: containern $CONTAINER kör inte. Starta med 'docker compose up -d' i denna katalog först."
  exit 1
fi

apply() {
  echo ""
  echo ">>> Applying: $1"
  docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$1"
}

apply "$SCRIPT_DIR/000_bootstrap_roles_if_missing.sql"

# storage.objects finns eller finns inte oberoende av våra egna
# migrationer (kommer i så fall från avbildningens bas-init, se
# README "Storage — storage.objects, inte Storage API"). Kontrolleras
# EN gång, innan huvudloopen, för att avgöra om db/005 och storage-
# delen av db/010 kan appliceras överhuvudtaget i denna miljö.
# Bekräftat på NUC 2026-07-30: storage.objects saknas i
# ghcr.io/supabase/postgres:17.6.1.157 utan Storage-API-tjänsten.
STORAGE_EXISTS=$(docker exec -i "$CONTAINER" psql -U postgres -d postgres --no-psqlrc -X -q -A -t -c \
  "select (to_regclass('storage.objects') is not null)::text;" 2>/dev/null)
case "$STORAGE_EXISTS" in
  t|true) STORAGE_EXISTS=1 ;;
  *)      STORAGE_EXISTS=0 ;;
esac
echo "storage.objects finns i denna miljö: $([ "$STORAGE_EXISTS" -eq 1 ] && echo ja || echo nej)"

# db/002 innehåller medvetet två steg som MÅSTE köras som separata
# transaktioner (ny enum-etikett kan inte användas i samma transaktion
# den skapas i). psql:s standardläge (autocommit, en transaktion per
# semikolon-avslutad sats, ingen -1/single-transaction-flagga används
# här) uppfyller redan detta krav utan extra hantering.
for f in "$REPO_ROOT"/db/0*.sql; do
  base="$(basename "$f")"
  case "$base" in
    005_sba_foton_storage_policies.sql)
      if [ "$STORAGE_EXISTS" -eq 1 ]; then
        apply "$f"
      else
        echo ""
        echo ">>> SKIPPAR $base — storage.objects saknas i denna miljö."
      fi
      ;;
    010_require_profile_for_read_access.sql)
      if [ "$STORAGE_EXISTS" -eq 1 ]; then
        apply "$f"
      else
        echo ""
        echo ">>> $base: storage.objects saknas — applicerar ENDAST public-schema-delen."
        echo ">>> Production-filen ändras INTE. Den public-only-varianten genereras"
        echo ">>> automatiskt just nu, från den riktiga filen, genom att klippa vid"
        echo ">>> dess egen markörrad (ingen handhållen kopia som kan driva isär)."
        # Markören nedan MÅSTE matcha db/010_require_profile_for_read_access.sql
        # exakt (raden "-- ---------- Storage: sba-foton ----------"). Om
        # Production-filen redigeras och den raden ändras/flyttas, faller
        # detta tillbaka på "ingen matchning hittad" nedan i stället för att
        # tyst klippa fel — kontrollerat explicit.
        marker='^-- ---------- Storage: sba-foton ----------$'
        if ! grep -q "$marker" "$f"; then
          echo "FEL: hittar inte markörraden i $f — kan inte generera public-only-variant säkert."
          exit 1
        fi
        tmp_file="$(mktemp "${TMPDIR:-/tmp}/010_public_only_XXXXXX.sql")"
        awk -v m="$marker" '$0 ~ m {exit} {print}' "$f" > "$tmp_file"
        apply "$tmp_file"
        rm -f "$tmp_file"
      fi
      ;;
    *)
      apply "$f"
      ;;
  esac
done

apply "$SCRIPT_DIR/setup_test_identities.sql"

echo ""
echo "=========================================================="
echo "KLART: samtliga migrationer (db/001-010) + testidentiteter"
echo "applicerades utan att ON_ERROR_STOP avbröt körningen."
echo "-> Testmål 1 (migration 010 applicerbar utan syntaxfel/"
echo "   recursion vid ren tillämpning) är därmed uppfyllt."
echo "Kör nu ./run_probe.sh för testmål 2-6."
echo "=========================================================="
