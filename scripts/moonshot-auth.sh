#!/usr/bin/env bash
# =============================================================================
# S1AF — Moonshot API Key Bootstrap
# OCSO-S1AF-GOV-1 · Jonathan Sherman
#
# Reads MOONSHOT_API_KEY from environment, validates it against the
# Moonshot API, encrypts to cipherstore, and updates the server config.
#
# Run from the Replit Shell tab:
#   bash scripts/moonshot-auth.sh
#
# Or pass the key directly (never logged):
#   bash scripts/moonshot-auth.sh sk-YOUR_KEY
# =============================================================================

readonly _S1AF_AUTHOR="© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/pat-cipher.sh"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}  ✓ $*${RESET}"; }
fail() { echo -e "${RED}  ✗ $*${RESET}"; exit 1; }
warn() { echo -e "${YELLOW}  ⚠ $*${RESET}"; }
info() { echo -e "${CYAN}  → $*${RESET}"; }
hdr()  { echo -e "\n${BOLD}$*${RESET}"; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   S1AF — Moonshot API Key Bootstrap — OCSO-S1AF-GOV-1       ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${RESET}"
echo ""

# ─── Retrieve key ──────────────────────────────────────────────────────────────
hdr "Step 1 — Retrieve Moonshot API key"

if [[ $# -ge 1 && -n "${1:-}" ]]; then
  _KEY="$1"
  info "Source: CLI argument"
else
  _KEY="${MOONSHOT_API_KEY:-}"
  if [[ "${#_KEY}" -ge 30 && "$_KEY" == sk-* ]]; then
    info "Source: \$MOONSHOT_API_KEY environment variable"
  else
    # Prompt user to paste it (works in interactive Shell tab)
    echo ""
    echo -e "${YELLOW}  MOONSHOT_API_KEY is not set or invalid.${RESET}"
    echo -e "  Generate one at: ${CYAN}https://platform.moonshot.cn/console/api-keys${RESET}"
    echo ""
    echo -n "  Paste your Moonshot API key (sk-...): "
    read -rs _KEY
    echo ""
    [[ -z "$_KEY" ]] && fail "No key provided"
  fi
fi

_KEY="${_KEY//[$'\r\n\t ']/}"
[[ "${#_KEY}" -ge 20 ]] || fail "Key too short (${#_KEY} chars)"
[[ "$_KEY" == sk-* ]] || warn "Key prefix unexpected (expected sk-...) — continuing"
ok "Key retrieved: ${_KEY:0:6}…[OBFUSCATED] (${#_KEY} chars)"

# ─── Validate against Moonshot API ────────────────────────────────────────────
hdr "Step 2 — Validate against Moonshot API"

_RESP=$(curl -sf \
  -H "Authorization: Bearer ${_KEY}" \
  -H "Content-Type: application/json" \
  https://api.moonshot.cn/v1/models 2>/dev/null) \
  || fail "Moonshot API rejected key (401) or unreachable"

_MODELS=$(python3 -c \
  "import json,sys; d=json.load(sys.stdin); print(', '.join(m['id'] for m in d.get('data',[])[:3]))" \
  <<< "$_RESP" 2>/dev/null || echo "unknown")
ok "Moonshot key valid — models: ${_MODELS}"

# ─── Encrypt to cipherstore ────────────────────────────────────────────────────
hdr "Step 3 — Encrypt → cipherstore"

s1af_encrypt_named "moonshot-key" "$_KEY" || fail "Encryption failed"
ok "Encrypted → ~/.s1af-cipher/moonshot-key.enc  [AES-256-CBC PBKDF2]"
ok "Placeholder: [OBFUSCATED — decrypted at runtime]"

# ─── Patch live server CONFIG ──────────────────────────────────────────────────
hdr "Step 4 — Patch live server CONFIG"

_PATCH=$(curl -sf -X POST "http://localhost:8080/api/sentient/rotate-pat" \
  -H "Content-Type: application/json" \
  -H "X-S1AF-Bootstrap: true" \
  -d "{\"force\":true,\"moonshotKey\":\"${_KEY}\"}" 2>/dev/null \
  || echo '{"ok":false,"error":"unreachable"}')

_PATCH_OK=$(python3 -c \
  "import json,sys; d=json.load(sys.stdin); print(str(d.get('ok',False)).lower())" \
  <<< "$_PATCH" 2>/dev/null || echo "false")

if [[ "$_PATCH_OK" == "true" ]]; then
  ok "Live CONFIG patched — generation unlocked immediately"
else
  warn "Live patch skipped (requires restart to take effect)"
  info "Run: pnpm --filter @workspace/api-server run dev"
fi

# ─── Wipe raw key ──────────────────────────────────────────────────────────────
unset _KEY _RESP _PATCH _PATCH_OK

# ─── Status ────────────────────────────────────────────────────────────────────
hdr "Cipherstore status"
s1af_token_status "moonshot-key" | sed 's/^/  /'

echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}${BOLD}║   Moonshot Key Secured — OCSO-S1AF-GOV-1                    ║${RESET}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  Key at rest : [OBFUSCATED] ~/.s1af-cipher/moonshot-key.enc"
echo -e "  Next restart: cipherstore auto-warms CONFIG.moonshotKey"
echo ""
