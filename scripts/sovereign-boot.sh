#!/usr/bin/env bash
# =============================================================================
# S1AF — Sovereign Bootstrap + User Boot  (ONE command)
# OCSO-S1AF-GOV-1 · Jonathan Sherman
#
# Run from Replit Shell tab:
#   bash scripts/sovereign-boot.sh
#
# Does both:
#   1. Boots all other users (invalidates every existing session instantly)
#   2. Runs full credential bootstrap (GitHub + Moonshot + encrypt + push)
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API="http://localhost:8080/api"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}  ✓ $*${RESET}"; }
fail() { echo -e "${RED}  ✗ $*${RESET}" >&2; }
info() { echo -e "${CYAN}  → $*${RESET}"; }
hdr()  { echo -e "\n${BOLD}══ $* ══${RESET}"; }

clear 2>/dev/null || true
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║  S1AF Sovereign Boot — OCSO-S1AF-GOV-1                      ║${RESET}"
echo -e "${BOLD}║  © 2026 Jonathan Sherman — All rights reserved               ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${RESET}"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
# SECTION A — Boot all other users
# ══════════════════════════════════════════════════════════════════════════════
hdr "A  Boot All Other Users"

BOOT_RESP=$(curl -sf -X POST "${API}/sentient/boot" \
  -H "Content-Type: application/json" \
  -d '{"reason":"sovereign_command","sovereign":"1"}' 2>/dev/null || echo "")

if [[ -n "$BOOT_RESP" ]]; then
  GEN=$(echo "$BOOT_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('generation','?'))" 2>/dev/null || echo "?")
  BOOTED_AT=$(echo "$BOOT_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('bootedAt','?'))" 2>/dev/null || echo "?")
  ok "All sessions terminated — generation=${GEN}"
  ok "Booted at: ${BOOTED_AT}"
else
  # Server may not be up yet — still proceed with credential bootstrap
  fail "Server not reachable — proceeding with credential bootstrap only"
fi

# ══════════════════════════════════════════════════════════════════════════════
# SECTION B — Credential Bootstrap
# ══════════════════════════════════════════════════════════════════════════════
hdr "B  Credential Bootstrap"

source "${SCRIPT_DIR}/pat-cipher.sh"

# Check stored GitHub PAT
_STORED_PAT=$(s1af_decrypt_named "github-pat" 2>/dev/null || echo "")
_PAT_VALID=false

if [[ "${#_STORED_PAT}" -ge 20 && "$_STORED_PAT" != *"TEST"* ]]; then
  info "Validating stored GitHub token..."
  _GH_LOGIN=$(curl -sf -H "Authorization: Bearer ${_STORED_PAT}" \
    https://api.github.com/user 2>/dev/null | \
    python3 -c "import json,sys; print(json.load(sys.stdin).get('login',''))" 2>/dev/null || echo "")
  if [[ -n "$_GH_LOGIN" ]]; then
    ok "Stored token valid — authenticated as: ${_GH_LOGIN}"
    _PAT_VALID=true
    _GH_TOKEN="$_STORED_PAT"
  else
    fail "Stored token invalid — starting device flow"
  fi
fi

