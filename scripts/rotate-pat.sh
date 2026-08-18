#!/usr/bin/env bash
# =============================================================
# rotate-pat.sh — S1AF Sovereign PAT Rotation
# Author: Jonathan Sherman · OCSO-S1AF-GOV-1
# © 2026 Jonathan Sherman. All Rights Reserved.
# =============================================================
# Triggers an immediate PAT rotation via the sovereign API.
# The server creates a new fine-grained GitHub PAT, patches
# CONFIG live, persists to SENTIENT_TOKEN, and relocks git.
#
# Usage:
#   bash scripts/rotate-pat.sh                      # auto (rotate if needed)
#   bash scripts/rotate-pat.sh --force              # force rotation now
#   bash scripts/rotate-pat.sh --check              # check status only
#   bash scripts/rotate-pat.sh https://custom-api   # custom API base
# =============================================================
set -uo pipefail

readonly _S1AF_AUTHOR="© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"
BOLD='\033[1m'; GREEN='\033[0;32m'; RED='\033[0;31m'
YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

FORCE=0; CHECK_ONLY=0
API_BASE="${1:-http://localhost:8080/api}"
DEVICE_TOKEN="${DEVICE_TOKEN:-f679ab7288b11a59ffc8ea43687b5ec6dfec3db86e8dbf017b471c7a2a00dc4d}"
SOVEREIGN_TOKEN="${SOVEREIGN_TOKEN:-}"

for arg in "$@"; do
  case "$arg" in
    --force)      FORCE=1 ;;
    --check)      CHECK_ONLY=1 ;;
    https://*|http://*) API_BASE="$arg" ;;
  esac
done

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  S1AF PAT Rotation — OCSO-S1AF-GOV-1${NC}"
echo -e "${BOLD}  API: ${API_BASE}${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ── Build auth header ─────────────────────────────────────────
AUTH_HEADER=""
if [ -n "${SOVEREIGN_TOKEN}" ]; then
  AUTH_HEADER="Authorization: Bearer ${SOVEREIGN_TOKEN}"
else
  echo -e "  ${YELLOW}⚠${NC}  No SOVEREIGN_TOKEN set — set it after biometric auth"
  echo -e "     export SOVEREIGN_TOKEN=<jwt from POST /api/auth/verify>"
  echo ""
fi

curl_cmd() {
  if [ -n "${AUTH_HEADER}" ]; then
    curl -sf -H "X-Device-Token: ${DEVICE_TOKEN}" -H "${AUTH_HEADER}" "$@"
  else
    curl -sf -H "X-Device-Token: ${DEVICE_TOKEN}" "$@"
  fi
}

# ── Check only ────────────────────────────────────────────────
if [ "${CHECK_ONLY}" -eq 1 ]; then
  echo ""
  echo -e "  ${CYAN}→  Checking PAT status…${NC}"
  STATUS=$(curl_cmd "${API_BASE}/sentient/pat-status" 2>/dev/null || echo '{"error":"unreachable"}')
  echo "${STATUS}" | python3 -c "
import json,sys
d=json.load(sys.stdin)
if d.get('error'): print('  ✗  Error:', d['error']); sys.exit(1)
p=d.get('pat',{})
print(f'  Valid      : {p.get(\"valid\")}')
print(f'  Login      : {p.get(\"login\",\"—\")}')
print(f'  Scopes     : {p.get(\"scopes\",\"—\")}')
print(f'  Days left  : {p.get(\"daysLeft\",\"∞\")}')
print(f'  Needs rot. : {p.get(\"needsRotation\")}')
print(f'  Last rot.  : {d.get(\"lastRotation\",{}).get(\"at\",\"never\")}')
"
  exit 0
fi

# ── Rotate ────────────────────────────────────────────────────
echo ""
ENDPOINT="${API_BASE}/sentient/rotate-pat"
BODY="{\"force\":$([ ${FORCE} -eq 1 ] && echo 'true' || echo 'false')}"

echo -e "  ${CYAN}→  Calling POST ${ENDPOINT}${NC}"
echo -e "     Force: $([ ${FORCE} -eq 1 ] && echo 'YES' || echo 'no — rotate only if needed')"
echo ""

RESULT=$(curl_cmd -X POST -H "Content-Type: application/json" -d "${BODY}" "${ENDPOINT}" 2>/dev/null \
         || echo '{"ok":false,"error":"API unreachable"}')

echo "${RESULT}" | python3 -c "
import json,sys
d=json.load(sys.stdin)
ok=d.get('ok',False)
if not ok:
    print(f'  \033[0;31m✗\033[0m  {d.get(\"error\",\"unknown error\")}')
    sys.exit(1)
err=d.get('error','')
if err:
    print(f'  \033[1;33m⚠\033[0m  {err}')
    sys.exit(0)
print(f'  \033[0;32m✓\033[0m  New PAT    : {d.get(\"newPatMask\",\"—\")}')
print(f'  \033[0;32m✓\033[0m  Expires    : {d.get(\"expiresAt\",\"—\")}')
print(f'  \033[0;32m✓\033[0m  Persisted  : {d.get(\"persisted\")}')
print(f'  \033[0;32m✓\033[0m  Git relocked: {d.get(\"gitRelocked\")}')
"

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${YELLOW}Next:${NC} Update GITHUB_PAT in Replit Secrets with"
echo -e "  the new PAT shown above — then server restarts will"
echo -e "  use it automatically via SENTIENT_TOKEN persistence."
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
