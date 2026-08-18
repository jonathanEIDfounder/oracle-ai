#!/usr/bin/env bash
# © 2026 Jonathan Sherman — S1AF · OCSO-S1AF-GOV-1
# scripts/get-tokens.sh — Automated credential acquisition + cipherstore sealing
#
# Usage:  bash scripts/get-tokens.sh
# Make:   make tokens
#
# What it does:
#   1. GitHub PAT   — device flow OAuth (no password); server polls + encrypts automatically
#   2. Moonshot key — secure stdin prompt; validates against API before storing
#   3. Seals both into live server via /api/sentient/seal-env

readonly _S1AF_AUTHOR="© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./pat-cipher.sh
source "${SCRIPT_DIR}/pat-cipher.sh"

SERVER_URL="${S1AF_SERVER_URL:-http://localhost:8080}"

# ─── Terminal colours ───────────────────────────────────────────────────────
RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[0;33m'
CYN='\033[0;36m'; BLD='\033[1m'; RST='\033[0m'

banner() { echo -e "\n${BLD}${CYN}━━  $1  ━━${RST}"; }
ok()     { echo -e "  ${GRN}✓${RST}  $*"; }
warn()   { echo -e "  ${YLW}⚠${RST}  $*"; }
err()    { echo -e "  ${RED}✗${RST}  $*"; }
info()   { echo -e "  ${BLD}→${RST}  $*"; }

echo ""
echo -e "${BLD}S1AF Token Acquisition — OCSO-S1AF-GOV-1${RST}"
echo -e "© 2026 Jonathan Sherman — All rights reserved"

# ────────────────────────────────────────────────────────────────────────────
# 1. GITHUB PAT — OAuth device flow (no browser login needed; just a code)
# ────────────────────────────────────────────────────────────────────────────
banner "STEP 1 · GitHub PAT (Device Flow)"

# Check current cipherstore
_EXISTING_GH=$(s1af_decrypt_named "github-pat" 2>/dev/null || echo "")
if [[ "${#_EXISTING_GH}" -ge 20 ]]; then
  _GH_CHECK=$(curl -sf -H "Authorization: Bearer ${_EXISTING_GH}" \
    https://api.github.com/user 2>/dev/null | \
    python3 -c "import json,sys; print(json.load(sys.stdin).get('login','FAIL'))" 2>/dev/null || echo "FAIL")
  if [[ "$_GH_CHECK" != "FAIL" ]]; then
    ok "Cipherstore has a valid GitHub PAT — user: ${_GH_CHECK}"
    info "Press Enter to keep it, or type 'refresh' to get a new one."
    read -r _GH_CHOICE
    if [[ "$_GH_CHOICE" != "refresh" ]]; then
      unset _EXISTING_GH _GH_CHECK _GH_CHOICE
      _GH_SKIP=1
    fi
    unset _GH_CHOICE
  else
    warn "Cipherstore PAT is invalid (GitHub rejected it) — acquiring new one"
  fi
fi
unset _EXISTING_GH _GH_CHECK

if [[ "${_GH_SKIP:-0}" != "1" ]]; then
  # Check server is up
  if ! curl -sf "${SERVER_URL}/api/healthz" >/dev/null 2>&1; then
    err "API server not running at ${SERVER_URL}"
    info "Start it first:  make run"
    info "Then re-run:      make tokens"
  else
    # Start device flow
    FLOW=$(curl -sf -X POST "${SERVER_URL}/api/auth/github-device/start" 2>/dev/null || echo "{}")
    CODE=$(echo "$FLOW" | python3 -c "import json,sys; print(json.load(sys.stdin).get('userCode','ERROR'))" 2>/dev/null || echo "ERROR")
    EXPIRES=$(echo "$FLOW" | python3 -c "import json,sys; print(json.load(sys.stdin).get('expiresAt','?'))" 2>/dev/null || echo "?")

    if [[ "$CODE" == "ERROR" ]]; then
      err "Device flow start failed — server may be restarting"
    else
      echo ""
      echo -e "  ┌──────────────────────────────────────────────┐"
      echo -e "  │  Open:  ${BLD}https://github.com/login/device${RST}     │"
      echo -e "  │  Code:  ${BLD}${YLW}${CODE}${RST}                          │"
      echo -e "  │  Exp:   ${EXPIRES}       │"
      echo -e "  └──────────────────────────────────────────────┘"
      echo ""
      info "Server is polling GitHub every 5 s — authorize in your browser..."
      echo ""

      APPROVED=0
      while true; do
        STATUS_JSON=$(curl -sf "${SERVER_URL}/api/auth/github-device/status" 2>/dev/null || echo '{"state":"error"}')
        STATE=$(echo "$STATUS_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin).get('state','error'))" 2>/dev/null || echo "error")
        POLLS=$(echo "$STATUS_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin).get('pollCount',0))" 2>/dev/null || echo "0")

        case "$STATE" in
          approved)
            MASK=$(echo "$STATUS_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin).get('tokenMask','?'))" 2>/dev/null || echo "?")
            ok "Authorized! Token ${MASK} — encrypted to cipherstore"
            APPROVED=1
            break ;;
          expired)
            err "Code expired. Re-run: make tokens"
            break ;;
          denied)
            err "Authorization denied by user."
            break ;;
          error)
            err "Server error during poll."
            break ;;
          *)
            printf "\r  %s  Polling... (%s checks)" "$(date -u +%H:%M:%S)" "$POLLS"
            sleep 5 ;;
        esac
      done
      echo ""
      [[ $APPROVED -eq 0 ]] && warn "GitHub PAT not acquired — Moonshot will still be processed"
    fi
  fi
