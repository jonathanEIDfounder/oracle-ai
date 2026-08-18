#!/bin/bash
# =============================================================
# Scripts/replit-deploy.sh
# Name: Replit Deploy
# Author: Jonathan Sherman
# Copyright: (c) 2026 Jonathan Sherman. All Rights Reserved.
# Framework: S1AF v1.0.0-JS
# Module: Replit → GitHub → Actions Deploy Pipeline
# Sovereign ID: 1 | Device: b246e1da48a45eb7
# =============================================================
#
# USAGE:
#   bash Scripts/replit-deploy.sh [branch] [source-label]
#
#   branch       Target GitHub branch (default: main)
#   source-label Label passed to the Actions workflow (default: replit-deploy)
#
# WHAT THIS DOES (automated steps 1-5):
#   1. Reads files changed in this Replit workspace
#   2. Base64-encodes each file
#   3. Pushes them to oracle-ai via GitHub Contents API
#   4. Creates / updates .github/workflows/self-trigger.yml via git data API
#   5. Triggers the S1AF Sandbox Bridge workflow via GitHub Actions API
#
# REQUIREMENTS:
#   - GITHUB_PAT secret (repo + workflow scopes) set in Replit Secrets
#   - curl, python3, base64 (all present in Replit NixOS environment)
#   - jq optional (falls back to python3 for JSON parsing)
#
# =============================================================

set -euo pipefail

OWNER="jonathanEIDfounder"
REPO="oracle-ai"
BRANCH="${1:-main}"
SOURCE_LABEL="${2:-replit-deploy}"
API="https://api.github.com/repos/${OWNER}/${REPO}"
WORKFLOW_FILE=".github/workflows/self-trigger.yml"

# ── helpers ──────────────────────────────────────────────────
jparse() { python3 -c "import sys,json; d=json.load(sys.stdin); print(d${1})" 2>/dev/null || echo ""; }
require_token() {
  if [ "${#GITHUB_PAT}" -lt 20 ]; then
    echo "❌  GITHUB_PAT is missing or masked."
    echo "    Set a classic PAT (repo + workflow scopes) in Replit Secrets."
    exit 1
  fi
}
gh_get()  { curl -sf -H "Authorization: token $GITHUB_PAT" -H "Accept: application/vnd.github+json" "$@"; }
gh_post() { curl -sf -X POST -H "Authorization: token $GITHUB_PAT" -H "Accept: application/vnd.github+json" -H "Content-Type: application/json" "$@"; }
gh_put()  { curl -sf -X PUT  -H "Authorization: token $GITHUB_PAT" -H "Accept: application/vnd.github+json" -H "Content-Type: application/json" "$@"; }
gh_patch(){ curl -sf -X PATCH -H "Authorization: token $GITHUB_PAT" -H "Accept: application/vnd.github+json" -H "Content-Type: application/json" "$@"; }

banner() {
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  S1AF Replit Deploy                                          ║"
  echo "║  Replit → GitHub → Actions                                   ║"
  echo "║  Author: Jonathan Sherman                                    ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
  echo "  Repo:    https://github.com/${OWNER}/${REPO}"
  echo "  Branch:  ${BRANCH}"
  echo "  Source:  ${SOURCE_LABEL}"
  echo ""
}

# ── Step 1: preflight ─────────────────────────────────────────
require_token
banner
echo "[1/5] Preflight — verifying GitHub access..."
ME=$(gh_get "${API}" | jparse "['full_name']")
echo "      ✅  Connected to: ${ME:-${OWNER}/${REPO}}"

# ── Step 2: collect files to push ────────────────────────────
echo "[2/5] Collecting workspace files to push..."

# List of files to push — extend this array as the project grows
WORKSPACE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
declare -a PUSH_FILES=(
  "github-bridge.sh"
  "github-bridge-api.sh"
  "ONE_LINE_BRIDGE.sh"
  "Scripts/replit-deploy.sh"
  "docs/s1af-framework.md"
  "artifacts/kimi-xcode-planner/src/components/code-block.tsx"
  "artifacts/kimi-xcode-planner/src/pages/projects/detail.tsx"
  "artifacts/kimi-xcode-planner/src/pages/projects/new.tsx"
)

PUSHED=0
SKIPPED=0

push_content_file() {
  local FILE_PATH="$1"
  local LOCAL="$2"
  [ -f "$LOCAL" ] || { echo "      ⚠️   Skipping (not found): $FILE_PATH"; SKIPPED=$((SKIPPED+1)); return; }

  local B64; B64=$(base64 -w 0 "$LOCAL")
  local EXISTING_SHA
  EXISTING_SHA=$(gh_get "${API}/contents/${FILE_PATH}?ref=${BRANCH}" 2>/dev/null | jparse "['sha']" || echo "")

  local BODY="{\"message\":\"[S1AF] deploy ${FILE_PATH} — Jonathan Sherman\",\"content\":\"${B64}\",\"branch\":\"${BRANCH}\""
  [ -n "$EXISTING_SHA" ] && BODY="${BODY},\"sha\":\"${EXISTING_SHA}\""
  BODY="${BODY}}"

  STATUS=$(curl -s -o /tmp/_gh_put.json -w "%{http_code}" -X PUT \
    -H "Authorization: token $GITHUB_PAT" \
    -H "Accept: application/vnd.github+json" \
    -H "Content-Type: application/json" \
    "${API}/contents/${FILE_PATH}" -d "$BODY")

  if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
    echo "      ✅  [$STATUS] ${FILE_PATH}"
    PUSHED=$((PUSHED+1))
  else
    MSG=$(python3 -c "import json; print(json.load(open('/tmp/_gh_put.json')).get('message','?'))" 2>/dev/null || echo "?")
    echo "      ⚠️   [$STATUS] ${FILE_PATH} — ${MSG}"
    SKIPPED=$((SKIPPED+1))
  fi
}

