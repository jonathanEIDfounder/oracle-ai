#!/bin/bash
# =============================================================
# Scripts/replit-deploy.sh
# Name: Replit Deploy — M2M Edition
# Author: Jonathan Sherman
# Copyright: (c) 2026 Jonathan Sherman. All Rights Reserved.
# Framework: S1AF v1.0.0-JS
# Sovereign ID: 1 | Device: b246e1da48a45eb7
# =============================================================
#
# FULLY AUTOMATED — NO HUMAN IN THE LOOP
#
# USAGE (one-liner, no setup required):
#   curl -fsSL https://raw.githubusercontent.com/jonathanEIDfounder/oracle-ai/main/Scripts/replit-deploy.sh | bash
#
# OR clone once and run on a schedule (see Scripts/launchd-deploy.plist):
#   bash ~/oracle-ai/Scripts/replit-deploy.sh
#
# TOKEN RESOLUTION ORDER (first found wins — no export needed):
#   1. gh CLI   → gh auth token
#   2. macOS Keychain → security find-internet-password github.com
#   3. ~/.config/s1af/token  (write once: echo "ghp_…" > ~/.config/s1af/token)
#   4. GITHUB_PAT env var    (fallback for CI/CD systems)
#
# =============================================================

set -euo pipefail

# ── config ────────────────────────────────────────────────────
OWNER="jonathanEIDfounder"
REPO="oracle-ai"
BRANCH="main"
WF="self-trigger.yml"
API="https://api.github.com/repos/${OWNER}/${REPO}"
SOURCE_LABEL="${S1AF_SOURCE:-replit-deploy}"
CLONE_DIR="${S1AF_DIR:-${HOME}/oracle-ai}"
TOKEN_FILE="${HOME}/.config/s1af/token"

# ── helpers ───────────────────────────────────────────────────
jparse() { python3 -c "import sys,json; d=json.load(sys.stdin); print(d${1})" 2>/dev/null || echo ""; }

banner() {
  printf "\n\033[1;34m╔══════════════════════════════════════════════════════════════╗\033[0m\n"
  printf "\033[1;34m║  S1AF Replit Deploy — M2M Edition                            ║\033[0m\n"
  printf "\033[1;34m║  Author: Jonathan Sherman · Sovereign ID: 1                  ║\033[0m\n"
  printf "\033[1;34m╚══════════════════════════════════════════════════════════════╝\033[0m\n\n"
}

log_ok()   { printf "  \033[32m✅\033[0m  %s\n" "$*"; }
log_err()  { printf "  \033[31m❌\033[0m  %s\n" "$*"; }
log_info() { printf "  \033[34m→\033[0m   %s\n" "$*"; }
log_warn() { printf "  \033[33m⚠️\033[0m   %s\n" "$*"; }

gh_get()  { curl -sf  -H "Authorization: token $PAT" -H "Accept: application/vnd.github+json" "$@"; }
gh_post() { curl -sf -X POST  -H "Authorization: token $PAT" -H "Accept: application/vnd.github+json" -H "Content-Type: application/json" "$@"; }
gh_put()  { curl -sf -X PUT   -H "Authorization: token $PAT" -H "Accept: application/vnd.github+json" -H "Content-Type: application/json" "$@"; }
gh_patch(){ curl -sf -X PATCH -H "Authorization: token $PAT" -H "Accept: application/vnd.github+json" -H "Content-Type: application/json" "$@"; }

push_file() {
  local FILE_PATH="$1" LOCAL_PATH="$2"
  [ -f "$LOCAL_PATH" ] || { log_warn "Skipping (not found): $FILE_PATH"; return; }
  local B64; B64=$(base64 -w 0 2>/dev/null "$LOCAL_PATH" || base64 "$LOCAL_PATH")
  local SHA; SHA=$(curl -sf -H "Authorization: token $PAT" -H "Accept: application/vnd.github+json" \
    "${API}/contents/${FILE_PATH}?ref=${BRANCH}" 2>/dev/null | jparse "['sha']" || echo "")
  local BODY="{\"message\":\"[S1AF] m2m deploy ${FILE_PATH}\",\"content\":\"${B64}\",\"branch\":\"${BRANCH}\""
  [ -n "$SHA" ] && BODY="${BODY},\"sha\":\"${SHA}\""
  BODY="${BODY}}"
  local STATUS; STATUS=$(curl -s -o /tmp/_s1af_put.json -w "%{http_code}" -X PUT \
    -H "Authorization: token $PAT" -H "Accept: application/vnd.github+json" \
    -H "Content-Type: application/json" "${API}/contents/${FILE_PATH}" -d "$BODY")
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
    log_ok "[$STATUS] $FILE_PATH"
  else
    log_warn "[$STATUS] $FILE_PATH — $(python3 -c "import json; print(json.load(open('/tmp/_s1af_put.json')).get('message','?'))" 2>/dev/null)"
  fi
}

