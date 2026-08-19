#!/bin/sh
# =============================================================
# ci_post_xcodebuild.sh — Xcode Cloud post-build / TestFlight
# Author: Jonathan Sherman
# Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
# Framework: S1AF v1.0.0-JS · Xcode Cloud CI
# Sovereign ID: 1 · OCSO-S1AF-GOV-1
# =============================================================
# Runs inside Xcode Cloud AFTER xcodebuild completes.
# On archive actions for main / release branches:
#   • Notarises and uploads the IPA to TestFlight automatically
#   • Notifies the oracle-ai server that a new build is staged
#   • Tags the git commit with the build number
# =============================================================

set -euo pipefail
echo "=== S1AF Xcode Cloud Post-Build ==="
echo "Sovereign ID : 1 — OCSO-S1AF-GOV-1"
echo "Action       : ${CI_XCODEBUILD_ACTION:-unknown}"
echo "Result       : ${CI_XCODEBUILD_EXIT_CODE:-unknown}"
echo ""

# ── Abort on build failure ────────────────────────────────────
if [ "${CI_XCODEBUILD_EXIT_CODE:-1}" != "0" ]; then
  echo "✗ xcodebuild failed — skipping post-build steps"
  exit 0  # Exit 0 to not mask the build failure with a script error
fi

# ── Only act on archive builds ────────────────────────────────
if [ "${CI_XCODEBUILD_ACTION:-}" != "archive" ]; then
  echo "ℹ Action is '${CI_XCODEBUILD_ACTION:-}' — no post-build upload needed"
  exit 0
fi

# ── Only deploy from sovereign branches ───────────────────────
case "${CI_BRANCH:-unknown}" in
  main|release/*)
    DEPLOY_ENV="production" ;;
  hotfix/*)
    DEPLOY_ENV="hotfix" ;;
  *)
    echo "ℹ Branch '${CI_BRANCH:-unknown}' is not a deploy branch — skipping upload"
    exit 0 ;;
esac

echo "--- TestFlight upload (env: $DEPLOY_ENV)"

# ── TestFlight upload via altool ──────────────────────────────
# Xcode Cloud handles signing and uploading automatically when the
# workflow is configured with a TestFlight destination.
# The script below is used when running in a custom workflow
# that doesn't use Xcode Cloud's built-in TestFlight step.
#
# Set CI_APPSTORECONNECT_KEY_ID, CI_APPSTORECONNECT_ISSUER_ID,
# and CI_APPSTORECONNECT_KEY_P8_PATH as Xcode Cloud environment
# variables (marked as secret) to enable this path.

if [ -n "${CI_APPSTORECONNECT_KEY_ID:-}" ] && \
   [ -n "${CI_APPSTORECONNECT_ISSUER_ID:-}" ] && \
   [ -n "${CI_APPSTORECONNECT_KEY_P8_PATH:-}" ]; then

  echo "✓ App Store Connect credentials present — uploading to TestFlight"

  # Find the exported IPA
  IPA_PATH=$(find "${CI_ARCHIVE_PATH:-/tmp}" -name "*.ipa" 2>/dev/null | head -1)
  if [ -z "$IPA_PATH" ]; then
    echo "⚠ No IPA found in CI_ARCHIVE_PATH — Xcode Cloud may handle upload natively"
  else
    xcrun altool \
      --upload-app \
      --type ios \
      --file "$IPA_PATH" \
      --apiKey  "$CI_APPSTORECONNECT_KEY_ID" \
      --apiIssuer "$CI_APPSTORECONNECT_ISSUER_ID" \
      --show-progress
    echo "✓ IPA uploaded to TestFlight: $IPA_PATH"
  fi
else
  echo "ℹ App Store Connect API keys not set — relying on Xcode Cloud native upload"
fi

# ── Notify oracle-ai server ───────────────────────────────────
echo ""
echo "--- Notifying oracle-ai server"

SERVER_URL="${ORACLE_AI_SERVER_URL:-}"
DEPLOY_SECRET="${ORACLE_AI_DEPLOY_SECRET:-}"

if [ -n "$SERVER_URL" ] && [ -n "$DEPLOY_SECRET" ]; then
  BUILD="${CI_BUILD_NUMBER:-0}"
  COMMIT="${CI_COMMIT_HASH:-unknown}"
  BRANCH="${CI_BRANCH:-unknown}"

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$SERVER_URL/api/deploy/trigger" \
    -H "Content-Type: application/json" \
    -H "x-deploy-token: $DEPLOY_SECRET" \
    -d "{\"source\":\"xcode-cloud\",\"build\":\"$BUILD\",\"commit\":\"$COMMIT\",\"branch\":\"$BRANCH\",\"sovereignID\":1}")

  if echo "$HTTP_CODE" | grep -q "^2"; then
    echo "✓ oracle-ai server notified (HTTP $HTTP_CODE)"
  else
    echo "⚠ oracle-ai notification returned HTTP $HTTP_CODE — non-fatal"
  fi
else
  echo "ℹ ORACLE_AI_SERVER_URL or ORACLE_AI_DEPLOY_SECRET not set — skipping server notification"
fi

# ── Git tag ───────────────────────────────────────────────────
echo ""
echo "--- Tagging commit"
BUILD="${CI_BUILD_NUMBER:-0}"
SHORT_SHA=$(echo "${CI_COMMIT_HASH:-00000000}" | cut -c1-8)
TAG="build/${BUILD}-${SHORT_SHA}"

if git tag "$TAG" 2>/dev/null; then
  git push origin "$TAG" 2>/dev/null \
    && echo "✓ Tagged commit as $TAG" \
    || echo "⚠ Tag created locally but push failed (may need remote credentials)"
else
  echo "ℹ Tag $TAG already exists — skipping"
fi

echo ""
echo "=== Post-build complete — sovereign build $BUILD staged to TestFlight ==="
