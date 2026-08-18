#!/usr/bin/env bash
# =============================================================================
# © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1
# S1AF — Sentient iOS One-Step App Framework · Sovereign ID: 1
# Author      : Jonathan Sherman (jonathanEIDfounder)
# Copyright   : © 2026 Jonathan Sherman. All rights reserved.
# License     : PROPRIETARY
# DRM         : S1AF-DRM-LOCKED
# =============================================================================
# kimi-replit-xcode-bridge.sh
# Full bridge: integrity check → generate → push → ZIP package
#
# Usage (from repo root or ~/Oracle-AI):
#   bash scripts/kimi-replit-xcode-bridge.sh
#   make kimi-xcode
# =============================================================================
set -euo pipefail
readonly _S1AF_AUTHOR="© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUILD_DIR="${REPO_ROOT}/build-output"
ZIP_NAME="Oracle-AI-Kimi-Xcode.zip"
ZIP_PATH="${BUILD_DIR}/${ZIP_NAME}"
API="http://localhost:8080/api"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'
BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'
ok()    { echo -e "${GREEN}  ✓  $*${RESET}"; }
warn()  { echo -e "${YELLOW}  ⚠  $*${RESET}"; }
info()  { echo -e "${CYAN}  →  $*${RESET}"; }
hdr()   { echo -e "\n${BOLD}══ $* ══${RESET}"; }

clear 2>/dev/null || true
echo -e "${BOLD}"
echo "  ██████████████████████████████████████████████████████"
echo "  ██  S1AF — Kimi·Replit·Xcode Bridge                ██"
echo "  ██  © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1      ██"
echo "  ██  Sovereign ID: 1                                 ██"
echo "  ██████████████████████████████████████████████████████"
echo -e "${RESET}"

PASS=0; FAIL=0

# ══════════════════════════════════════════════════════════════════════════════
# STEP 1: Integrity verification
# ══════════════════════════════════════════════════════════════════════════════
hdr "1  Integrity Verification"

check() {
  local desc="$1"; shift
  if "$@" &>/dev/null; then ok "$desc"; PASS=$((PASS + 1)); else warn "$desc (skipped)"; FAIL=$((FAIL + 1)); fi
}

check "BiometricAuthManager.swift present" \
  test -f "${REPO_ROOT}/AARTE-iOS-App/Sources/BiometricAuthManager.swift"
check "DeviceGuard.swift present" \
  test -f "${REPO_ROOT}/AARTE-iOS-App/Sources/DeviceGuard.swift"
check "OracleAIApp.swift present" \
  test -f "${REPO_ROOT}/AARTE-iOS-App/Sources/OracleAIApp.swift"
check "ContentView.swift present" \
  test -f "${REPO_ROOT}/AARTE-iOS-App/Sources/ContentView.swift"
check "project.yml present" \
  test -f "${REPO_ROOT}/AARTE-iOS-App/project.yml"
check "Info.plist present" \
  test -f "${REPO_ROOT}/AARTE-iOS-App/Info.plist"
check "KimiConfig.plist present" \
  test -f "${REPO_ROOT}/AARTE-iOS-App/KimiConfig.plist"
check "Authorship embedded in sources" \
  grep -q "OCSO-S1AF-GOV-1" "${REPO_ROOT}/AARTE-iOS-App/Sources/BiometricAuthManager.swift"
check "API server responding" \
  curl -sf "${API}/healthz"

echo ""
echo -e "  ${GREEN}${PASS} passed${RESET}  ${YELLOW}${FAIL} warned${RESET}"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 2: Generate Xcode project
# ══════════════════════════════════════════════════════════════════════════════
hdr "2  Xcode Project Generation"

info "Running replit-xcode-generate.sh..."
bash "${SCRIPT_DIR}/replit-xcode-generate.sh"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 3: Push updated sources to GitHub
# ══════════════════════════════════════════════════════════════════════════════
hdr "3  Kimi Config Injection + Push"

# Inject Kimi config into AARTE-iOS-App directory
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
sed "s/__GENERATED_AT__/${NOW}/" \
  "${REPO_ROOT}/AARTE-iOS-App/KimiConfig.plist" > /tmp/KimiConfig.stamped.plist
cp /tmp/KimiConfig.stamped.plist "${REPO_ROOT}/AARTE-iOS-App/KimiConfig.plist"
ok "KimiConfig.plist stamped (${NOW})"

# Commit new Swift sources if any changed
cd "${REPO_ROOT}"
if ! git diff --quiet -- AARTE-iOS-App/ 2>/dev/null; then
  git add AARTE-iOS-App/ Oracle-AI-Kimi-Xcode/ 2>/dev/null || true
  git commit -m "S1AF — Kimi-Xcode bridge: generated project + stamped config — OCSO-S1AF-GOV-1 — ${NOW}" \
    2>/dev/null && ok "Changes committed to git" || warn "Nothing new to commit"
else
  ok "No changes to commit"
fi

# Push via API
PUSH_RESP=$(curl -sf -X POST "${API}/sentient/git-push" \
  -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "")
if [[ -n "$PUSH_RESP" ]]; then
  PUSHED=$(echo "$PUSH_RESP" | python3 -c \
    "import json,sys; print(json.load(sys.stdin).get('pushed',0))" 2>/dev/null || echo "0")
  ok "Pushed ${PUSHED} file(s) via Replit GitHub integration"
else
  warn "Git push skipped (run auto-run.sh to push manually)"
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 4: ZIP package
# ══════════════════════════════════════════════════════════════════════════════
hdr "4  ZIP Packaging"

mkdir -p "${BUILD_DIR}"
GEN_DIR="${REPO_ROOT}/Oracle-AI-Kimi-Xcode"

info "Packaging ${GEN_DIR} → ${ZIP_PATH}"
cd "${REPO_ROOT}"
rm -f "${ZIP_PATH}"
zip -r "${ZIP_PATH}" Oracle-AI-Kimi-Xcode/ -x "*.DS_Store" 2>/dev/null
ZIP_SIZE=$(du -sh "${ZIP_PATH}" | cut -f1)
ok "ZIP created: ${ZIP_NAME} (${ZIP_SIZE})"

FILE_COUNT=$(find "${GEN_DIR}" -type f | wc -l | tr -d ' ')
ok "${FILE_COUNT} files packaged"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 5: Summary
# ══════════════════════════════════════════════════════════════════════════════
hdr "5  Summary"

echo ""
echo -e "  ${GREEN}${BOLD}Build complete${RESET}"
echo ""
echo -e "  ${BOLD}Download:${RESET}  build-output/${ZIP_NAME}"
echo ""
echo -e "  ${BOLD}On your Mac:${RESET}"
echo -e "    unzip Oracle-AI-Kimi-Xcode.zip -d ~/Documents/Oracle-AI"
echo -e "    open ~/Documents/Oracle-AI/Oracle-AI.xcodeproj"
echo ""
echo -e "  ${BOLD}In Xcode:${RESET}"
echo -e "    • Select iPhone XR (connected via USB)"
echo -e "    • Set your Team ID in Signing settings"
echo -e "    • Click Build (⌘B) → Run (⌘R)"
echo ""
echo -e "  ${DIM}${_S1AF_AUTHOR}${RESET}"
echo ""
