#!/usr/bin/env bash
# =========================================================
# Källas (source) av run_migrations.sh och run_probe.sh INNAN de rör
# containern. Vägrar köra vidare om något tecken tyder på fel miljö —
# kodnivå-spärrar, inte bara README-instruktioner.
# =========================================================

EXPECTED_DIR_SEGMENT="brfjlg-security-test"
EXPECTED_CONTAINER="brfjlg_sectest_pg"
EXPECTED_IMAGE_PREFIX="ghcr.io/supabase/postgres"
PRODUCTION_REF="mghmedkjxrbolhtllkba"
DJUPVIK_REF="biindekdacqeouqfbzmr"
PRODUCTION_ORG="gpvqtyaadtetzingvgwg"
DJUPVIK_ORG="gnxamdgkqzupbvciowhb"

safety_guard_fail() {
  echo "SÄKERHETSSPÄRR: $1" >&2
  echo "Avbryter — ingen åtgärd vidtagen." >&2
  exit 1
}

# 1. Sökvägen måste innehålla den förväntade katalogsegmentet — stoppar
# körning om scriptet av misstag kopierats/körs från fel plats (t.ex.
# Djupviks katalog).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
case "$SCRIPT_DIR" in
  *"$EXPECTED_DIR_SEGMENT"*) : ;;
  *) safety_guard_fail "scriptets katalog ($SCRIPT_DIR) innehåller inte \"$EXPECTED_DIR_SEGMENT\"." ;;
esac

# 2. Ingen miljövariabel i det anropande skalet får innehålla kända
# Production- eller Djupvik-identifierare. Rent defensivt — inget i
# detta testpaket refererar till dem, men om skalet råkar ha ärvt en
# variabel från en annan session (t.ex. SUPABASE_PROJECT_REF satt av
# misstag) ska det upptäckas explicit i stället för att tyst ignoreras.
for needle in "$PRODUCTION_REF" "$DJUPVIK_REF" "$PRODUCTION_ORG" "$DJUPVIK_ORG" "supabase.co"; do
  if env | grep -q -- "$needle"; then
    safety_guard_fail "en miljövariabel i det anropande skalet innehåller \"$needle\" (Production/Djupvik-identifierare). Rensa skalets miljö innan du kör detta testpaket."
  fi
done

# 3. docker-compose.yml i denna katalog måste faktiskt vara det som
# beskrivs här — kontrollera projektnamnet i filen självt (inte bara
# att containern råkar heta rätt).
if [ -f "$SCRIPT_DIR/docker-compose.yml" ]; then
  if ! grep -q "^name: brfjlg-security-test" "$SCRIPT_DIR/docker-compose.yml"; then
    safety_guard_fail "docker-compose.yml i $SCRIPT_DIR saknar förväntat 'name: brfjlg-security-test' — filen kan vara fel eller manipulerad."
  fi
fi

# 4. Om containern redan kör: bekräfta att den faktiskt är VÅR container
# (rätt avbildning, rätt compose-projektnamn) innan något SQL skickas
# till den — annars kan psql-kommandon råka gå mot en annan, redan
# körande container med samma namn av misstag.
if docker inspect "$EXPECTED_CONTAINER" >/dev/null 2>&1; then
  actual_image=$(docker inspect -f '{{.Config.Image}}' "$EXPECTED_CONTAINER" 2>/dev/null)
  case "$actual_image" in
    "$EXPECTED_IMAGE_PREFIX"*) : ;;
    *) safety_guard_fail "containern $EXPECTED_CONTAINER kör oväntad avbildning \"$actual_image\" (förväntade \"$EXPECTED_IMAGE_PREFIX*\")." ;;
  esac

  actual_project=$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$EXPECTED_CONTAINER" 2>/dev/null)
  if [ "$actual_project" != "brfjlg-security-test" ]; then
    safety_guard_fail "containern $EXPECTED_CONTAINER tillhör compose-projektet \"$actual_project\", inte \"brfjlg-security-test\"."
  fi

  # 5. Portbindning måste vara localhost-only, aldrig alla interface.
  port_binding=$(docker port "$EXPECTED_CONTAINER" 5432 2>/dev/null || true)
  case "$port_binding" in
    127.0.0.1:*) : ;;
    "") : ;; # containern kör men porten är inte publicerad än — inget att kontrollera
    *) safety_guard_fail "port 5432 på $EXPECTED_CONTAINER är publicerad som \"$port_binding\" — förväntade bindning till 127.0.0.1, inte alla nätverksinterface." ;;
  esac
fi

echo "safety_guard.sh: samtliga miljökontroller godkända (katalog, env, compose-projekt, image, port)."
