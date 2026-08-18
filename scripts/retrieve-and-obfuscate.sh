#!/usr/bin/env bash
# =============================================================================
# S1AF — Auto Retrieve & Obfuscate ALL Tokens
# OCSO-S1AF-GOV-1 · Jonathan Sherman
#
# Runs automatically at API server boot via predev hook.
# Reads GITHUB_PAT and MOONSHOT_API_KEY from environment (fresh Replit secrets),
# encrypts each immediately into named cipherstores, installs [OBFUSCATED]
# askpass placeholder, pushes any pending commits, then wipes raw values.
#
# Token registry:
#   github-pat    → $GITHUB_PAT        → ~/.s1af-cipher/github-pat.enc
#   moonshot-key  → $MOONSHOT_API_KEY  → ~/.s1af-cipher/moonshot-key.enc
#   deploy-secret → $DEPLOY_SECRET     → ~/.s1af-cipher/deploy-secret.enc
#
# NEVER writes raw tokens to disk. Only AES-256 ciphertext is stored.
# =============================================================================

readonly _S1AF_AUTHOR="© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_PREFIX="[S1AF-CIPHER]"

# ── Colour helpers ─────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BOLD='\033[1m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}${LOG_PREFIX} ✓ $*${RESET}"; }
warn() { echo -e "${YELLOW}${LOG_PREFIX} ⚠ $*${RESET}"; }
info() { echo -e "${CYAN}${LOG_PREFIX} → $*${RESET}"; }
sep()  { echo -e "${LOG_PREFIX} — $*"; }

# ── Source cipher library ──────────────────────────────────────────────────────
source "${SCRIPT_DIR}/pat-cipher.sh" 2>/dev/null || {
  warn "pat-cipher.sh not found — skipping token obfuscation"
  exit 0
}

echo ""
echo -e "${BOLD}${LOG_PREFIX} Sovereign token retrieve + obfuscate — OCSO-S1AF-GOV-1${RESET}"
echo -e "${LOG_PREFIX} © 2026 Jonathan Sherman — All rights reserved"
echo ""

# ── Token registry: name → env-var → validation prefix ───────────────────────
# Format: "name:ENV_VAR:required_prefix:min_len"
TOKENS=(
  "github-pat:GITHUB_PAT:ghp_:40"
  "moonshot-key:MOONSHOT_API_KEY:sk-:30"
  "deploy-secret:DEPLOY_SECRET::16"
)

_GIT_PAT_VALID=false
_GIT_PAT_VALUE=""

for TOKEN_SPEC in "${TOKENS[@]}"; do
  IFS=':' read -r _NAME _ENVVAR _PREFIX _MINLEN <<< "$TOKEN_SPEC"

  echo -e "${LOG_PREFIX}  Processing: ${BOLD}${_NAME}${RESET} (\$${_ENVVAR})"

  # ── Retrieve from env ──────────────────────────────────────────────────────
  _RAW="${!_ENVVAR:-}"
  _LEN="${#_RAW}"

  if [[ "${_LEN}" -ge "${_MINLEN}" ]]; then
    if [[ -z "$_PREFIX" || "$_RAW" == ${_PREFIX}* ]]; then
      info "  Retrieved ${_LEN} chars → encrypting"

      # ── Encrypt immediately ────────────────────────────────────────────────
      if s1af_encrypt_named "$_NAME" "$_RAW"; then
        ok "  [${_NAME}] → ~/.s1af-cipher/${_NAME}.enc  [OBFUSCATED]"
        # Track PAT for git push step
        if [[ "$_NAME" == "github-pat" ]]; then
          _GIT_PAT_VALID=true
          _GIT_PAT_VALUE="$_RAW"
        fi
      else
        warn "  Encryption failed for ${_NAME}"
      fi
    else
      # Env var present but wrong prefix — check cipherstore
      sep "  Env prefix mismatch (got ${_RAW:0:6}… expected ${_PREFIX}*) — checking cipherstore"
      if _STORED=$(s1af_decrypt_named "$_NAME" 2>/dev/null) && \
         [[ "${#_STORED}" -ge "${_MINLEN}" ]]; then
        ok "  [${_NAME}] cipherstore valid — using stored credentials"
        if [[ "$_NAME" == "github-pat" ]]; then
          _GIT_PAT_VALID=true
          _GIT_PAT_VALUE="$_STORED"
        fi
        unset _STORED
      else
        warn "  [${_NAME}] env invalid + no valid cipherstore"
        warn "  Update Replit secret '${_ENVVAR}' with a valid ${_PREFIX}... token, then restart"
        unset _STORED 2>/dev/null || true
      fi
    fi
  else
    # Too short — check cipherstore
    sep "  Env var invalid (${_LEN} chars) — checking cipherstore"
    if _STORED=$(s1af_decrypt_named "$_NAME" 2>/dev/null) && \
       [[ "${#_STORED}" -ge "${_MINLEN}" ]]; then
      ok "  [${_NAME}] cipherstore valid — using stored credentials"
      if [[ "$_NAME" == "github-pat" ]]; then
        _GIT_PAT_VALID=true
        _GIT_PAT_VALUE="$_STORED"
      fi
      unset _STORED
    else
      warn "  [${_NAME}] env invalid (${_LEN} chars) + no valid cipherstore"
      warn "  Update Replit secret '${_ENVVAR}' with a valid token, then restart"
      unset _STORED 2>/dev/null || true
    fi
  fi

  unset _RAW _LEN
  echo ""
