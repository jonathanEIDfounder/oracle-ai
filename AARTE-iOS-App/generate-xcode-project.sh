#!/usr/bin/env bash
# =============================================================
# generate-xcode-project.sh
# Author: Jonathan Sherman
# Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
# Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
# =============================================================
# Generates Oracle-AI.xcodeproj from AARTE-iOS-App/project.yml
# using XcodeGen. Run from the repo root or from any subdirectory.
#
# Usage:
#   bash AARTE-iOS-App/generate-xcode-project.sh
#
# Prerequisites: macOS + Xcode Command Line Tools
# XcodeGen will be installed via Homebrew if not present.
# =============================================================
set -euo pipefail

BOLD='\033[1m'; GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPEC="${REPO_ROOT}/AARTE-iOS-App/project.yml"
OUTPUT="${REPO_ROOT}/Oracle-AI.xcodeproj"

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  S1AF Oracle-AI — Xcode Project Generator${NC}"
echo -e "${BOLD}  OCSO-S1AF-GOV-1 · Jonathan Sherman${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── 1. Verify spec exists ───────────────────────────────────────
if [ ! -f "${SPEC}" ]; then
  echo -e "${RED}✗  project.yml not found at: ${SPEC}${NC}" >&2
  exit 1
fi
echo -e "  ${GREEN}✓${NC}  Spec     : ${SPEC}"

# ── 2. Ensure xcodegen is installed ────────────────────────────
if ! command -v xcodegen &>/dev/null; then
  echo ""
  echo -e "  ${CYAN}→  xcodegen not found — installing via Homebrew…${NC}"
  if ! command -v brew &>/dev/null; then
    echo -e "${RED}✗  Homebrew not found. Install it first: https://brew.sh${NC}" >&2
    exit 1
  fi
  brew install xcodegen
fi
XCODEGEN_VER=$(xcodegen version 2>/dev/null || echo "unknown")
echo -e "  ${GREEN}✓${NC}  xcodegen : ${XCODEGEN_VER}"

# ── 3. Run xcodegen ────────────────────────────────────────────
echo ""
echo -e "  ${CYAN}→  Generating Oracle-AI.xcodeproj …${NC}"
cd "${REPO_ROOT}"
xcodegen generate --spec "${SPEC}" --project "${REPO_ROOT}"

# ── 4. Verify output ───────────────────────────────────────────
if [ -d "${OUTPUT}" ]; then
  echo ""
  echo -e "  ${GREEN}✓${NC}  Generated: ${OUTPUT}"
else
  echo -e "${RED}✗  xcodeproj not created — check xcodegen output above${NC}" >&2
  exit 1
fi

# ── 5. Summary ─────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${GREEN}DONE — open with:${NC}"
echo -e "  ${BOLD}open Oracle-AI.xcodeproj${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
