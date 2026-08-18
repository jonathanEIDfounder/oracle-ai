#!/usr/bin/env bash
# =============================================================================
# S1AF — Full Credential Bootstrap  (ONE command)
# OCSO-S1AF-GOV-1 · Jonathan Sherman
#
# Run once from the Replit Shell tab:
#   bash scripts/auth-all.sh
#
# Handles everything automatically:
#   GITHUB  → OAuth device flow (visit one URL, enter 8-char code)
#   MOONSHOT→ paste sk-... key once (interactive read, never logged)
#   Both    → AES-256 encrypted → cipherstore → CONFIG warmed → git push
# =============================================================================

readonly _S1AF_AUTHOR="© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

source "${SCRIPT_DIR}/pat-cipher.sh"

# ── Colour helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}  ✓ $*${RESET}"; }
fail() { echo -e "${RED}  ✗ $*${RESET}" >&2; exit 1; }
warn() { echo -e "${YELLOW}  ⚠ $*${RESET}"; }
info() { echo -e "${CYAN}  → $*${RESET}"; }
hdr()  { echo -e "\n${BOLD}══ $* ══${RESET}"; }
box()  {
  local w=64
  echo -e "${BOLD}╔$(printf '═%.0s' $(seq 1 $w))╗${RESET}"
  printf "${BOLD}║  %-${w}s║\n${RESET}" "$1"
  echo -e "${BOLD}╚$(printf '═%.0s' $(seq 1 $w))╝${RESET}"
}

clear 2>/dev/null || true
box "S1AF Credential Bootstrap — OCSO-S1AF-GOV-1"
echo -e "  ${DIM}© 2026 Jonathan Sherman — All rights reserved${RESET}"
echo ""

GH=$(command -v gh 2>/dev/null || echo "/repl/ctls/bin/gh")
[[ -x "$GH" ]] || fail "gh CLI not found"

# ══════════════════════════════════════════════════════════════════════════════
# SECTION A — GitHub OAuth Device Flow
# ══════════════════════════════════════════════════════════════════════════════
hdr "A  GitHub Authentication"

_GH_TOKEN=""
_GH_LOGIN=""

# Check existing valid auth first
if "$GH" auth status --hostname github.com &>/dev/null; then
  _GH_TOKEN=$("$GH" auth token --hostname github.com 2>/dev/null || true)
  _GH_LOGIN=$("$GH" api user --jq '.login' 2>/dev/null || echo "unknown")
  if [[ "${#_GH_TOKEN}" -ge 20 ]]; then
    ok "Already authenticated as: ${_GH_LOGIN}"
    info "Skipping device flow — using existing session"
  else
    _GH_TOKEN=""
  fi
fi

if [[ -z "$_GH_TOKEN" ]]; then
  echo ""
  echo -e "${YELLOW}${BOLD}  GitHub Device Flow:${RESET}"
  echo -e "  A code will appear below. Visit the URL on any device and enter it."
  echo -e "  This script will wait and complete automatically once you approve."
  echo ""

  # Run device flow (works in TTY Shell tab)
  "$GH" auth login \
      --hostname    github.com \
      --git-protocol https \
      --scopes      "repo,workflow" \
      2>&1 || \
  "$GH" auth login \
      --hostname    github.com \
      --git-protocol https \
      2>&1 || fail "GitHub device flow failed. Run from the Replit Shell tab (needs TTY)."

  _GH_TOKEN=$("$GH" auth token --hostname github.com 2>/dev/null || true)
  _GH_LOGIN=$("$GH" api user --jq '.login' 2>/dev/null || echo "unknown")
  [[ "${#_GH_TOKEN}" -ge 20 ]] || fail "Token extraction failed after auth"
  ok "Authenticated as: ${_GH_LOGIN}"
fi

# Encrypt GitHub token
info "Encrypting → ~/.s1af-cipher/github-pat.enc"
s1af_encrypt_named "github-pat" "$_GH_TOKEN" || fail "GitHub token encryption failed"
ok "GitHub token → [OBFUSCATED] (AES-256-CBC)"

# ══════════════════════════════════════════════════════════════════════════════
# SECTION B — Moonshot API Key
# ══════════════════════════════════════════════════════════════════════════════
hdr "B  Moonshot API Key"

_MS_KEY=""

# Try env first
_ENV_MS="${MOONSHOT_API_KEY:-}"
if [[ "${#_ENV_MS}" -ge 30 && "$_ENV_MS" == sk-* ]]; then
  _MS_KEY="$_ENV_MS"
  info "Source: \$MOONSHOT_API_KEY env var"
fi

# Try cipherstore
if [[ -z "$_MS_KEY" ]]; then
  _STORED=$(s1af_decrypt_named "moonshot-key" 2>/dev/null || true)
  if [[ "${#_STORED}" -ge 30 && "$_STORED" == sk-* ]]; then
    _MS_KEY="$_STORED"
    info "Source: cipherstore"
  fi
  unset _STORED
fi

