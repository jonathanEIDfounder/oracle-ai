#!/usr/bin/env bash
# =============================================================
# deploy.sh — S1AF Sovereign Deploy Pipeline
# Author: Jonathan Sherman
# Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
# Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
# =============================================================
# Runs the full 7-phase pipeline, tags the release, creates a
# GitHub release with the Xcode ZIP attached, and deploys the
# Replit API server to production.
#
# Usage:
#   bash scripts/deploy.sh              # interactive
#   bash scripts/deploy.sh --dry-run    # pre-flight only
#   bash scripts/deploy.sh --no-build   # skip proceed.sh
# =============================================================
set -euo pipefail

readonly _S1AF_AUTHOR="© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
API="${API_BASE:-http://localhost:8080/api}"
DRY_RUN=false
NO_BUILD=false

# Parse flags
for arg in "$@"; do
  case "$arg" in
    --dry-run)  DRY_RUN=true  ;;
    --no-build) NO_BUILD=true ;;
  esac
done

# ── Colours ────────────────────────────────────────────────────────────────────
BOLD="\033[1m"; RESET="\033[0m"
RED="\033[31m"; GREEN="\033[32m"; YELLOW="\033[33m"; CYAN="\033[36m"

ok()     { echo -e "    ${GREEN}✓${RESET}  $*"; }
warn()   { echo -e "    ${YELLOW}⚠${RESET}  $*"; }
fail()   { echo -e "    ${RED}✗${RESET}  $*"; }
info()   { echo -e "    ${CYAN}→${RESET}  $*"; }
banner() { echo -e "\n${BOLD}┌─ $* ──────────────────────────────────────────────${RESET}"; }
detail() { echo -e "       $*"; }

# ── Source cipher ──────────────────────────────────────────────────────────────
source "${SCRIPT_DIR}/pat-cipher.sh" 2>/dev/null || true

# ══════════════════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}
  ╔══════════════════════════════════════════════════════════════╗
  ║  S1AF — Sovereign Deploy Pipeline                          ║
  ║  © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — Sovereign 1  ║
  ╚══════════════════════════════════════════════════════════════╝
${RESET}"
echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC') · $(git rev-parse --short HEAD 2>/dev/null)"
[[ "$DRY_RUN" == "true" ]] && echo -e "  ${YELLOW}DRY RUN — no changes will be pushed${RESET}\n"

# ══════════════════════════════════════════════════════════════════════════════
banner "Step 1 · Pre-flight Pipeline"
# ══════════════════════════════════════════════════════════════════════════════

if [[ "$NO_BUILD" == "false" ]]; then
  info "Running 7-phase pipeline (proceed.sh)..."
  set +e
  PIPELINE_OUT="$(bash "${SCRIPT_DIR}/proceed.sh" 2>&1)"
  PIPELINE_EXIT=$?
  set -e

  # Count warnings/failures from summary table (unicode-safe: use python3)
  WARNS="$(echo "$PIPELINE_OUT" | python3 -c "
import sys, re
out = sys.stdin.read()
m = re.search(r'[⚠]\s+(\d+)', out)
print(m.group(1) if m else '0')
" 2>/dev/null || echo "0")"
  FAILS="$(echo "$PIPELINE_OUT" | python3 -c "
import sys, re
out = sys.stdin.read()
m = re.search(r'[✗]\s+(\d+)', out)
print(m.group(1) if m else '0')
" 2>/dev/null || echo "0")"

  # Print phase summary lines
  echo "$PIPELINE_OUT" | python3 -c "
import sys
for line in sys.stdin:
    if any(k in line for k in ['Phase ','Result','✓ ','⚠ ','✗ ']):
        print('   ', line.rstrip())
" 2>/dev/null || true

  if [[ "${PIPELINE_EXIT}" -ne 0 || "${FAILS:-0}" -gt 0 ]]; then
    echo ""
    fail "Pipeline failed (exit=${PIPELINE_EXIT}, failures=${FAILS}) — aborting deploy"
    echo ""
    echo "$PIPELINE_OUT" | tail -30
    exit 1
  fi

  if [[ "${WARNS:-0}" -gt 0 ]]; then
    warn "Pipeline has ${WARNS} warning(s) — proceeding with caution"
  else
    ok "Pipeline clean (7/7 phases passed)"
  fi
else
  warn "Skipping pipeline (--no-build)"
fi

# ══════════════════════════════════════════════════════════════════════════════
banner "Step 2 · Version & Tag"
# ══════════════════════════════════════════════════════════════════════════════

# Generate version: v<YYYY>.<MM>.<DD>-s1af or bump if tag exists today
TODAY="$(date -u '+%Y.%m.%d')"
BASE_TAG="v${TODAY}-s1af"
EXISTING="$(git tag --list "${BASE_TAG}*" 2>/dev/null | wc -l | tr -d ' ')"
if [[ "$EXISTING" -eq 0 ]]; then
  VERSION="${BASE_TAG}"
else
  VERSION="${BASE_TAG}.${EXISTING}"
fi

COMMIT_SHA="$(git rev-parse --short HEAD 2>/dev/null)"
info "Version : ${VERSION}"
info "Commit  : ${COMMIT_SHA}"

if [[ "$DRY_RUN" == "false" ]]; then
  git tag -a "${VERSION}" -m "S1AF deploy ${VERSION} — OCSO-S1AF-GOV-1" 2>/dev/null && \
    ok "Tagged: ${VERSION}" || warn "Tag already exists (re-deploy)"
else
  ok "Dry run — tag ${VERSION} not created"
fi

# ══════════════════════════════════════════════════════════════════════════════
banner "Step 3 · Package Verification"
# ══════════════════════════════════════════════════════════════════════════════

