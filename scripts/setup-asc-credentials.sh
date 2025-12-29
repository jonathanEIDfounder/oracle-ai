#!/bin/bash
echo "═══════════════════════════════════════════════════════════"
echo "  Oracle AI - App Store Connect Credentials Setup"
echo "═══════════════════════════════════════════════════════════"

if [ -z "$CM_API_TOKEN" ] || [ -z "$CM_APP_ID" ]; then
    echo "Required: CM_API_TOKEN and CM_APP_ID"
    exit 1
fi

if [ -z "$ASC_KEY_ID" ] || [ -z "$ASC_ISSUER_ID" ] || [ -z "$ASC_KEY_CONTENT" ]; then
    echo "Required Apple credentials:"
    echo "  ASC_KEY_ID       - App Store Connect Key ID"
    echo "  ASC_ISSUER_ID    - App Store Connect Issuer ID"  
    echo "  ASC_KEY_CONTENT  - Content of .p8 file"
    exit 1
fi

echo "Adding credentials to Codemagic..."

curl -s -X POST "https://api.codemagic.io/apps/$CM_APP_ID/variables" \
  -H "Content-Type: application/json" \
  -H "x-auth-token: $CM_API_TOKEN" \
  -d "{\"key\":\"APP_STORE_CONNECT_KEY_IDENTIFIER\",\"value\":\"$ASC_KEY_ID\",\"group\":\"app_store_credentials\",\"secure\":true}"

curl -s -X POST "https://api.codemagic.io/apps/$CM_APP_ID/variables" \
  -H "Content-Type: application/json" \
  -H "x-auth-token: $CM_API_TOKEN" \
  -d "{\"key\":\"APP_STORE_CONNECT_ISSUER_ID\",\"value\":\"$ASC_ISSUER_ID\",\"group\":\"app_store_credentials\",\"secure\":true}"

curl -s -X POST "https://api.codemagic.io/apps/$CM_APP_ID/variables" \
  -H "Content-Type: application/json" \
  -H "x-auth-token: $CM_API_TOKEN" \
  -d "{\"key\":\"APP_STORE_CONNECT_PRIVATE_KEY\",\"value\":\"$ASC_KEY_CONTENT\",\"group\":\"app_store_credentials\",\"secure\":true}"

echo ""
echo "✓ Credentials added to app_store_credentials group"
echo "  Builds will now auto-publish to TestFlight"