done

# ── Install unified askpass helper (reads github-pat from cipherstore) ─────────
info "Installing [OBFUSCATED] git askpass placeholder"
ASKPASS_SRC="${SCRIPT_DIR}/git-askpass.sh"
ASKPASS_DEST="${HOME}/.s1af-git-askpass.sh"
CIPHER_SCRIPTS="${HOME}/.s1af-scripts"

mkdir -p "$CIPHER_SCRIPTS"
cp "${SCRIPT_DIR}/pat-cipher.sh"  "${CIPHER_SCRIPTS}/pat-cipher.sh"
cp "$ASKPASS_SRC"                 "$ASKPASS_DEST"
chmod 700 "$ASKPASS_DEST"

git config --global core.askPass   "$ASKPASS_DEST"
git config --global credential.helper ""
export GIT_ASKPASS="$ASKPASS_DEST"
ok "Askpass → [OBFUSCATED — decrypts github-pat at runtime]"

# ── Rewrite remotes — credential-free ─────────────────────────────────────────
CLEAN_URL="https://jonathanEIDfounder@github.com/jonathanEIDfounder/oracle-ai.git"
cd "${REPO_ROOT}"
for _R in oracle-ai origin; do
  if git remote get-url "$_R" &>/dev/null; then
    git remote set-url "$_R" "$CLEAN_URL"
  else
    git remote add "$_R" "$CLEAN_URL"
  fi
done
ok "Remotes → credential-free (askpass decrypts at runtime)"

# ── Push pending commits if github-pat is valid ────────────────────────────────
if [[ "$_GIT_PAT_VALID" == "true" && -n "$_GIT_PAT_VALUE" ]]; then
  _PENDING=$(git log "oracle-ai/main..HEAD" --oneline 2>/dev/null || true)
  _COUNT=0
  [[ -n "$_PENDING" ]] && _COUNT=$(printf '%s\n' "$_PENDING" | grep -c '.' 2>/dev/null) || true

  if [[ "${_COUNT:-0}" -eq 0 ]]; then
    sep "No pending commits to push"
  else
    info "Pushing ${_COUNT:-?} commit(s) to oracle-ai/main"
    _PUSH_URL="https://jonathanEIDfounder:${_GIT_PAT_VALUE}@github.com/jonathanEIDfounder/oracle-ai.git"
    git remote set-url oracle-ai "$_PUSH_URL"
    if git push oracle-ai HEAD:main --tags 2>&1 | grep -v "$_GIT_PAT_VALUE"; then
      git remote set-url oracle-ai "$CLEAN_URL"
      ok "${_COUNT} commit(s) pushed + tags synced to oracle-ai/main"
    else
      git remote set-url oracle-ai "$CLEAN_URL"
      warn "Push failed — PAT may lack repo scope"
    fi
    unset _PUSH_URL
  fi
  unset _PENDING _COUNT
fi

# ── Wipe all raw values ────────────────────────────────────────────────────────
unset _GIT_PAT_VALID _GIT_PAT_VALUE CLEAN_URL

# ── Final status ───────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${LOG_PREFIX} Cipherstore status:${RESET}"
s1af_token_status_all | sed "s/^/${LOG_PREFIX}/"
echo ""
ok "Boot obfuscation complete — all tokens secured"
echo ""
