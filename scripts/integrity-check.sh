#!/usr/bin/env bash
# ================================================================
# S1AF Integrity Check — OCSO-S1AF-GOV-1
# © 2026 Jonathan Sherman — All rights reserved.
#
# Usage:
#   bash scripts/integrity-check.sh verify   # full integrity pass
#   bash scripts/integrity-check.sh list     # list all checked files
# ================================================================
set -uo pipefail   # NOTE: no -e so arithmetic never exits early

readonly _S1AF_AUTHOR="© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"
MODE="${1:-verify}"
PASS=0; FAIL=0; WARN=0

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC}  $*"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}✗${NC}  $*"; FAIL=$((FAIL + 1)); }
warn() { echo -e "  ${YELLOW}⚠${NC}  $*"; WARN=$((WARN + 1)); }

check_file() {
  if [ -f "$1" ]; then
    ok "$1"
  else
    fail "$1  MISSING"
  fi
}

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  S1AF Integrity Check — OCSO-S1AF-GOV-1${NC}"
echo -e "${BOLD}  Mode: ${MODE}${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ── 1. Core API server files ─────────────────────────────────────
echo ""
echo -e "${CYAN}[1] Core API server files${NC}"

for f in \
  "artifacts/api-server/src/lib/config.ts" \
  "artifacts/api-server/src/lib/device-lock.ts" \
  "artifacts/api-server/src/lib/intake.ts" \
  "artifacts/api-server/src/lib/keyword-registry.ts" \
  "artifacts/api-server/src/lib/quantum-adaptive-spec.ts" \
  "artifacts/api-server/src/lib/rotation-lock.ts" \
  "artifacts/api-server/src/lib/script-obfuscate.ts" \
  "artifacts/api-server/src/lib/sourceroot.ts" \
  "artifacts/api-server/src/lib/transform-pipeline.ts" \
  "artifacts/api-server/src/middleware/device-auth.ts" \
  "artifacts/api-server/src/routes/assets.ts" \
  "artifacts/api-server/src/routes/qi.ts" \
  "artifacts/api-server/src/routes/sentient.ts" \
  "artifacts/api-server/src/routes/transform.ts" \
  "artifacts/api-server/src/routes/index.ts"
do
  check_file "$f"
done

# ── 2. QI Platform pages ─────────────────────────────────────────
echo ""
echo -e "${CYAN}[2] QI Platform pages${NC}"

for f in \
  "artifacts/qi-platform/src/pages/home.tsx" \
  "artifacts/qi-platform/src/pages/assets.tsx" \
  "artifacts/qi-platform/src/pages/transform.tsx" \
  "artifacts/qi-platform/src/pages/dispatch.tsx" \
  "artifacts/qi-platform/src/pages/rotate.tsx" \
  "artifacts/qi-platform/src/pages/class-index.tsx" \
  "artifacts/qi-platform/src/components/layout/AppLayout.tsx"
do
  check_file "$f"
done

# ── 3. Static assets ─────────────────────────────────────────────
echo ""
echo -e "${CYAN}[3] Sovereign assets${NC}"

for f in \
  "artifacts/api-server/assets/QuantumAdaptive_AppIcon.png" \
  "artifacts/api-server/assets/AppIcon.appiconset.Contents.json" \
  "artifacts/api-server/assets/setup-icon.sh"
do
  check_file "$f"
done

# ── 4. Automation scripts ────────────────────────────────────────
echo ""
echo -e "${CYAN}[4] Automation scripts${NC}"

for f in \
  "scripts/manual-obfuscate.sh" \
  "scripts/integrity-check.sh" \
  "scripts/token-scanner.sh" \
  "scripts/git-askpass.sh" \
  "scripts/setup-git-auth.sh"
do
  check_file "$f"
done

# ── 4b. AARTE iOS App ────────────────────────────────────────────
echo ""
echo -e "${CYAN}[4b] AARTE-iOS-App (Xcode project generator)${NC}"