for f in "${PUSH_FILES[@]}"; do
  push_content_file "$f" "${WORKSPACE_ROOT}/${f}"
done

echo ""
echo "      Pushed: ${PUSHED}  |  Skipped/errored: ${SKIPPED}"

# ── Step 3: push workflow file via git data API ───────────────
echo ""
echo "[3/5] Pushing .github/workflows/self-trigger.yml via git data API..."

WORKFLOW_LOCAL="${WORKSPACE_ROOT}/.github/workflows/self-trigger.yml"

if [ -f "$WORKFLOW_LOCAL" ]; then
  # Get current HEAD
  HEAD_SHA=$(gh_get "${API}/git/ref/heads/${BRANCH}" | jparse "['object']['sha']")
  echo "      HEAD: ${HEAD_SHA}"

  # Get base tree SHA from HEAD commit
  BASE_TREE=$(gh_get "${API}/git/commits/${HEAD_SHA}" | jparse "['tree']['sha']")

  # Create blob for workflow file
  WF_B64=$(base64 -w 0 "$WORKFLOW_LOCAL")
  BLOB_SHA=$(gh_post "${API}/git/blobs" \
    -d "{\"content\":\"${WF_B64}\",\"encoding\":\"base64\"}" | jparse "['sha']")
  echo "      Blob: ${BLOB_SHA}"

  # Create tree
  TREE_SHA=$(gh_post "${API}/git/trees" \
    -d "{\"base_tree\":\"${BASE_TREE}\",\"tree\":[{\"path\":\".github/workflows/self-trigger.yml\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"${BLOB_SHA}\"}]}" \
    | jparse "['sha']")
  echo "      Tree: ${TREE_SHA}"

  # Create commit
  COMMIT_SHA=$(gh_post "${API}/git/commits" \
    -d "{\"message\":\"[S1AF] deploy self-trigger.yml — Jonathan Sherman\",\"tree\":\"${TREE_SHA}\",\"parents\":[\"${HEAD_SHA}\"]}" \
    | jparse "['sha']")
  echo "      Commit: ${COMMIT_SHA}"

  # Update branch ref
  gh_patch "${API}/git/refs/heads/${BRANCH}" \
    -d "{\"sha\":\"${COMMIT_SHA}\",\"force\":false}" > /dev/null
  echo "      ✅  .github/workflows/self-trigger.yml pushed via git data API"
else
  echo "      ⚠️   self-trigger.yml not found locally — skipping"
fi

# ── Step 4: verify workflow exists on remote ──────────────────
echo ""
echo "[4/5] Verifying workflow on remote..."
WF_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: token $GITHUB_PAT" \
  -H "Accept: application/vnd.github+json" \
  "${API}/contents/${WORKFLOW_FILE}?ref=${BRANCH}")

if [ "$WF_STATUS" = "200" ]; then
  echo "      ✅  Workflow file confirmed on ${BRANCH}"
else
  echo "      ⚠️   Workflow file not found (HTTP ${WF_STATUS}) — Actions trigger may fail"
fi

# ── Step 5: trigger GitHub Actions workflow ───────────────────
echo ""
echo "[5/5] Triggering S1AF Sandbox Bridge workflow..."
TRIGGER_STATUS=$(curl -s -o /tmp/_gh_trigger.json -w "%{http_code}" -X POST \
  -H "Authorization: token $GITHUB_PAT" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  "${API}/actions/workflows/self-trigger.yml/dispatches" \
  -d "{\"ref\":\"${BRANCH}\",\"inputs\":{\"source\":\"${SOURCE_LABEL}\"}}")

if [ "$TRIGGER_STATUS" = "204" ]; then
  echo "      ✅  Workflow triggered"
else
  MSG=$(python3 -c "import json; print(json.load(open('/tmp/_gh_trigger.json')).get('message','?'))" 2>/dev/null || echo "?")
  echo "      ⚠️   Trigger returned HTTP ${TRIGGER_STATUS}: ${MSG}"
fi

# ── Done ──────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ✅  REPLIT DEPLOY COMPLETE                                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Repository:  https://github.com/${OWNER}/${REPO}"
echo "  Actions:     https://github.com/${OWNER}/${REPO}/actions"
echo "  Branch:      ${BRANCH}"
echo "  Files pushed: ${PUSHED}"
echo ""
echo "  (c) 2026 Jonathan Sherman. S1AF v1.0.0-JS"
echo ""
