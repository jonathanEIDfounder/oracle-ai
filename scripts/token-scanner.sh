#!/usr/bin/env bash
# ================================================================
# S1AF Token Scanner — OCSO-S1AF-GOV-1
# © 2026 Jonathan Sherman — All rights reserved.
#
# Scans the workspace for hardcoded credentials, API keys,
# tokens, and secrets that must never be committed to git.
#
# Usage:
#   bash scripts/token-scanner.sh             # scan, always exit 0
#   bash scripts/token-scanner.sh --strict    # exit 1 if any leaks
# ================================================================
set -uo pipefail   # no -e so manual counters don't exit early

readonly _S1AF_AUTHOR="© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"
STRICT=0
[[ "${1:-}" == "--strict" ]] && STRICT=1

LEAK=0; WARN_COUNT=0; SCAN_COUNT=0

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

leak() { echo -e "  ${RED}LEAK${NC}  [$1:$2]  $3"; LEAK=$((LEAK + 1)); }
warn() { echo -e "  ${YELLOW}WARN${NC}  $*"; WARN_COUNT=$((WARN_COUNT + 1)); }
ok()   { echo -e "  ${GREEN}OK${NC}    $*"; }

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  S1AF Token Scanner — OCSO-S1AF-GOV-1${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}Scanning workspace for credential leaks…${NC}"
echo ""

# ── Skip dirs ────────────────────────────────────────────────────
SKIP="-not -path */node_modules/* -not -path */.git/* -not -path */dist/* -not -path */.local/*"

# ── Pattern scan function ─────────────────────────────────────────
scan_pattern() {
  local label="$1" pattern="$2"
  while IFS= read -r -d '' file; do
    SCAN_COUNT=$((SCAN_COUNT + 1))
    while IFS=: read -r lineno content; do
      # Skip lines that are clearly safe references
      if echo "$content" | grep -qE \
        "(DEVICE_TOKEN|ENROLLED_TOKEN|SOVEREIGN_KEY|example|sample|placeholder|process\.env|getSecret|secretsManager|# |//)" 2>/dev/null; then
        continue
      fi
      leak "$file" "$lineno" "$label"
    done < <(grep -nE "$pattern" "$file" 2>/dev/null || true)
  done < <(eval "find . -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.sh' -o -name '*.yaml' -o -name '*.yml' \) $SKIP -print0" 2>/dev/null)
}

# ── Run pattern scans ─────────────────────────────────────────────
echo -e "${CYAN}[1] GitHub PAT patterns${NC}"
scan_pattern "GitHub Classic PAT"       "ghp_[A-Za-z0-9]{36}"
scan_pattern "GitHub Fine-grained PAT"  "github_pat_[A-Za-z0-9_]{60,}"
[ "$LEAK" -eq 0 ] && ok "No GitHub PAT patterns found"

echo ""
echo -e "${CYAN}[2] API key patterns${NC}"
PREV=$LEAK
scan_pattern "Generic sk- key"   "sk-[A-Za-z0-9]{32,}"
scan_pattern "AWS Access Key"    "AKIA[0-9A-Z]{16}"
[ "$LEAK" -eq "$PREV" ] && ok "No API key patterns found"

echo ""
echo -e "${CYAN}[3] Private key material${NC}"
PREV=$LEAK
while IFS= read -r -d '' file; do
  if grep -qE "\-\-\-\-\-BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY\-\-\-\-\-" "$file" 2>/dev/null; then
    leak "$file" "?" "Private key PEM block"
  fi
done < <(eval "find . -type f $SKIP -print0" 2>/dev/null)
[ "$LEAK" -eq "$PREV" ] && ok "No private key material found"

echo ""
echo -e "${CYAN}[4] .gitignore coverage${NC}"

while IFS= read -r -d '' envfile; do
  if git check-ignore -q "$envfile" 2>/dev/null; then
    ok ".env ignored: $envfile"
  else
    warn ".env file not gitignored: $envfile"
  fi
done < <(find . -name ".env*" -not -path "*/node_modules/*" -not -path "*/.git/*" -print0 2>/dev/null)

if git check-ignore -q "dist/setup-icon-obf.sh" 2>/dev/null; then
  ok "dist/setup-icon-obf.sh is gitignored"
else
  warn "dist/setup-icon-obf.sh is NOT gitignored"
fi

# ── Summary ──────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Files scanned : ${SCAN_COUNT}"
echo -e "  Leaks found   : ${RED}${LEAK}${NC}"
echo -e "  Warnings      : ${YELLOW}${WARN_COUNT}${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$LEAK" -gt 0 ]; then
  echo -e "${RED}TOKEN SCAN FAILED — ${LEAK} credential leak(s) detected${NC}"
  if [ "$STRICT" -eq 1 ]; then exit 1; fi
else
  echo -e "${GREEN}TOKEN SCAN PASSED — No credential leaks detected${NC}"
fi

exit 0
