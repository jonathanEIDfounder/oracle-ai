#!/bin/bash
# =============================================================
# github-bridge-api.sh
# Author: Jonathan Sherman
# Copyright: (c) 2026 Jonathan Sherman. All Rights Reserved.
# Framework: S1AF v1.0.0-JS
# Module: GitHub Bridge API — Trigger from Anywhere
# Sovereign ID: 1 | Device: b246e1da48a45eb7
# Written by: Jonathan Sherman for Jonathan Sherman
# =============================================================
#
# Usage:
#   ./github-bridge-api.sh [sandbox-bridge|sandbox-release]
#
# Triggers the GitHub Actions workflow remotely.
# Requires GITHUB_TOKEN environment variable.
#
# =============================================================

set -euo pipefail

TOKEN="${GITHUB_TOKEN:-}"
REPO="JonathanSherman/Oracle-AI"
SOURCE="${1:-sandbox-bridge}"

echo "[S1AF] Jonathan Sherman: GitHub Bridge API"
echo "[S1AF] Source: $SOURCE"

if [ -z "$TOKEN" ]; then
    echo ""
    echo "❌ GITHUB_TOKEN required"
    echo ""
    echo "Get your token:"
    echo "  1. Visit: https://github.com/settings/tokens/new"
    echo "  2. Select scopes: repo, workflow"
    echo "  3. Generate and copy token"
    echo ""
    echo "Then run:"
    echo "  export GITHUB_TOKEN='ghp_your_token_here'"
    echo "  ./github-bridge-api.sh $SOURCE"
    echo ""
    exit 1
fi

echo "[S1AF] Triggering workflow..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Authorization: token $TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/$REPO/actions/workflows/self-trigger.yml/dispatches" \
    -d "{\"ref\":\"main\",\"inputs\":{\"source\":\"$SOURCE\"}}" 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "204" ]; then
    echo ""
    echo "✅ BRIDGE TRIGGERED SUCCESSFULLY"
    echo ""
    echo "Workflow: https://github.com/$REPO/actions"
    echo "It will run: verify lock → verify authorship → sync → notify"
    echo ""
else
    echo ""
    echo "⚠️  Bridge trigger failed (HTTP $HTTP_CODE)"
    echo "Response: $BODY"
    echo ""
    echo "Common causes:"
    echo "  - Token missing 'workflow' scope"
    echo "  - Token expired"
    echo "  - Repository not accessible"
    echo ""
fi