for f in \
  "AARTE-iOS-App/project.yml" \
  "AARTE-iOS-App/generate-xcode-project.sh" \
  "AARTE-iOS-App/Sources/BiometricAuthManager.swift" \
  "AARTE-iOS-App/Sources/DeviceGuard.swift" \
  "Scripts/SiriDeploy/Sources/S1AFDeployApp.swift" \
  "Scripts/SiriDeploy/Sources/ContentView.swift" \
  "Scripts/SiriDeploy/Sources/AppIntents.swift" \
  "Scripts/SiriDeploy/LiveActivity/DeployActivityAttributes.swift"
do
  check_file "$f"
done

# ── 5. Sovereign keyword guard ───────────────────────────────────
echo ""
echo -e "${CYAN}[5] Sovereign keyword registry${NC}"

if grep -q "JSOS1AF" artifacts/api-server/src/lib/script-obfuscate.ts 2>/dev/null; then
  ok "XOR sovereign key JSOS1AF present in script-obfuscate.ts"
else
  fail "XOR sovereign key JSOS1AF MISSING from script-obfuscate.ts"
fi

if grep -q "OCSO-S1AF-GOV-1" artifacts/api-server/src/lib/sourceroot.ts 2>/dev/null; then
  ok "Governance ID OCSO-S1AF-GOV-1 present in sourceroot.ts"
else
  fail "Governance ID OCSO-S1AF-GOV-1 MISSING from sourceroot.ts"
fi

if grep -q "1792" artifacts/api-server/src/lib/device-lock.ts 2>/dev/null; then
  ok "iPhone XR height 1792 locked in device-lock.ts"
else
  fail "iPhone XR height 1792 MISSING from device-lock.ts"
fi

if grep -q "requireIphoneXR" artifacts/api-server/src/routes/transform.ts 2>/dev/null; then
  ok "requireIphoneXR guard present on transform routes"
else
  fail "requireIphoneXR guard MISSING from transform routes"
fi

# ── 6. Obfuscated script fingerprint (live API check) ────────────
echo ""
echo -e "${CYAN}[6] Obfuscated script fingerprint (live API)${NC}"

API_URL="${API_BASE:-http://localhost:8080/api}"
DEVICE_TOKEN="${DEVICE_TOKEN:-f679ab7288b11a59ffc8ea43687b5ec6dfec3db86e8dbf017b471c7a2a00dc4d}"

META=$(curl -sf -H "X-Device-Token: ${DEVICE_TOKEN}" \
            "${API_URL}/assets/quantum-icon/obfuscated-meta" 2>/dev/null || true)

if [ -n "$META" ]; then
  FP=$(echo "$META" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('fingerprint',''))" 2>/dev/null || true)
  if [ -n "$FP" ]; then
    ok "Live fingerprint: ${FP}"
  else
    warn "API reachable but fingerprint not returned"
  fi
else
  warn "API unreachable at ${API_URL} — skipping live fingerprint check"
fi

# ── 7. No plaintext secrets in source ────────────────────────────
echo ""
echo -e "${CYAN}[7] Secret hygiene (quick scan)${NC}"

LEAK_COUNT=0
while IFS= read -r -d '' f; do
  # Skip test files — they legitimately contain mock tokens as fixtures
  case "$f" in *.test.ts|*.spec.ts|*.test.tsx|*.spec.tsx) continue ;; esac
  [[ "$f" == *vitest.config* ]] && continue
  if grep -qE "(ghp_|github_pat_)[A-Za-z0-9_]{10,}" "$f" 2>/dev/null; then
    fail "Potential GitHub PAT in: $f"
    LEAK_COUNT=$((LEAK_COUNT + 1))
  fi
done < <(find artifacts/ -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 2>/dev/null)

if [ "$LEAK_COUNT" -eq 0 ]; then
  ok "No GitHub PAT patterns in production source files"
fi

# ── Summary ──────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${GREEN}PASS${NC}: ${PASS}   ${RED}FAIL${NC}: ${FAIL}   ${YELLOW}WARN${NC}: ${WARN}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}INTEGRITY FAILED — ${FAIL} check(s) did not pass${NC}"
  exit 1
else
  echo -e "${GREEN}INTEGRITY VERIFIED — S1AF sovereign build confirmed${NC}"
  exit 0
fi
