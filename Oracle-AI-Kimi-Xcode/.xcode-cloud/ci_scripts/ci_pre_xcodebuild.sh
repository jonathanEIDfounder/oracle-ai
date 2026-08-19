#!/bin/sh
# =============================================================
# ci_pre_xcodebuild.sh — Xcode Cloud pre-build
# Author: Jonathan Sherman
# Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
# Framework: S1AF v1.0.0-JS · Xcode Cloud CI
# Sovereign ID: 1 · OCSO-S1AF-GOV-1
# =============================================================
# Runs inside Xcode Cloud BEFORE xcodebuild.
# Xcode Cloud environment variables available here:
#   CI_XCODEBUILD_ACTION  — build / test / archive / analyze
#   CI_PRODUCT            — product name
#   CI_COMMIT_HASH        — git SHA
#   CI_BRANCH             — branch name
#   CI_BUILD_NUMBER       — monotonically increasing build number
#   CI_WORKFLOW           — workflow name
# =============================================================

set -euo pipefail
echo "=== S1AF Xcode Cloud Pre-Build ==="
echo "Sovereign ID : 1 — OCSO-S1AF-GOV-1"
echo "Product      : ${CI_PRODUCT:-unknown}"
echo "Branch       : ${CI_BRANCH:-unknown}"
echo "Build number : ${CI_BUILD_NUMBER:-0}"
echo "Commit       : ${CI_COMMIT_HASH:-unknown}"
echo "Action       : ${CI_XCODEBUILD_ACTION:-unknown}"
echo ""

# ── 1. Validate sovereign build environment ──────────────────
echo "--- Step 1: Validate sovereign environment"

# Ensure this is the correct repository
EXPECTED_REPO="oracle-ai"
if [ -n "${CI_PRODUCT:-}" ] && echo "$CI_PRODUCT" | grep -qi "oracle"; then
  echo "✓ Product name matches Oracle-AI sovereign app"
else
  echo "⚠ Warning: unexpected product name (${CI_PRODUCT:-unset})"
fi

# Confirm we're on main or a release branch
case "${CI_BRANCH:-unknown}" in
  main|release/*|hotfix/*)
    echo "✓ Branch '${CI_BRANCH}' is a sovereign deployment branch" ;;
  *)
    echo "ℹ Branch '${CI_BRANCH}' — non-production build, skipping deployment gate" ;;
esac

# ── 2. Inject build metadata into Info.plist ─────────────────
echo ""
echo "--- Step 2: Inject build metadata"

INFO_PLIST="AARTE-iOS-App/Info.plist"
if [ -f "$INFO_PLIST" ]; then
  # Stamp commit hash into CFBundleVersion for traceability
  SHORT_SHA=$(echo "${CI_COMMIT_HASH:-00000000}" | cut -c1-8)
  BUILD_NUM="${CI_BUILD_NUMBER:-1}"
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion ${BUILD_NUM}" "$INFO_PLIST" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :CFBundleVersion string ${BUILD_NUM}" "$INFO_PLIST"
  echo "✓ CFBundleVersion set to ${BUILD_NUM} (commit: ${SHORT_SHA})"
else
  echo "⚠ Info.plist not found at $INFO_PLIST — skipping metadata injection"
fi

# ── 3. Resolve Swift package dependencies ────────────────────
echo ""
echo "--- Step 3: Resolve dependencies"
if [ -f "Package.swift" ]; then
  swift package resolve
  echo "✓ Swift packages resolved"
fi

# ── 4. Verify Metal shaders exist ────────────────────────────
echo ""
echo "--- Step 4: Verify Metal shader sources"
SHADER_PATH="AARTE-iOS-App/Shaders/CelestialShader.metal"
if [ -f "$SHADER_PATH" ]; then
  echo "✓ CelestialShader.metal present"
else
  echo "✗ ERROR: CelestialShader.metal not found at $SHADER_PATH"
  exit 1
fi

# ── 5. Verify sovereign Swift sources ────────────────────────
echo ""
echo "--- Step 5: Verify sovereign Swift sources"
REQUIRED_SOURCES="
  AARTE-iOS-App/Sources/DeviceGuard.swift
  AARTE-iOS-App/Sources/BiometricAuthManager.swift
  AARTE-iOS-App/Sources/CelestialCore.swift
  AARTE-iOS-App/Sources/MetalInference.swift
  AARTE-iOS-App/Sources/AppleIntelligenceLayer.swift
  AARTE-iOS-App/Sources/SovereignAppIntents.swift
  AARTE-iOS-App/Sources/CloudKitSync.swift
"
MISSING=0
for SRC in $REQUIRED_SOURCES; do
  SRC=$(echo "$SRC" | tr -d ' ')
  if [ -f "$SRC" ]; then
    echo "✓ $SRC"
  else
    echo "✗ MISSING: $SRC"
    MISSING=$((MISSING + 1))
  fi
done

if [ "$MISSING" -gt 0 ]; then
  echo ""
  echo "✗ ERROR: $MISSING sovereign source file(s) missing — aborting build"
  exit 1
fi

echo ""
echo "=== Pre-build complete — sovereign environment validated ==="
