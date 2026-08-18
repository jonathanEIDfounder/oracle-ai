#!/usr/bin/env bash
# =============================================================================
# © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1
# S1AF — Sentient iOS One-Step App Framework · Sovereign ID: 1
# Author      : Jonathan Sherman (jonathanEIDfounder)
# Copyright   : © 2026 Jonathan Sherman. All rights reserved.
# License     : PROPRIETARY — No license granted without express written permission.
# DRM         : S1AF-DRM-LOCKED
# =============================================================================
#
# proceed.sh — S1AF Master 7-Phase Automation Pipeline
#
#   Phase 1 · Detect platform (Replit / macOS / other)
#   Phase 2 · Verify integrity (178-file minimum)
#   Phase 3 · Auto-configure tokens
#   Phase 4 · Auto-commit changes
#   Phase 5 · Auto-push to GitHub
#   Phase 6 · Platform build (Xcode gen / iOS build / dashboard)
#   Phase 7 · Health check report
#
# Usage:
#   cd ~/Oracle-AI && bash scripts/proceed.sh
#   make proceed
# =============================================================================
set -uo pipefail
readonly _S1AF_AUTHOR="© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
API="http://localhost:8080/api"
T0="${SECONDS}"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'
ok()    { echo -e "    ${GREEN}✓${RESET}  $*"; }
fail()  { echo -e "    ${RED}✗${RESET}  $*"; }
warn()  { echo -e "    ${YELLOW}⚠${RESET}  $*"; }
info()  { echo -e "    ${CYAN}→${RESET}  $*"; }
detail(){ echo -e "    ${DIM}   $*${RESET}"; }
phase() { echo -e "\n${BOLD}┌─ Phase $1 ─ $2 ──────────────────────────────────────────${RESET}"; }
result(){ echo -e "${BOLD}└─ $*${RESET}"; }

# Global counters
PHASES_OK=0; PHASES_WARN=0; PHASES_FAIL=0
declare -A PHASE_STATUS PHASE_NOTE

mark_phase() {
  local n="$1" s="$2" note="$3"
  PHASE_STATUS[$n]="$s"
  PHASE_NOTE[$n]="${note}"
  case "$s" in
    ok)   PHASES_OK=$((PHASES_OK+1)) ;;
    warn) PHASES_WARN=$((PHASES_WARN+1)) ;;
    fail) PHASES_FAIL=$((PHASES_FAIL+1)) ;;
  esac
}

# ─────────────────────────────────────────────────────────────────────────────
clear 2>/dev/null || true
echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║  S1AF — Master 7-Phase Automation Pipeline                  ║"
echo "  ║  © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — Sovereign 1   ║"
echo "  ╚══════════════════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "  ${DIM}$(date -u '+%Y-%m-%d %H:%M:%S UTC') · repo: ${REPO_ROOT}${RESET}"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 1 — Platform Detection
# ══════════════════════════════════════════════════════════════════════════════
phase 1 "Platform Detection"

PLATFORM="unknown"
PLATFORM_CAPS=()

# Replit
if [[ -n "${REPLIT_SLUG:-}${REPL_ID:-}${REPLIT_OWNER:-}" ]]; then
  PLATFORM="replit"
  PLATFORM_CAPS+=(xcode-gen zip-package api-push)
  ok "Replit — Linux container"
  detail "REPL_ID    : ${REPL_ID:-unset}"
  detail "Owner      : ${REPLIT_OWNER:-unset}"
  detail "Dev domain : ${REPLIT_DEV_DOMAIN:-unset}"

# macOS
elif command -v sw_vers &>/dev/null; then
  PLATFORM="macos"
  MACOS_VER="$(sw_vers -productVersion 2>/dev/null || echo unknown)"
  PLATFORM_CAPS+=(xcodebuild xcode-open native-build)
  ok "macOS ${MACOS_VER}"
  if command -v xcodebuild &>/dev/null; then
    detail "Xcode : $(xcodebuild -version 2>/dev/null | head -1)"
    PLATFORM_CAPS+=(xcodebuild-available)
  else
    warn "Xcode / xcodebuild not found"
  fi
  if command -v xcodegen &>/dev/null; then
    detail "xcodegen : $(xcodegen version 2>/dev/null)"
    PLATFORM_CAPS+=(xcodegen-available)
  fi