if [[ "$_PAT_VALID" == "false" ]]; then
  echo ""
  info "Starting GitHub OAuth device flow..."
  FLOW_RESP=$(curl -sf -X POST "${API}/auth/github-device/start" \
    -H "Content-Type: application/json" 2>/dev/null || echo "")

  USER_CODE=$(echo "$FLOW_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('userCode',''))" 2>/dev/null || echo "")
  VERIFY_URL=$(echo "$FLOW_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('verificationUri',''))" 2>/dev/null || echo "")
  EXPIRES=$(echo "$FLOW_RESP"   | python3 -c "import json,sys; print(json.load(sys.stdin).get('expiresAt',''))" 2>/dev/null || echo "")

  if [[ -n "$USER_CODE" ]]; then
    echo ""
    echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${RESET}"
    echo -e "${BOLD}║  GITHUB AUTHORIZATION REQUIRED                               ║${RESET}"
    echo -e "${BOLD}╠══════════════════════════════════════════════════════════════╣${RESET}"
    printf "${BOLD}║  URL  : %-52s ║\n${RESET}" "$VERIFY_URL"
    printf "${BOLD}║  CODE : %-52s ║\n${RESET}" "$USER_CODE"
    printf "${BOLD}║  EXP  : %-52s ║\n${RESET}" "$EXPIRES"
    echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${RESET}"
    echo ""
    echo -e "  Visit the URL above on your phone or computer and enter the code."
    echo -e "  Waiting for approval..."
    echo ""

    # Poll until approved or expired
    for _i in $(seq 1 180); do
      sleep 5
      _STATUS=$(curl -sf "${API}/auth/github-device/status" 2>/dev/null || echo "")
      _STATE=$(echo "$_STATUS" | python3 -c "import json,sys; print(json.load(sys.stdin).get('state','?'))" 2>/dev/null || echo "?")
      _MASK=$(echo  "$_STATUS" | python3 -c "import json,sys; print(json.load(sys.stdin).get('tokenMask') or '')" 2>/dev/null || echo "")
      _POLLS=$(echo "$_STATUS" | python3 -c "import json,sys; print(json.load(sys.stdin).get('pollCount','?'))" 2>/dev/null || echo "?")
      printf "  [%s] state=%-10s polls=%-3s token=%s\n" \
        "$(date -u +%H:%M:%S)" "$_STATE" "$_POLLS" "${_MASK:--}"

      if [[ "$_STATE" == "approved" ]]; then
        ok "GitHub authorized!"
        _PAT_VALID=true
        break
      fi
      [[ "$_STATE" == "expired" || "$_STATE" == "denied" || "$_STATE" == "error" ]] && {
        fail "Flow ended: $_STATE — re-run script for a new code"; break; }
    done
  else
    fail "Device flow start failed — is the API server running?"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# SECTION C — Git Push
# ══════════════════════════════════════════════════════════════════════════════
if [[ "$_PAT_VALID" == "true" && -n "${_GH_TOKEN:-}" ]]; then
  hdr "C  Git Push"
  REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
  _PENDING=$(git -C "$REPO_ROOT" log "oracle-ai/main..HEAD" --oneline 2>/dev/null || true)
  _COUNT=0
  [[ -n "$_PENDING" ]] && _COUNT=$(printf '%s\n' "$_PENDING" | grep -c '.' 2>/dev/null) || true

  if [[ "${_COUNT:-0}" -eq 0 ]]; then
    info "Remote is up to date — nothing to push"
  else
    info "Pushing ${_COUNT} commit(s)..."
    _PUSH_URL="https://jonathanEIDfounder:${_GH_TOKEN}@github.com/jonathanEIDfounder/oracle-ai.git"
    if git -C "$REPO_ROOT" push "$_PUSH_URL" HEAD:main --tags 2>&1 | grep -v "$_GH_TOKEN"; then
      git -C "$REPO_ROOT" remote set-url oracle-ai \
        "https://jonathanEIDfounder@github.com/jonathanEIDfounder/oracle-ai.git" 2>/dev/null || true
      ok "${_COUNT} commit(s) pushed to oracle-ai/main + tags"
    else
      git -C "$REPO_ROOT" remote set-url oracle-ai \
        "https://jonathanEIDfounder@github.com/jonathanEIDfounder/oracle-ai.git" 2>/dev/null || true
      fail "Push failed — check output above"
    fi
    unset _PUSH_URL
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# SECTION D — Final Status
# ══════════════════════════════════════════════════════════════════════════════
hdr "D  Status"
s1af_token_status_all | sed 's/^/  /'

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║  Sovereign Boot Complete — OCSO-S1AF-GOV-1                  ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${RESET}"
echo ""

unset _STORED_PAT _GH_TOKEN _GH_LOGIN
