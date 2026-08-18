#!/usr/bin/env bash
# © 2026 Jonathan Sherman — S1AF · OCSO-S1AF-GOV-1
# scripts/quick-auth.sh — One command, two credentials, done.
#
# Run this in the Replit Shell tab:
#   bash scripts/quick-auth.sh
#
# What it does in <60 seconds:
#   1. Shows the live GitHub device code (or starts a fresh one)
#   2. Prompts once for your Moonshot sk-... key (hidden)
#   3. Seals both to AES-256 cipherstore immediately

set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
source scripts/pat-cipher.sh

SERVER="${S1AF_SERVER_URL:-http://localhost:8080}"
GRN='\033[0;32m'; YLW='\033[0;33m'; BLD='\033[1m'; RST='\033[0m'

echo ""
echo -e "${BLD}S1AF Quick Auth — OCSO-S1AF-GOV-1${RST}"
echo "────────────────────────────────────"

# ── 1. GitHub ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BLD}[1/2] GitHub PAT${RST}"

STATUS=$(curl -sf "${SERVER}/api/auth/github-device/status" 2>/dev/null || echo '{}')
STATE=$(echo "$STATUS" | python3 -c "import json,sys; print(json.load(sys.stdin).get('state','idle'))" 2>/dev/null || echo "idle")
CODE=$(echo "$STATUS"  | python3 -c "import json,sys; print(json.load(sys.stdin).get('userCode',''))"  2>/dev/null || echo "")

# Start fresh if not pending
if [[ "$STATE" != "pending" ]]; then
  FLOW=$(curl -sf -X POST "${SERVER}/api/auth/github-device/start" 2>/dev/null || echo '{}')
  CODE=$(echo "$FLOW" | python3 -c "import json,sys; print(json.load(sys.stdin).get('userCode','ERROR'))" 2>/dev/null || echo "ERROR")
  EXPR=$(echo "$FLOW" | python3 -c "import json,sys; print(json.load(sys.stdin).get('expiresAt','?'))"   2>/dev/null || echo "?")
  echo "  Started new device flow (expires ${EXPR})"
fi

echo ""
echo -e "  Open  : ${BLD}https://github.com/login/device${RST}"
echo -e "  Code  : ${BLD}${YLW}${CODE}${RST}"
echo ""
echo "  Server is polling automatically. Authorize in your browser,"
echo "  then token is captured + encrypted instantly. No further action."

# ── 2. Moonshot ───────────────────────────────────────────────────────────
echo ""
echo -e "${BLD}[2/2] Moonshot API Key${RST}"
echo "  Get yours at: https://platform.moonshot.cn/console/api-keys"
echo ""
printf "  Paste sk-... key (hidden): "
read -rs MOONSHOT_KEY
echo ""

if [[ -z "$MOONSHOT_KEY" ]]; then
  echo "  Skipped — no key entered"
elif [[ "${#MOONSHOT_KEY}" -lt 20 ]]; then
  echo "  ✗ Too short (${#MOONSHOT_KEY} chars) — must be a real sk-... key"
else
  printf "  Validating..."
  MS_OK=$(curl -sf -m 10 \
    -H "Authorization: Bearer ${MOONSHOT_KEY}" \
    https://api.moonshot.cn/v1/models 2>/dev/null | \
    python3 -c "import json,sys; d=json.load(sys.stdin); print('ok' if d.get('data') else 'fail')" 2>/dev/null || echo "fail")

  if [[ "$MS_OK" == "ok" ]]; then
    s1af_encrypt_named "moonshot-key" "${MOONSHOT_KEY}"
    echo -e " ${GRN}✓ Valid — encrypted to cipherstore${RST}"
  else
    echo " API check failed — is this a real sk-... key from platform.moonshot.cn?"
    printf "  Store it anyway? [y/N]: "
    read -r CONFIRM
    if [[ "$CONFIRM" == "y" || "$CONFIRM" == "Y" ]]; then
      s1af_encrypt_named "moonshot-key" "${MOONSHOT_KEY}"
      echo "  Stored (len=${#MOONSHOT_KEY})"
    fi
    unset CONFIRM
  fi
fi
unset MOONSHOT_KEY

# ── Done ──────────────────────────────────────────────────────────────────
echo ""
echo "────────────────────────────────────"
echo -e "${BLD}Next:${RST}"
echo "  1. Authorize GitHub in browser (code shown above)"
echo "  2. Run: make proceed"
echo ""