# Interactive prompt as last resort
if [[ -z "$_MS_KEY" ]]; then
  echo ""
  echo -e "${YELLOW}  Moonshot API key needed.${RESET}"
  echo -e "  Generate at: ${CYAN}https://platform.moonshot.cn/console/api-keys${RESET}"
  echo -e "  Click 'Create API Key' → copy the ${BOLD}sk-...${RESET} string"
  echo ""
  echo -n "  Paste Moonshot API key (sk-...): "
  read -rs _MS_KEY
  echo ""
  _MS_KEY="${_MS_KEY//[$'\r\n\t ']/}"
  [[ -z "$_MS_KEY" ]] && { warn "Skipping Moonshot key — generation will remain locked"; _MS_KEY=""; }
fi

if [[ -n "$_MS_KEY" ]]; then
  # Validate
  info "Validating against Moonshot API..."
  _MS_RESP=$(curl -sf \
    -H "Authorization: Bearer ${_MS_KEY}" \
    https://api.moonshot.cn/v1/models 2>/dev/null) && {
    _MODELS=$(python3 -c \
      "import json,sys; d=json.load(sys.stdin); print(', '.join(m['id'] for m in d.get('data',[])[:3]))" \
      <<< "$_MS_RESP" 2>/dev/null || echo "unknown")
    ok "Moonshot key valid — models: ${_MODELS}"
  } || warn "Moonshot API validation failed — key may be invalid"

  # Encrypt
  info "Encrypting → ~/.s1af-cipher/moonshot-key.enc"
  s1af_encrypt_named "moonshot-key" "$_MS_KEY" || warn "Moonshot key encryption failed"
  ok "Moonshot key → [OBFUSCATED] (AES-256-CBC)"
fi

# ══════════════════════════════════════════════════════════════════════════════
# SECTION C — Git Setup + Push
# ══════════════════════════════════════════════════════════════════════════════
hdr "C  Git Setup + Push"

# Install askpass
ASKPASS_DEST="${HOME}/.s1af-git-askpass.sh"
mkdir -p "${HOME}/.s1af-scripts"
cp "${SCRIPT_DIR}/git-askpass.sh"  "$ASKPASS_DEST"
cp "${SCRIPT_DIR}/pat-cipher.sh"   "${HOME}/.s1af-scripts/pat-cipher.sh"
chmod 700 "$ASKPASS_DEST"
git config --global core.askPass   "$ASKPASS_DEST"
git config --global credential.helper ""
export GIT_ASKPASS="$ASKPASS_DEST"
"$GH" auth setup-git 2>/dev/null || true
ok "Git askpass → [OBFUSCATED] placeholder installed"

# Credential-free remotes
CLEAN_URL="https://jonathanEIDfounder@github.com/jonathanEIDfounder/oracle-ai.git"
cd "${REPO_ROOT}"
for _R in oracle-ai origin; do
  git remote get-url "$_R" &>/dev/null \
    && git remote set-url "$_R" "$CLEAN_URL" \
    || git remote add    "$_R" "$CLEAN_URL"
done
ok "Remotes → credential-free URLs"

# Push pending commits
_PENDING=$(git log "oracle-ai/main..HEAD" --oneline 2>/dev/null || true)
_COUNT=0
[[ -n "$_PENDING" ]] && _COUNT=$(printf '%s\n' "$_PENDING" | grep -c '.' 2>/dev/null) || true

if [[ "${_COUNT:-0}" -eq 0 ]]; then
  info "Remote is up to date — nothing to push"
else
  info "Pushing ${_COUNT} commit(s)..."
  printf '%s\n' "$_PENDING" | head -10 | sed 's/^/    /'
  echo ""
  _PUSH_URL="https://jonathanEIDfounder:${_GH_TOKEN}@github.com/jonathanEIDfounder/oracle-ai.git"
  git remote set-url oracle-ai "$_PUSH_URL"
  if git push oracle-ai HEAD:main --tags 2>&1 | grep -v "$_GH_TOKEN"; then
    git remote set-url oracle-ai "$CLEAN_URL"
    ok "${_COUNT} commit(s) pushed + tags synced to oracle-ai/main"
    git ls-remote oracle-ai refs/tags/v1.0.0-JS 2>/dev/null | grep -q v1.0.0-JS \
      && ok "Tag v1.0.0-JS confirmed on remote" || true
  else
    git remote set-url oracle-ai "$CLEAN_URL"
    warn "Push failed — check output above"
  fi
  unset _PUSH_URL
fi

# ══════════════════════════════════════════════════════════════════════════════
# SECTION D — Wipe raw values + final status
# ══════════════════════════════════════════════════════════════════════════════
unset _GH_TOKEN _MS_KEY _ENV_MS _PENDING _COUNT _MS_RESP _MODELS

hdr "D  Cipherstore Status"
s1af_token_status_all | sed 's/^/  /'

echo ""
box "Bootstrap Complete — OCSO-S1AF-GOV-1"
echo ""
echo -e "  GitHub   : ${_GH_LOGIN}"
echo -e "  At rest  : [OBFUSCATED] ~/.s1af-cipher/*.enc (AES-256)"
echo -e "  Git auth : askpass decrypts at runtime — no plaintext in config"
echo ""
echo -e "${DIM}  Every future server restart runs retrieve-and-obfuscate.sh${RESET}"
echo -e "${DIM}  automatically — no further action needed.${RESET}"
echo ""