# ─────────────────────────────────────────────────────────────
# STEP 1 — Auto-detect token (no human action required)
# ─────────────────────────────────────────────────────────────
banner
printf "[1/5] Resolving GitHub token (m2m — no export needed)…\n"

PAT=""

# 1a. GitHub CLI (most common on dev Macs)
if command -v gh >/dev/null 2>&1; then
  _TK=$(gh auth token 2>/dev/null || echo "")
  if [ "${#_TK}" -gt 20 ]; then
    PAT="$_TK"
    log_ok "Token from gh CLI"
  fi
fi

# 1b. macOS Keychain
if [ -z "$PAT" ] && command -v security >/dev/null 2>&1; then
  _TK=$(security find-internet-password -s github.com -w 2>/dev/null || echo "")
  if [ "${#_TK}" -gt 20 ]; then
    PAT="$_TK"
    log_ok "Token from macOS Keychain"
  fi
fi

# 1c. ~/.config/s1af/token file
if [ -z "$PAT" ] && [ -f "$TOKEN_FILE" ]; then
  _TK=$(cat "$TOKEN_FILE" | tr -d '[:space:]')
  if [ "${#_TK}" -gt 20 ]; then
    PAT="$_TK"
    log_ok "Token from $TOKEN_FILE"
  fi
fi

# 1d. GITHUB_PAT env var (CI/CD fallback)
if [ -z "$PAT" ] && [ "${#GITHUB_PAT:-}" -gt 20 ]; then
  PAT="$GITHUB_PAT"
  log_ok "Token from GITHUB_PAT env var"
fi

if [ -z "$PAT" ]; then
  log_err "No token found. One-time setup — choose one:"
  echo ""
  echo "    A) gh auth login               (recommended — persists forever)"
  echo "    B) mkdir -p ~/.config/s1af && echo 'ghp_…' > ~/.config/s1af/token"
  echo "    C) export GITHUB_PAT='ghp_…'   (session only)"
  echo ""
  exit 1
fi

# Verify token
ME=$(gh_get "https://api.github.com/user" | jparse "['login']")
log_ok "Authenticated as: ${ME:-unknown}"

# ─────────────────────────────────────────────────────────────
# STEP 2 — Auto-clone / auto-pull repo (no cd required)
# ─────────────────────────────────────────────────────────────
printf "\n[2/5] Syncing oracle-ai repo…\n"

if [ -d "${CLONE_DIR}/.git" ]; then
  git -C "$CLONE_DIR" pull --ff-only --quiet 2>/dev/null && log_ok "Pulled latest: $CLONE_DIR" \
    || log_warn "Pull failed — using existing checkout"
else
  log_info "Cloning oracle-ai into $CLONE_DIR…"
  git clone --quiet "https://${PAT}@github.com/${OWNER}/${REPO}.git" "$CLONE_DIR" 2>/dev/null \
    && log_ok "Cloned to $CLONE_DIR" \
    || log_warn "Clone failed (continuing with remote-only push)"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "${CLONE_DIR}/Scripts")"
WORKSPACE_ROOT="${SCRIPT_DIR%/Scripts}"

# ─────────────────────────────────────────────────────────────
# STEP 3 — Push workspace files
# ─────────────────────────────────────────────────────────────
printf "\n[3/5] Pushing workspace files…\n"
PUSHED=0; SKIPPED=0

declare -a FILES=(
  "github-bridge.sh"
  "github-bridge-api.sh"
  "ONE_LINE_BRIDGE.sh"
  "Scripts/replit-deploy.sh"
  "Scripts/ios-deploy.html"
  "Scripts/launchd-deploy.plist"
  "docs/s1af-framework.md"
)