fi
unset _GH_SKIP

# ────────────────────────────────────────────────────────────────────────────
# 2. MOONSHOT API KEY — secure stdin
# ────────────────────────────────────────────────────────────────────────────
banner "STEP 2 · Moonshot API Key"

# Check existing
_CUR_MS=$(s1af_decrypt_named "moonshot-key" 2>/dev/null || echo "")
_MS_VALID=0
if [[ "${#_CUR_MS}" -ge 20 && "$_CUR_MS" != *"TEST"* && "$_CUR_MS" != *"test"* ]]; then
  # Quick API check
  _MS_CHK=$(curl -sf -m 8 \
    -H "Authorization: Bearer ${_CUR_MS}" \
    https://api.moonshot.cn/v1/models 2>/dev/null | \
    python3 -c "import json,sys; d=json.load(sys.stdin); print('ok' if d.get('data') else 'fail')" 2>/dev/null || echo "fail")
  if [[ "$_MS_CHK" == "ok" ]]; then
    ok "Cipherstore already has a valid Moonshot key (len=${#_CUR_MS}, prefix=${_CUR_MS:0:6}…)"
    info "Press Enter to keep it, or paste a new key to replace:"
    _MS_VALID=1
  else
    warn "Cipherstore Moonshot key is invalid — enter your real key below"
  fi
fi
unset _CUR_MS _MS_CHK

# Prompt (hidden input)
printf "  Moonshot key (sk-..., hidden): "
read -rs MOONSHOT_INPUT
echo ""

if [[ -z "$MOONSHOT_INPUT" && $_MS_VALID -eq 1 ]]; then
  ok "Keeping existing Moonshot key"
elif [[ -z "$MOONSHOT_INPUT" ]]; then
  warn "No key entered — skipping (generation will remain locked)"
elif [[ "${#MOONSHOT_INPUT}" -lt 20 ]]; then
  err "Too short (${#MOONSHOT_INPUT} chars) — must be a real sk-... key"
else
  info "Validating against Moonshot API..."
  MS_RESULT=$(curl -sf -m 10 \
    -H "Authorization: Bearer ${MOONSHOT_INPUT}" \
    https://api.moonshot.cn/v1/models 2>/dev/null | \
    python3 -c "import json,sys; d=json.load(sys.stdin); print('ok' if d.get('data') else 'fail')" 2>/dev/null || echo "fail")

  if [[ "$MS_RESULT" == "ok" ]]; then
    s1af_encrypt_named "moonshot-key" "${MOONSHOT_INPUT}"
    ok "Moonshot key validated ✓ — encrypted to cipherstore (len=${#MOONSHOT_INPUT})"
  else
    warn "Moonshot API check inconclusive — storing anyway (verify key at platform.moonshot.cn)"
    s1af_encrypt_named "moonshot-key" "${MOONSHOT_INPUT}"
    ok "Stored (len=${#MOONSHOT_INPUT}, prefix=${MOONSHOT_INPUT:0:6}…)"
  fi
fi
unset MOONSHOT_INPUT _MS_VALID

# ────────────────────────────────────────────────────────────────────────────
# 3. CIPHERSTORE STATUS + LIVE SEAL
# ────────────────────────────────────────────────────────────────────────────
banner "STEP 3 · Cipherstore Status + Live Seal"

s1af_token_status_all

echo ""
info "Sealing into live server process..."
SEAL=$(curl -sf -m 15 -X POST "${SERVER_URL}/api/sentient/seal-env" \
  -H "Content-Type: application/json" 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "(server not running — restart to apply)")
echo "$SEAL"

echo ""
echo -e "${BLD}${GRN}━━  Token acquisition complete — S1AF armed  ━━${RST}"
echo -e "Sovereign: Jonathan Sherman · OCSO-S1AF-GOV-1"
echo ""
