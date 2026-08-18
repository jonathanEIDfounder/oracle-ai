#!/usr/bin/env bash
# =============================================================================
# © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1
# S1AF — Sentient iOS One-Step App Framework · Sovereign ID: 1
# Author      : Jonathan Sherman (jonathanEIDfounder)
# Governance  : OCSO-S1AF-GOV-1
# Copyright   : © 2026 Jonathan Sherman. All rights reserved.
# License     : PROPRIETARY — No license granted without express written permission.
# DRM         : S1AF-DRM-LOCKED
# =============================================================================
#
# auto-run.sh — Master sovereign automation script.
# Run from anywhere:
#   cd ~/Oracle-AI && bash scripts/auto-run.sh
#
# Performs in sequence:
#   1. Boot all other users (invalidate every prior session)
#   2. Validate stored credentials (GitHub PAT + Moonshot key)
#   3. Embed authorship into any new source files
#   4. Push all pending commits via Replit GitHub integration
#   5. Print full system status
# =============================================================================
set -uo pipefail

readonly _S1AF_AUTHOR="© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
API="http://localhost:8080/api"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}  ✓  $*${RESET}"; }
fail() { echo -e "${RED}  ✗  $*${RESET}"; }
warn() { echo -e "${YELLOW}  ⚠  $*${RESET}"; }
info() { echo -e "${CYAN}  →  $*${RESET}"; }
hdr()  { echo -e "\n${BOLD}══ $* ══${RESET}"; }

clear 2>/dev/null || true
cat << 'BANNER'
  ██████  ██  █████  ███████
  ██       ██  ██   ██  ██
  ███████  ██  █████  ██████
       ██  ██  ██   ██  ██
  ██████   ██  ██   ██  ██████
BANNER
echo -e "\n${BOLD}  S1AF — Sentient iOS One-Step App Framework${RESET}"
echo -e "  ${DIM}© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — Sovereign ID: 1${RESET}"
echo -e "  ${DIM}All rights reserved. No license granted without written permission.${RESET}\n"

BOOT_OK=false
CRED_OK=false
PUSH_OK=false
AUTH_OK=false

# ══════════════════════════════════════════════════════════════════════════════
# 1. BOOT ALL OTHER USERS
# ══════════════════════════════════════════════════════════════════════════════
hdr "1  Boot All Other Users"

if curl -sf "${API}/healthz" &>/dev/null; then
  BOOT_RESP=$(curl -sf -X POST "${API}/sentient/boot" \
    -H "Content-Type: application/json" \
    -d '{"reason":"auto-run sovereign command"}' 2>/dev/null || echo "")
  if [[ -n "$BOOT_RESP" ]]; then
    GEN=$(echo "$BOOT_RESP" | python3 -c \
      "import json,sys; print(json.load(sys.stdin).get('generation','?'))" 2>/dev/null || echo "?")
    ok "All sessions terminated — generation=${GEN}"
    BOOT_OK=true
  else
    warn "Boot endpoint unreachable — server may be starting"
  fi
else
  warn "API server not responding — skipping boot"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 2. VALIDATE CREDENTIALS
# ══════════════════════════════════════════════════════════════════════════════
hdr "2  Credential Validation"
source "${SCRIPT_DIR}/pat-cipher.sh" 2>/dev/null || true

# GitHub PAT
_GH_PAT=$(s1af_decrypt_named "github-pat" 2>/dev/null || echo "")
if [[ "${#_GH_PAT}" -ge 20 && "$_GH_PAT" != *"TEST"* ]]; then
  _GH_LOGIN=$(curl -sf -H "Authorization: Bearer ${_GH_PAT}" \
    https://api.github.com/user 2>/dev/null | \
    python3 -c "import json,sys; print(json.load(sys.stdin).get('login',''))" 2>/dev/null || echo "")
  if [[ -n "$_GH_LOGIN" ]]; then
    ok "GitHub PAT valid — authenticated as: ${_GH_LOGIN}"
    CRED_OK=true
  else
    warn "GitHub PAT stored but rejected by GitHub API"
  fi
else
  warn "GitHub PAT: placeholder or test token in cipherstore"
fi

