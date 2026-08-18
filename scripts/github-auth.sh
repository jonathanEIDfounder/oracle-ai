#!/usr/bin/env bash
# =============================================================================
# S1AF — GitHub OAuth Device Flow + Full Bootstrap
# OCSO-S1AF-GOV-1 · Jonathan Sherman
#
# Fully automated GitHub authentication. No manual PAT creation required.
# Run this once from the Replit Shell tab:
#
#   bash scripts/github-auth.sh
#
# What happens:
#   1. gh CLI device flow — shows an 8-char code + URL (one browser visit)
#   2. Polls automatically until you approve — no further action needed
#   3. Extracts OAuth token silently
#   4. Encrypts → ~/.s1af-cipher/github-pat.enc  [OBFUSCATED, never plaintext]
#   5. Installs [OBFUSCATED] git askpass placeholder
#   6. Rewrites remotes → credential-free URLs
#   7. Pushes all pending commits + tags to oracle-ai/main
#   8. Updates sentient rotation daemon
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

source "${SCRIPT_DIR}/pat-cipher.sh"

# ── Colour helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}  ✓ $*${RESET}"; }
fail() { echo -e "${RED}  ✗ $*${RESET}"; exit 1; }
warn() { echo -e "${YELLOW}  ⚠ $*${RESET}"; }
info() { echo -e "${CYAN}  → $*${RESET}"; }
hdr()  { echo -e "\n${BOLD}$*${RESET}"; }

# ── Locate gh CLI ──────────────────────────────────────────────────────────────
GH=$(command -v gh 2>/dev/null || echo "/repl/ctls/bin/gh")
[[ -x "$GH" ]] || fail "gh CLI not found. Expected at /repl/ctls/bin/gh"
ok "gh CLI: $("$GH" --version | head -1)"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   S1AF — GitHub Device Auth + Sovereign Bootstrap           ║${RESET}"
echo -e "${BOLD}║   OCSO-S1AF-GOV-1 · Jonathan Sherman                        ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${RESET}"
echo ""

# ─── Step 1: Authenticate via device flow ─────────────────────────────────────
hdr "Step 1 — GitHub OAuth Device Flow"

ALREADY_AUTH=false
if "$GH" auth status --hostname github.com &>/dev/null; then
  GH_LOGIN=$("$GH" api user --jq '.login' 2>/dev/null || echo "unknown")
  ok "Already authenticated as: ${GH_LOGIN}"
  ALREADY_AUTH=true
else
  info "Starting device flow — a code will appear below"
  info "Visit the URL shown, enter the code, then come back here"
  echo ""
  echo -e "${YELLOW}${BOLD}  ─── ACTION REQUIRED ──────────────────────────────────────────────${RESET}"

  # Run gh auth login in device mode (works in any TTY terminal)
  "$GH" auth login \
    --hostname github.com \
    --git-protocol https \
    --scopes "repo,workflow" \
    --web 2>&1 || \
  "$GH" auth login \
    --hostname github.com \
    --git-protocol https \
    --scopes "repo,workflow" 2>&1 || \
  fail "GitHub device auth failed — ensure you are running this from the Replit Shell tab (not agent)"

  echo -e "${YELLOW}${BOLD}  ─── AUTH COMPLETE ─────────────────────────────────────────────────${RESET}"
  echo ""
  GH_LOGIN=$("$GH" api user --jq '.login' 2>/dev/null || echo "unknown")
  ok "Authenticated as: ${GH_LOGIN}"
fi

# ─── Step 2: Extract token silently ───────────────────────────────────────────
hdr "Step 2 — Extract + obfuscate token"

_TOKEN=$("$GH" auth token --hostname github.com 2>/dev/null) \
  || fail "Could not extract token from gh keychain"

[[ "${#_TOKEN}" -ge 20 ]] || fail "Extracted token too short (${#_TOKEN} chars)"
ok "Token extracted: ${_TOKEN:0:6}…[OBFUSCATED] (${#_TOKEN} chars)"

# Encrypt immediately — raw token in RAM only
s1af_encrypt_named "github-pat" "$_TOKEN" \
  || fail "Encryption failed"
ok "Encrypted → ~/.s1af-cipher/github-pat.enc  [AES-256-CBC PBKDF2]"
ok "Placeholder: [OBFUSCATED — decrypted at runtime only]"

# ─── Step 3: Install askpass ──────────────────────────────────────────────────
hdr "Step 3 — Install [OBFUSCATED] git askpass"

