#!/bin/bash
set -e

echo "═══════════════════════════════════════════════════════════"
echo "  Oracle AI - Release Preparation"
echo "═══════════════════════════════════════════════════════════"

VERSION=${1:-"1.0.0"}
echo "Version: $VERSION"

npx cap sync ios
echo "✓ iOS synced"

if [ -n "$GITHUB_TOKEN" ]; then
    echo ""
    echo "GitHub token detected - pushing..."
    git add -A
    git commit -m "Release v$VERSION" || true
    git tag -f "v$VERSION"
    git remote set-url origin "https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git" 2>/dev/null || true
    git push origin main --tags --force
    echo "✓ Pushed to GitHub"
else
    echo ""
    echo "Set GITHUB_TOKEN and GITHUB_REPO to auto-push:"
    echo "  export GITHUB_TOKEN=ghp_xxxx"
    echo "  export GITHUB_REPO=username/oracle-ai"
fi

echo ""
echo "✓ Release prep complete"