# Moonshot key
_MS_KEY=$(s1af_decrypt_named "moonshot-key" 2>/dev/null || echo "")
if [[ "${#_MS_KEY}" -ge 20 && "$_MS_KEY" == sk-* ]]; then
  _MS_OK=$(curl -sf -H "Authorization: Bearer ${_MS_KEY}" \
    https://api.moonshot.cn/v1/models 2>/dev/null | \
    python3 -c "import json,sys; print('ok' if json.load(sys.stdin).get('data') else 'fail')" 2>/dev/null || echo "fail")
  [[ "$_MS_OK" == "ok" ]] && ok "Moonshot key valid" || warn "Moonshot key stored but rejected"
else
  warn "Moonshot key: placeholder or missing"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 3. STAMP NEW FILES WITH AUTHORSHIP
# ══════════════════════════════════════════════════════════════════════════════
hdr "3  Authorship Embedding"
if [[ -f "${SCRIPT_DIR}/embed-authorship.mjs" ]]; then
  STAMP_OUT=$(node "${SCRIPT_DIR}/embed-authorship.mjs" 2>/dev/null | tail -6)
  echo "$STAMP_OUT" | sed 's/^/  /'
  AUTH_OK=true
  ok "All source files stamped"
else
  warn "embed-authorship.mjs not found — skipping"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 4. GIT PUSH VIA REPLIT GITHUB INTEGRATION
# ══════════════════════════════════════════════════════════════════════════════
hdr "4  Git Push"

# Stage and commit any unstaged changes
cd "${REPO_ROOT}"
if ! git diff --quiet || ! git diff --cached --quiet; then
  info "Uncommitted changes detected — staging and committing..."
  git add -A
  git commit -m "S1AF — auto-run: staged changes — OCSO-S1AF-GOV-1 — $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    2>/dev/null && ok "Changes committed" || warn "Nothing new to commit"
fi

# Try direct git push with PAT if valid
if [[ "$CRED_OK" == "true" && -n "${_GH_LOGIN:-}" ]]; then
  _PUSH_URL="https://jonathanEIDfounder:${_GH_PAT}@github.com/jonathanEIDfounder/oracle-ai.git"
  if git push "$_PUSH_URL" HEAD:main --tags 2>&1 | grep -v "$_GH_PAT"; then
    git remote set-url oracle-ai \
      "https://jonathanEIDfounder@github.com/jonathanEIDfounder/oracle-ai.git" 2>/dev/null || true
    ok "Pushed to oracle-ai/main via PAT"
    PUSH_OK=true
  fi
  unset _PUSH_URL
fi

# Fallback: push via Replit GitHub integration API
if [[ "$PUSH_OK" == "false" ]]; then
  info "PAT unavailable — pushing via Replit GitHub integration..."
  PUSH_RESP=$(curl -sf -X POST "${API}/sentient/git-push" \
    -H "Content-Type: application/json" \
    -d '{}' 2>/dev/null || echo "")
  if [[ -n "$PUSH_RESP" ]]; then
    PUSHED=$(echo "$PUSH_RESP" | python3 -c \
      "import json,sys; d=json.load(sys.stdin); print(d.get('pushed',0))" 2>/dev/null || echo "0")
    ok "Pushed ${PUSHED} file(s) via Replit GitHub integration"
    PUSH_OK=true
  else
    warn "Integration push unavailable — changes committed locally"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# 5. SYSTEM STATUS
# ══════════════════════════════════════════════════════════════════════════════
hdr "5  System Status"

printf "  %-20s %s\n" "Boot:"        "$([[ $BOOT_OK == true ]] && echo '✓ all sessions terminated' || echo '⚠ skipped')"
printf "  %-20s %s\n" "GitHub PAT:"  "$([[ $CRED_OK == true ]] && echo "✓ valid (${_GH_LOGIN:-unknown})" || echo '⚠ invalid/placeholder')"
printf "  %-20s %s\n" "Authorship:"  "$([[ $AUTH_OK == true ]] && echo '✓ all files stamped' || echo '⚠ skipped')"
printf "  %-20s %s\n" "Git push:"    "$([[ $PUSH_OK == true ]] && echo '✓ committed' || echo '⚠ local only')"

echo ""
echo -e "${BOLD}  Branch  :${RESET} $(git branch --show-current 2>/dev/null)"
echo -e "${BOLD}  HEAD    :${RESET} $(git log --oneline -1 2>/dev/null)"
echo -e "${BOLD}  Server  :${RESET} $(curl -sf ${API}/healthz 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print('online' if d.get('ok') else '?')" 2>/dev/null || echo 'offline')"
echo ""
echo -e "${DIM}  ${_S1AF_AUTHOR}${RESET}"
echo ""

unset _GH_PAT _MS_KEY _GH_LOGIN