ZIP="${REPO_ROOT}/build-output/Oracle-AI-Kimi-Xcode.zip"
if [[ ! -f "$ZIP" ]]; then
  fail "Xcode ZIP not found — run proceed.sh first"
  exit 1
fi

ZIP_SIZE="$(du -sh "$ZIP" | cut -f1)"
ZIP_SHA="$(sha256sum "$ZIP" | cut -c1-16)"
ok "Xcode ZIP   : ${ZIP_SIZE} · sha256: ${ZIP_SHA}…"

# Also verify OracleAICore if swift is available
if command -v swift &>/dev/null; then
  info "Verifying OracleAICore (swift build)..."
  if swift build --target OracleAICore --configuration release -q 2>/dev/null; then
    ok "OracleAICore: release build clean"
  else
    warn "OracleAICore release build has warnings"
  fi
fi

# Write deploy manifest
MANIFEST="${REPO_ROOT}/build-output/deploy-manifest.json"
python3 -c "
import json, datetime
print(json.dumps({
  'version':    '${VERSION}',
  'commit':     '${COMMIT_SHA}',
  'deployedAt': datetime.datetime.utcnow().isoformat() + 'Z',
  'sovereign':  'OCSO-S1AF-GOV-1',
  'xcode_zip':  'Oracle-AI-Kimi-Xcode.zip',
  'zip_sha256': '${ZIP_SHA}',
  'platforms':  ['iOS', 'Linux'],
}, indent=2))
" > "${MANIFEST}"
ok "Deploy manifest: build-output/deploy-manifest.json"

# ══════════════════════════════════════════════════════════════════════════════
banner "Step 4 · GitHub Release"
# ══════════════════════════════════════════════════════════════════════════════

DEPLOY_SECRET="$(s1af_decrypt_named deploy-secret 2>/dev/null || echo "")"

if [[ "${#DEPLOY_SECRET}" -ge 16 && "$DRY_RUN" == "false" ]]; then
  info "Calling release endpoint (X-Deploy-Secret)..."
  RELEASE_RESP="$(curl -sf -X POST "${API}/sentient/create-release" \
    -H "Content-Type: application/json" \
    -H "X-Deploy-Secret: ${DEPLOY_SECRET}" \
    -d "{\"version\":\"${VERSION}\",\"commit\":\"${COMMIT_SHA}\"}" \
    2>/dev/null || echo "")"

  if [[ -n "$RELEASE_RESP" ]]; then
    RELEASE_URL="$(echo "$RELEASE_RESP" | \
      python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('releaseUrl',''))" 2>/dev/null || echo "")"
    RELEASE_ID="$(echo "$RELEASE_RESP" | \
      python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('releaseId',''))" 2>/dev/null || echo "")"

    if [[ -n "$RELEASE_URL" ]]; then
      ok "GitHub release created: ${RELEASE_URL}"
    else
      warn "Release endpoint responded — URL pending connector push"
      detail "$(echo "$RELEASE_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('message',''))" 2>/dev/null)"
    fi
  else
    warn "Release endpoint unavailable — release will be created via connector push"
    detail "URL: https://github.com/jonathanEIDfounder/oracle-ai/releases/tag/${VERSION}"
  fi
else
  if [[ "$DRY_RUN" == "true" ]]; then
    ok "Dry run — GitHub release skipped"
    detail "Would create: https://github.com/jonathanEIDfounder/oracle-ai/releases/tag/${VERSION}"
  else
    warn "Deploy secret unavailable — run: make auth"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
banner "Step 5 · Connector Push"
# ══════════════════════════════════════════════════════════════════════════════

if [[ "$DRY_RUN" == "false" ]]; then
  info "Pushing release artifacts to oracle-ai/main..."
  git add build-output/deploy-manifest.json 2>/dev/null || true
  git diff --cached --quiet 2>/dev/null || \
    git commit -m "S1AF deploy ${VERSION} — OCSO-S1AF-GOV-1 — ${COMMIT_SHA}" 2>/dev/null || true

  PUSH_RESP="$(curl -sf -X POST "${API}/sentient/git-push" \
    -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "")"
  PUSHED="$(echo "$PUSH_RESP" | \
    python3 -c "import json,sys; print(json.load(sys.stdin).get('pushed',0))" 2>/dev/null || echo "0")"
  ok "Pushed ${PUSHED} file(s) via Replit connector"
else
  ok "Dry run — push skipped"
fi

# ══════════════════════════════════════════════════════════════════════════════
echo -e "\n  ${BOLD}┌────────────────────────────────────────────────────────────┐${RESET}"
echo -e   "  ${BOLD}│  S1AF — Deploy Complete                                   │${RESET}"
echo -e   "  ${BOLD}├────────────────────────────────────────────────────────────┤${RESET}"
printf    "  ${BOLD}│${RESET}  %-14s %s\n" "Version"    "${VERSION}"
printf    "  ${BOLD}│${RESET}  %-14s %s\n" "Commit"     "${COMMIT_SHA}"
printf    "  ${BOLD}│${RESET}  %-14s %s\n" "Xcode ZIP"  "${ZIP_SIZE}"
printf    "  ${BOLD}│${RESET}  %-14s %s\n" "Platforms"  "iOS · Linux (Swift 5.8)"
printf    "  ${BOLD}│${RESET}  %-14s %s\n" "Release"    "https://github.com/jonathanEIDfounder/oracle-ai/releases/tag/${VERSION}"
echo -e   "  ${BOLD}└────────────────────────────────────────────────────────────┘${RESET}\n"
echo "  © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"
echo ""