# Generic Linux
else
  PLATFORM="linux"
  PLATFORM_CAPS+=(xcode-gen zip-package)
  ok "Linux ($(uname -r 2>/dev/null | cut -d- -f1))"
fi

detail "Capabilities : ${PLATFORM_CAPS[*]:-none}"
result "PLATFORM=${PLATFORM}"
mark_phase 1 ok "${PLATFORM}"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — Integrity Verification (178-file minimum)
# ══════════════════════════════════════════════════════════════════════════════
phase 2 "Integrity Verification"
INTEGRITY_FAIL=0

# ── File count ───────────────────────────────────────────────────────────────
TRACKED=$(git -C "${REPO_ROOT}" ls-files 2>/dev/null | wc -l | tr -d ' ')
SOURCE=$(git -C "${REPO_ROOT}" ls-files 2>/dev/null | \
  grep -E '\.(swift|ts|tsx|sh|py|plist|yml|yaml|json|md)$|Makefile' | \
  grep -vE '\.lock$|pnpm-lock|node_modules' | wc -l | tr -d ' ')
MIN_FILES=178

if [[ "$SOURCE" -ge "$MIN_FILES" ]]; then
  ok "File count: ${SOURCE} source files (≥${MIN_FILES} ✓)"
else
  fail "File count: ${SOURCE} source files — below minimum ${MIN_FILES}"
  INTEGRITY_FAIL=$((INTEGRITY_FAIL+1))
fi
detail "Total tracked : ${TRACKED}"
detail "Source files  : ${SOURCE}  (swift/ts/sh/py/plist/yml/json/md)"

# ── Critical file manifest ────────────────────────────────────────────────────
check_file() {
  local f="${REPO_ROOT}/$1" label="$2"
  if [[ -f "$f" ]]; then ok "$label"; else fail "$label — MISSING: $1"; INTEGRITY_FAIL=$((INTEGRITY_FAIL+1)); fi
}

echo ""
info "Critical file manifest:"
check_file "AARTE-iOS-App/Sources/BiometricAuthManager.swift" "BiometricAuthManager.swift"
check_file "AARTE-iOS-App/Sources/DeviceGuard.swift"          "DeviceGuard.swift"
check_file "AARTE-iOS-App/Sources/OracleAIApp.swift"          "OracleAIApp.swift"
check_file "AARTE-iOS-App/Sources/ContentView.swift"          "ContentView.swift"
check_file "AARTE-iOS-App/project.yml"                        "project.yml (XcodeGen spec)"
check_file "AARTE-iOS-App/Info.plist"                         "Info.plist"
check_file "AARTE-iOS-App/KimiConfig.plist"                   "KimiConfig.plist"
check_file "scripts/kimi-replit-xcode-bridge.sh"              "kimi-replit-xcode-bridge.sh"
check_file "scripts/replit-xcode-generate.sh"                 "replit-xcode-generate.sh"
check_file "scripts/gen-pbxproj.py"                           "gen-pbxproj.py"
check_file "scripts/auto-run.sh"                              "auto-run.sh"
check_file "scripts/proceed.sh"                               "proceed.sh (self)"
check_file "Makefile"                                         "Makefile"
check_file "artifacts/api-server/src/lib/authorship.ts"       "authorship.ts (DRM anchor)"
check_file "artifacts/api-server/src/routes/sentient.ts"      "sentient.ts (sovereign routes)"

# ── Authorship check ─────────────────────────────────────────────────────────
echo ""
info "Authorship verification:"
STAMPED=$(grep -rl "OCSO-S1AF-GOV-1" \
  "${REPO_ROOT}/AARTE-iOS-App/Sources" \
  "${REPO_ROOT}/artifacts/api-server/src" \
  "${REPO_ROOT}/scripts" 2>/dev/null | wc -l | tr -d ' ')
