#!/bin/bash
set -e

echo "═══════════════════════════════════════════════════════════"
echo "  Oracle AI - Full Automated Deployment"
echo "═══════════════════════════════════════════════════════════"

VERSION=${1:-"1.0.0"}

echo "[1/4] Syncing iOS..."
npx cap sync ios
echo "✓ iOS synced"

echo ""
echo "[2/4] Checking GitHub..."
if [ -n "$GITHUB_TOKEN" ] && [ -n "$GITHUB_REPO" ]; then
    git add -A
    git commit -m "Release v$VERSION" 2>/dev/null || echo "Nothing to commit"
    git remote set-url origin "https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git" 2>/dev/null || true
    git push origin main --force 2>/dev/null && echo "✓ Pushed to GitHub" || echo "✗ Push failed - check token"
else
    echo "⚠ Set GITHUB_TOKEN and GITHUB_REPO for auto-push"
fi

echo ""
echo "[3/4] Triggering Codemagic..."
if [ -n "$CM_API_TOKEN" ] && [ -n "$CM_APP_ID" ]; then
    RESPONSE=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "x-auth-token: $CM_API_TOKEN" \
        -d '{"appId":"'"$CM_APP_ID"'","workflowId":"ios-release","branch":"main"}' \
        https://api.codemagic.io/builds)
    echo "✓ Build triggered"
    echo "  Response: $RESPONSE"
else
    echo "⚠ Set CM_API_TOKEN and CM_APP_ID for auto-build"
fi

echo ""
echo "[4/4] Complete"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Required tokens (set in Replit Secrets):"
echo "  GITHUB_TOKEN   - Personal access token from GitHub"
echo "  GITHUB_REPO    - username/repo-name"
echo "  CM_API_TOKEN   - From codemagic.io/settings"
echo "  CM_APP_ID      - From your Codemagic app"
echo "═══════════════════════════════════════════════════════════"
