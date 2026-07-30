#!/usr/bin/env bash
# =========================================================
# Säker, avgränsad nedmontering av ENDAST detta testpaket.
#
# Tar ALDRIG bort något annat än:
#   - Compose-projektet "brfjlg-security-test"
#   - volymen "brfjlg_sectest_pgdata"
#   - nätverket Compose skapade för detta projekt
#
# Rör ALDRIG:
#   - Djupviks containrar/volymer/nätverk
#   - andra Docker-projekt på NUC
#   - något utanför denna katalog
#
# Använder inga wildcards, ingen "docker system prune", ingen
# generell volume-prune, ingen rm -rf. Följer inga symlänkar utanför
# denna katalog (realpath-kontroll nedan).
# =========================================================
set -euo pipefail

EXPECTED_DIR_SEGMENT="brfjlg-security-test"
EXPECTED_PROJECT="brfjlg-security-test"
EXPECTED_VOLUME="brfjlg_sectest_pgdata"
EXPECTED_CONTAINER="brfjlg_sectest_pg"

SCRIPT_DIR_RAW="$(dirname "${BASH_SOURCE[0]}")"
# realpath -e kräver att katalogen faktiskt existerar och löser ALDRIG
# igenom en symlänk till något oväntat utan att vi ser det upplösta
# resultatet härnäst.
SCRIPT_DIR="$(realpath -e "$SCRIPT_DIR_RAW")"

case "$SCRIPT_DIR" in
  *"$EXPECTED_DIR_SEGMENT"*) : ;;
  *)
    echo "SÄKERHETSSPÄRR: upplöst katalog ($SCRIPT_DIR) innehåller inte \"$EXPECTED_DIR_SEGMENT\"." >&2
    echo "Avbryter — ingenting togs bort." >&2
    exit 1
    ;;
esac

if [ -f "$SCRIPT_DIR/docker-compose.yml" ]; then
  if ! grep -q "^name: $EXPECTED_PROJECT" "$SCRIPT_DIR/docker-compose.yml"; then
    echo "SÄKERHETSSPÄRR: docker-compose.yml saknar förväntat 'name: $EXPECTED_PROJECT'." >&2
    exit 1
  fi
fi

echo "=========================================================="
echo "FÖRHANDSGRANSKNING — detta kommer att tas bort:"
echo "=========================================================="
echo ""
echo "Katalog (upplöst): $SCRIPT_DIR"
echo ""
echo "-- Compose-projekt \"$EXPECTED_PROJECT\" (docker compose down): --"
(cd "$SCRIPT_DIR" && docker compose ps --format '  {{.Name}}\t{{.Image}}\t{{.Status}}' 2>/dev/null) || echo "  (inga körande tjänster hittades)"
echo ""
echo "-- Volym som kommer tas bort: --"
docker volume ls --filter "name=^${EXPECTED_VOLUME}\$" --format '  {{.Name}}' || true
echo ""
echo "-- Nätverk kopplat till projektet (om något): --"
docker network ls --filter "label=com.docker.compose.project=${EXPECTED_PROJECT}" --format '  {{.Name}}' || true
echo ""
echo "Inget annat rörs. Inga andra Docker-projekt, inga Djupvik-resurser,"
echo "ingen 'docker system prune', ingen generell volume-prune."
echo ""

read -r -p "Skriv exakt \"RADERA $EXPECTED_PROJECT\" för att bekräfta: " confirmation
if [ "$confirmation" != "RADERA $EXPECTED_PROJECT" ]; then
  echo "Bekräftelse matchade inte — avbryter. Ingenting togs bort."
  exit 1
fi

echo ""
echo ">>> docker compose down (endast detta projekt)"
(cd "$SCRIPT_DIR" && docker compose down)

echo ">>> docker volume rm $EXPECTED_VOLUME (exakt namn, ingen wildcard)"
docker volume rm "$EXPECTED_VOLUME" 2>/dev/null || echo "  (volymen fanns inte, eller redan borttagen)"

echo ""
echo "Klart. Endast $EXPECTED_PROJECT-resurser rördes."
echo "Verifiera själv att Djupviks miljö är opåverkad:"
echo "  docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}'"