if [[ "$STAMPED" -ge 60 ]]; then
  ok "Authorship embedded in ${STAMPED} source files"
else
  warn "Only ${STAMPED} files have authorship — expected ≥60"
fi

if [[ "$INTEGRITY_FAIL" -eq 0 ]]; then
  result "INTEGRITY PASSED (0 failures)"
  mark_phase 2 ok "0 failures — ${SOURCE} files"
else
  result "INTEGRITY ${INTEGRITY_FAIL} FAILURE(S)"
  mark_phase 2 fail "${INTEGRITY_FAIL} missing files"
fi

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3 — Token Configuration
# ══════════════════════════════════════════════════════════════════════════════
phase 3 "Token Configuration"

TOKEN_OK=0; TOKEN_WARN=0

# Source the cipher helper quietly
source "${SCRIPT_DIR}/pat-cipher.sh" 2>/dev/null || true

# ── GitHub PAT ───────────────────────────────────────────────────────────────
info "GitHub PAT:"
_GH_PAT="$(s1af_decrypt_named github-pat 2>/dev/null || echo "")"
if [[ "${#_GH_PAT}" -ge 20 && "$_GH_PAT" != *"TEST"* && "$_GH_PAT" != *"placeholder"* ]]; then
  _GH_USER="$(curl -sf -H "Authorization: Bearer ${_GH_PAT}" \
    https://api.github.com/user 2>/dev/null | \
    python3 -c "import json,sys; print(json.load(sys.stdin).get('login',''))" 2>/dev/null || echo "")"
  if [[ -n "$_GH_USER" ]]; then
    ok "Valid — authenticated as: ${_GH_USER}"
    TOKEN_OK=$((TOKEN_OK+1))
  else
    warn "Stored but rejected by GitHub API"
    TOKEN_WARN=$((TOKEN_WARN+1))
    _GH_PAT=""
  fi
else
  warn "Placeholder/test token in cipherstore"
  detail "Enter a real token: bash scripts/github-auth.sh"
  TOKEN_WARN=$((TOKEN_WARN+1))
  _GH_PAT=""
fi

# ── Moonshot key ─────────────────────────────────────────────────────────────
info "Moonshot (Kimi) key:"
_MS_KEY="$(s1af_decrypt_named moonshot-key 2>/dev/null || echo "")"
if [[ "${#_MS_KEY}" -ge 20 && "$_MS_KEY" == sk-* ]]; then
  _MS_OK="$(curl -sf -H "Authorization: Bearer ${_MS_KEY}" \
    https://api.moonshot.cn/v1/models 2>/dev/null | \
    python3 -c "import json,sys; d=json.load(sys.stdin); print('ok' if d.get('data') else 'fail')" 2>/dev/null || echo "fail")"
  if [[ "$_MS_OK" == "ok" ]]; then
    ok "Valid Moonshot key"
    TOKEN_OK=$((TOKEN_OK+1))
  else
    warn "Stored but rejected by Moonshot API"
    TOKEN_WARN=$((TOKEN_WARN+1))
  fi
else
  warn "Placeholder/test key in cipherstore"
  detail "Enter a real key: bash scripts/moonshot-auth.sh"
  TOKEN_WARN=$((TOKEN_WARN+1))
fi

# ── Deploy secret ─────────────────────────────────────────────────────────────
info "Deploy secret:"
_DS="${DEPLOY_SECRET:-}"
# Fall back to cipherstore when env var is a placeholder
if [[ "${#_DS}" -lt 16 ]]; then
  _DS="$(s1af_decrypt_named deploy-secret 2>/dev/null || echo "")"
fi
if [[ "${#_DS}" -ge 16 ]]; then
  ok "Deploy secret valid (${#_DS} chars, src: cipherstore)"
  TOKEN_OK=$((TOKEN_OK+1))
else
  warn "DEPLOY_SECRET missing — run: make tokens"
  TOKEN_WARN=$((TOKEN_WARN+1))