ASKPASS_DEST="${HOME}/.s1af-git-askpass.sh"
CIPHER_DIR="${HOME}/.s1af-scripts"
mkdir -p "$CIPHER_DIR"
cp "${SCRIPT_DIR}/git-askpass.sh"  "$ASKPASS_DEST"
cp "${SCRIPT_DIR}/pat-cipher.sh"   "${CIPHER_DIR}/pat-cipher.sh"
chmod 700 "$ASKPASS_DEST"
git config --global core.askPass   "$ASKPASS_DEST"
git config --global credential.helper ""
export GIT_ASKPASS="$ASKPASS_DEST"
ok "Askpass → [OBFUSCATED] (decrypts cipherstore at runtime)"

# Also configure gh as git credential helper
"$GH" auth setup-git 2>/dev/null || true

# ─── Step 4: Rewrite remotes — credential-free ────────────────────────────────
hdr "Step 4 — Credential-free remotes"

CLEAN_URL="https://jonathanEIDfounder@github.com/jonathanEIDfounder/oracle-ai.git"
cd "${REPO_ROOT}"
for _R in oracle-ai origin; do
  if git remote get-url "$_R" &>/dev/null; then
    git remote set-url "$_R" "$CLEAN_URL"
    ok "Remote '$_R' → credential-free"
  else
    git remote add "$_R" "$CLEAN_URL"
    ok "Remote '$_R' added (credential-free)"
  fi
done

# ─── Step 5: Push all pending commits ─────────────────────────────────────────
hdr "Step 5 — Push pending commits to oracle-ai/main"

_PENDING=$(git log "oracle-ai/main..HEAD" --oneline 2>/dev/null || true)
_COUNT=0
[[ -n "$_PENDING" ]] && _COUNT=$(printf '%s\n' "$_PENDING" | grep -c '.' 2>/dev/null) || true

if [[ "${_COUNT:-0}" -eq 0 ]]; then
  info "No pending commits — remote is up to date"
else
  info "${_COUNT} commit(s) to push:"
  printf '%s\n' "$_PENDING" | head -15 | sed 's/^/    /'
  echo ""
  # Transient authenticated URL — cleared immediately after push
  _PUSH_URL="https://jonathanEIDfounder:${_TOKEN}@github.com/jonathanEIDfounder/oracle-ai.git"
  git remote set-url oracle-ai "$_PUSH_URL"
  if git push oracle-ai HEAD:main --tags --progress 2>&1 \
      | grep -v "$_TOKEN" | grep -v "^remote:$"; then
    git remote set-url oracle-ai "$CLEAN_URL"
    ok "${_COUNT} commit(s) pushed + tags synced"
    if git ls-remote oracle-ai refs/tags/v1.0.0-JS 2>/dev/null | grep -q v1.0.0-JS; then
      ok "Tag v1.0.0-JS confirmed on oracle-ai"
    fi
  else
    git remote set-url oracle-ai "$CLEAN_URL"
    warn "Push encountered issues — check output above"
  fi
  unset _PUSH_URL
fi
unset _PENDING _COUNT

# ─── Step 6: Notify sentient daemon ───────────────────────────────────────────
hdr "Step 6 — Notifying sentient rotation daemon"

_ROTATE=$(curl -sf -X POST "http://localhost:8080/api/sentient/rotate-pat" \
  -H "Content-Type: application/json" \
  -H "X-S1AF-Bootstrap: true" \
  -d "{\"force\":true}" 2>/dev/null \
  || echo '{"ok":false,"error":"unreachable"}')

_ROT_OK=$(python3 -c \
  "import json,sys; d=json.load(sys.stdin); print(str(d.get('ok',False)).lower())" \
  <<< "$_ROTATE" 2>/dev/null || echo "false")

if [[ "$_ROT_OK" == "true" ]]; then
  ok "Daemon updated — SENTIENT_TOKEN refreshed"
elif python3 -c "import json,sys; d=json.load(sys.stdin); exit(0 if d.get('error')=='sovereign_required' else 1)" \
    <<< "$_ROTATE" 2>/dev/null; then
  warn "Daemon requires biometric session (enroll passkey first — task #65)"
else
  warn "Daemon: $( python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('error','no response'))" <<< "$_ROTATE" 2>/dev/null )"
fi

# ─── Wipe raw token from scope ────────────────────────────────────────────────
unset _TOKEN _ROTATE _ROT_OK

# ─── Cipher status ────────────────────────────────────────────────────────────
hdr "Cipherstore status"
s1af_token_status "github-pat" | sed 's/^/  /'

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}${BOLD}║   S1AF GitHub Auth Complete — OCSO-S1AF-GOV-1               ║${RESET}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  Authenticated: ${GH_LOGIN}"
echo -e "  Token at rest: [OBFUSCATED] ~/.s1af-cipher/github-pat.enc"
echo -e "  Git credential: askpass decrypts at runtime"
echo ""
echo -e "${YELLOW}  One credential still needed:${RESET}"
echo -e "  → MOONSHOT_API_KEY  (generate at platform.moonshot.cn/console/api-keys)"
echo -e "    Then run: bash scripts/moonshot-auth.sh"
echo ""
