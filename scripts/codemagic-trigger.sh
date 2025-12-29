#!/bin/bash
set -e

echo "═══════════════════════════════════════════════════════════"
echo "  Oracle AI - Codemagic Build Trigger"
echo "═══════════════════════════════════════════════════════════"

if [ -z "$CM_API_TOKEN" ]; then
    echo ""
    echo "Codemagic API token required."
    echo ""
    echo "Get your token:"
    echo "  1. Go to codemagic.io → Settings → Integrations"
    echo "  2. Generate API token"
    echo "  3. Set: export CM_API_TOKEN=your_token"
    echo "  4. Set: export CM_APP_ID=your_app_id"
    echo ""
    exit 1
fi

if [ -z "$CM_APP_ID" ]; then
    echo "CM_APP_ID required. Find it in Codemagic app settings."
    exit 1
fi

echo "Triggering build..."

curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "x-auth-token: $CM_API_TOKEN" \
    -d '{
        "appId": "'"$CM_APP_ID"'",
        "workflowId": "ios-release",
        "branch": "main"
    }' \
    https://api.codemagic.io/builds

echo ""
echo "✓ Build triggered on Codemagic"
echo "  View at: https://codemagic.io/app/$CM_APP_ID"