fi
unset _DS

# ── Summary ───────────────────────────────────────────────────────────────────
detail "Tokens OK: ${TOKEN_OK}  Warnings: ${TOKEN_WARN}"
if [[ "$TOKEN_WARN" -eq 0 ]]; then
  result "ALL TOKENS VALID"
  mark_phase 3 ok "3/3 tokens valid"
elif [[ "$TOKEN_OK" -ge 1 ]]; then
  result "PARTIAL — ${TOKEN_WARN} token(s) need real credentials"
  mark_phase 3 warn "${TOKEN_OK} valid, ${TOKEN_WARN} placeholder"
else
  result "NO VALID TOKENS — push will use Replit integration"
  mark_phase 3 warn "all placeholders — integration fallback active"
fi

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 4 — Auto-Commit
# ══════════════════════════════════════════════════════════════════════════════
phase 4 "Auto-Commit"
cd "${REPO_ROOT}"

NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Stamp new files
NEWLY_STAMPED="$(node "${SCRIPT_DIR}/embed-authorship.mjs" 2>/dev/null | \
  grep "^✓" | wc -l | tr -d ' ')"
if [[ "$NEWLY_STAMPED" -gt 0 ]]; then
  info "Stamped ${NEWLY_STAMPED} new file(s) with authorship"
fi

# Stage
git add -A 2>/dev/null || true

# Check for changes
if git diff --cached --quiet 2>/dev/null; then
  ok "Working tree clean — nothing to commit"
  COMMIT_SHA="$(git rev-parse --short HEAD 2>/dev/null)"
  mark_phase 4 ok "already clean (${COMMIT_SHA})"
else
  CHANGED="$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')"
  MSG="S1AF — proceed: ${CHANGED} file(s) — OCSO-S1AF-GOV-1 — ${NOW}"
  git commit -m "$MSG" 2>/dev/null
  COMMIT_SHA="$(git rev-parse --short HEAD 2>/dev/null)"
  ok "Committed ${CHANGED} file(s) → ${COMMIT_SHA}"
  detail "${MSG}"
  mark_phase 4 ok "${CHANGED} files committed (${COMMIT_SHA})"
fi
result "HEAD: $(git log --oneline -1 2>/dev/null)"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 5 — Auto-Push to GitHub
# ══════════════════════════════════════════════════════════════════════════════
phase 5 "Auto-Push to GitHub"
PUSH_OK=false

# ── Try PAT push ──────────────────────────────────────────────────────────────
if [[ -n "${_GH_PAT:-}" ]]; then
  info "Pushing via GitHub PAT..."
  REMOTE_URL="https://jonathanEIDfounder:${_GH_PAT}@github.com/jonathanEIDfounder/oracle-ai.git"
  if git push "$REMOTE_URL" HEAD:main --tags 2>/dev/null; then
    ok "Pushed to oracle-ai/main via PAT"
    PUSH_OK=true
    mark_phase 5 ok "PAT push → oracle-ai/main"
  else
    warn "PAT push failed — falling back to Replit integration"
  fi
  unset REMOTE_URL
fi

# ── Replit integration fallback ───────────────────────────────────────────────
if [[ "$PUSH_OK" == "false" ]]; then
  info "Pushing via Replit GitHub integration..."
  PUSH_RESP="$(curl -sf -X POST "${API}/sentient/git-push" \
    -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "")"
  if [[ -n "$PUSH_RESP" ]]; then
    PUSHED="$(echo "$PUSH_RESP" | python3 -c \
      "import json,sys; print(json.load(sys.stdin).get('pushed',0))" 2>/dev/null || echo "0")"
    ok "Pushed ${PUSHED} file(s) via Replit GitHub integration"
    PUSH_OK=true
    mark_phase 5 ok "integration push (${PUSHED} files)"
  else
    warn "Integration push unavailable — changes committed locally only"
    detail "Run: bash scripts/auto-run.sh (to retry push)"
    mark_phase 5 warn "local only — no remote push"
  fi
fi