for f in "${FILES[@]}"; do
  if push_file "$f" "${WORKSPACE_ROOT}/${f}"; then
    PUSHED=$((PUSHED+1))
  else
    SKIPPED=$((SKIPPED+1))
  fi
done

# Push .github/workflows/self-trigger.yml via git data API
WF_LOCAL="${WORKSPACE_ROOT}/.github/workflows/${WF}"
if [ -f "$WF_LOCAL" ]; then
  printf "\n  Pushing .github/workflows/${WF} via git data API…\n"
  HEAD_SHA=$(gh_get "${API}/git/ref/heads/${BRANCH}" | jparse "['object']['sha']")
  BASE_TREE=$(gh_get "${API}/git/commits/${HEAD_SHA}" | jparse "['tree']['sha']")
  WF_B64=$(base64 -w 0 2>/dev/null "$WF_LOCAL" || base64 "$WF_LOCAL")
  BLOB_SHA=$(gh_post "${API}/git/blobs" -d "{\"content\":\"${WF_B64}\",\"encoding\":\"base64\"}" | jparse "['sha']")
  TREE_SHA=$(gh_post "${API}/git/trees" \
    -d "{\"base_tree\":\"${BASE_TREE}\",\"tree\":[{\"path\":\".github/workflows/${WF}\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"${BLOB_SHA}\"}]}" \
    | jparse "['sha']")
  COMMIT_SHA=$(gh_post "${API}/git/commits" \
    -d "{\"message\":\"[S1AF] m2m: deploy ${WF}\",\"tree\":\"${TREE_SHA}\",\"parents\":[\"${HEAD_SHA}\"]}" \
    | jparse "['sha']")
  gh_patch "${API}/git/refs/heads/${BRANCH}" -d "{\"sha\":\"${COMMIT_SHA}\"}" >/dev/null \
    && log_ok "[201] .github/workflows/${WF}" || log_warn "Workflow file push failed (re-run from Mac with workflow-scope PAT)"
fi

printf "\n  Pushed: %d  |  Skipped: %d\n" "$PUSHED" "$SKIPPED"

# ─────────────────────────────────────────────────────────────
# STEP 4 — Verify workflow on remote
# ─────────────────────────────────────────────────────────────
printf "\n[4/5] Verifying workflow on remote…\n"
WF_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: token $PAT" -H "Accept: application/vnd.github+json" \
  "${API}/contents/.github/workflows/${WF}?ref=${BRANCH}")
[ "$WF_STATUS" = "200" ] && log_ok "Workflow confirmed on ${BRANCH}" \
  || log_warn "Workflow not found (HTTP ${WF_STATUS}) — trigger may fail"

# ─────────────────────────────────────────────────────────────
# STEP 5 — Trigger Actions workflow (m2m dispatch)
# ─────────────────────────────────────────────────────────────
printf "\n[5/5] Triggering GitHub Actions (source: ${SOURCE_LABEL})…\n"
TRIGGER=$(curl -s -o /tmp/_s1af_trigger.json -w "%{http_code}" -X POST \
  -H "Authorization: token $PAT" -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  "${API}/actions/workflows/${WF}/dispatches" \
  -d "{\"ref\":\"${BRANCH}\",\"inputs\":{\"source\":\"${SOURCE_LABEL}\"}}")

if [ "$TRIGGER" = "204" ]; then
  log_ok "Workflow dispatched"
else
  MSG=$(python3 -c "import json; print(json.load(open('/tmp/_s1af_trigger.json')).get('message','?'))" 2>/dev/null || echo "?")
  log_warn "Dispatch returned HTTP ${TRIGGER}: ${MSG}"
fi

# ─────────────────────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────────────────────
printf "\n\033[1;32m╔══════════════════════════════════════════════════════════════╗\033[0m\n"
printf "\033[1;32m║  ✅  S1AF M2M DEPLOY COMPLETE                                 ║\033[0m\n"
printf "\033[1;32m╚══════════════════════════════════════════════════════════════╝\033[0m\n\n"
printf "  Repo:    https://github.com/${OWNER}/${REPO}\n"
printf "  Actions: https://github.com/${OWNER}/${REPO}/actions\n"
printf "  (c) 2026 Jonathan Sherman · S1AF v1.0.0-JS\n\n"