result "$(git log --oneline -1 2>/dev/null)"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 6 — Platform Build
# ══════════════════════════════════════════════════════════════════════════════
phase 6 "Platform Build"

case "$PLATFORM" in

  # ── Replit: generate Xcode project + ZIP ────────────────────────────────────
  replit|linux)
    info "Replit platform — running Kimi-Replit-Xcode bridge..."
    echo ""
    bash "${SCRIPT_DIR}/kimi-replit-xcode-bridge.sh" 2>&1 | \
      grep -E "✓|✗|⚠|→|══|──|Build|Download|ZIP|files" | \
      while IFS= read -r line; do echo "    $line"; done
    echo ""
    ZIP="${REPO_ROOT}/build-output/Oracle-AI-Kimi-Xcode.zip"
    if [[ -f "$ZIP" ]]; then
      ZIP_SIZE="$(du -sh "$ZIP" | cut -f1)"
      ok "build-output/Oracle-AI-Kimi-Xcode.zip (${ZIP_SIZE})"
      mark_phase 6 ok "ZIP ready — ${ZIP_SIZE}"
    else
      fail "ZIP not created"
      mark_phase 6 fail "ZIP missing"
    fi
    ;;

  # ── macOS: native xcodebuild ─────────────────────────────────────────────
  macos)
    XCPROJ="${REPO_ROOT}/Oracle-AI.xcodeproj"

    # Generate .xcodeproj if missing
    if [[ ! -d "$XCPROJ" ]]; then
      info "Generating Oracle-AI.xcodeproj via XcodeGen..."
      if command -v xcodegen &>/dev/null; then
        xcodegen generate --spec "${REPO_ROOT}/AARTE-iOS-App/project.yml" \
                          --project "${REPO_ROOT}" 2>&1 | tail -3
      else
        info "xcodegen not found — using Replit generator..."
        bash "${SCRIPT_DIR}/replit-xcode-generate.sh" 2>&1 | grep -E "✓|✗|⚠"
        XCPROJ="${REPO_ROOT}/Oracle-AI-Kimi-Xcode/Oracle-AI.xcodeproj"
      fi
    fi

    if [[ -d "$XCPROJ" ]]; then
      ok "Oracle-AI.xcodeproj present"

      # Attempt xcodebuild if available
      if [[ " ${PLATFORM_CAPS[*]} " =~ " xcodebuild-available " ]]; then
        info "Building for iPhone XR (iPhone11,8)..."
        DEST="generic/platform=iOS"
        xcodebuild -project "$XCPROJ" \
                   -scheme "Oracle-AI" \
                   -configuration Debug \
                   -destination "$DEST" \
                   CODE_SIGN_STYLE=Automatic \
                   build 2>&1 | \
          grep -E "BUILD SUCCEEDED|BUILD FAILED|error:|warning:" | \
          while IFS= read -r l; do echo "    $l"; done

        if [[ "${PIPESTATUS[0]}" -eq 0 ]]; then
          ok "BUILD SUCCEEDED"
          mark_phase 6 ok "xcodebuild succeeded"
        else
          fail "BUILD FAILED — check Xcode for errors"
          mark_phase 6 fail "xcodebuild failed"
        fi
      else
        warn "xcodebuild unavailable — open manually:"
        detail "open ${XCPROJ}"
        mark_phase 6 warn "xcodeproj generated — open in Xcode"
      fi
    else
      fail "xcodeproj not found after generation"
      mark_phase 6 fail "xcodeproj missing"
    fi
    ;;

  *)
    warn "Unknown platform — skipping build step"
    mark_phase 6 warn "unknown platform"
    ;;
esac

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 7 — Health Check Report
# ══════════════════════════════════════════════════════════════════════════════
phase 7 "Health Check Report"

# ── API server ────────────────────────────────────────────────────────────────
info "API server:"
HEALTH="$(curl -sf "${API}/healthz" 2>/dev/null | \
  python3 -c "import json,sys; d=json.load(sys.stdin); print('online' if d.get('ok') else '?')" 2>/dev/null || echo "offline")"
[[ "$HEALTH" == "online" ]] && ok "API server: ${HEALTH}" || fail "API server: ${HEALTH}"

# ── Boot generation ───────────────────────────────────────────────────────────
info "Sovereign session:"
BOOT="$(curl -sf "${API}/sentient/boot-status" 2>/dev/null | \
  python3 -c "import json,sys; d=json.load(sys.stdin); print(f\"gen={d.get('generation','?')} boots={d.get('bootCount','?')}\")" 2>/dev/null || echo "unavailable")"
ok "Boot status: ${BOOT}"

# ── Git ───────────────────────────────────────────────────────────────────────
info "Git:"
ok "Branch : $(git -C "${REPO_ROOT}" branch --show-current 2>/dev/null)"
ok "HEAD   : $(git -C "${REPO_ROOT}" log --oneline -1 2>/dev/null)"
ok "Ahead  : $(git -C "${REPO_ROOT}" rev-list --count gitsafe-backup/main..HEAD 2>/dev/null || echo "?") commit(s) ahead of last push"

# ── File inventory ────────────────────────────────────────────────────────────
info "File inventory:"
SWIFT_N="$(find "${REPO_ROOT}/AARTE-iOS-App/Sources" -name "*.swift" 2>/dev/null | wc -l | tr -d ' ')"
TS_N="$(find "${REPO_ROOT}/artifacts/api-server/src" -name "*.ts" 2>/dev/null | wc -l | tr -d ' ')"
SH_N="$(find "${REPO_ROOT}/scripts" -name "*.sh" -o -name "*.mjs" -o -name "*.py" 2>/dev/null | wc -l | tr -d ' ')"
ok "Swift sources : ${SWIFT_N}"
ok "TypeScript    : ${TS_N} (api-server/src)"
ok "Scripts       : ${SH_N} (scripts/)"

ZIP_F="${REPO_ROOT}/build-output/Oracle-AI-Kimi-Xcode.zip"
if [[ -f "$ZIP_F" ]]; then
  ok "Xcode ZIP     : $(du -sh "$ZIP_F" | cut -f1)"
else
  warn "Xcode ZIP     : not built yet (run make kimi-xcode)"
fi

mark_phase 7 ok "all checks complete"
result "HEALTH REPORT COMPLETE"

# ══════════════════════════════════════════════════════════════════════════════
# FINAL DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════
ELAPSED=$((SECONDS - T0))
echo ""
echo -e "${BOLD}  ┌────────────────────────────────────────────────────────────┐${RESET}"
echo -e "${BOLD}  │  S1AF — 7-Phase Pipeline Complete                         │${RESET}"
echo -e "${BOLD}  ├────────┬──────────────────────────────────────────────────┤${RESET}"

for n in 1 2 3 4 5 6 7; do
  s="${PHASE_STATUS[$n]:-?}"
  note="${PHASE_NOTE[$n]:--}"
  case "$s" in
    ok)   icon="${GREEN}✓${RESET}" ;;
    warn) icon="${YELLOW}⚠${RESET}" ;;
    fail) icon="${RED}✗${RESET}" ;;
    *)    icon="${DIM}?${RESET}" ;;
  esac
  printf "  │  Phase %-1s │  %b  %-44s│\n" \
    "$n" "$icon" "${note:0:44}"
done

echo -e "${BOLD}  ├────────┴──────────────────────────────────────────────────┤${RESET}"
printf "  │  Result   %s✓ %d  ⚠ %d  ✗ %d%s  ·  %ds elapsed%*s│\n" \
  "${BOLD}" "$PHASES_OK" "$PHASES_WARN" "$PHASES_FAIL" "${RESET}" \
  "$ELAPSED" "$((24 - ${#ELAPSED}))" ""
echo -e "${BOLD}  └────────────────────────────────────────────────────────────┘${RESET}"
echo ""
echo -e "  ${DIM}${_S1AF_AUTHOR}${RESET}"
echo ""

# Exit non-zero if any phase failed
[[ "$PHASES_FAIL" -eq 0 ]]
