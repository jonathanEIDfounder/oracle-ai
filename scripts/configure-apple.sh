#!/bin/bash
set -e

if [ "$#" -ne 3 ]; then
    echo "Usage: ./scripts/configure-apple.sh <key_id> <issuer_id> <p8_file_path>"
    echo "Example: ./scripts/configure-apple.sh ABC123XYZ 12345678-1234-1234-1234-123456789012 ~/Downloads/AuthKey_ABC123XYZ.p8"
    exit 1
fi

KEY_ID=$1
ISSUER_ID=$2
P8_FILE=$3

echo "═══════════════════════════════════════════════════════════"
echo "  Oracle AI - Configure Apple Credentials"
echo "═══════════════════════════════════════════════════════════"

if [ ! -f "$P8_FILE" ]; then
    echo "Error: .p8 file not found at $P8_FILE"
    exit 1
fi

KEY_CONTENT=$(cat "$P8_FILE")

echo ""
echo "Key ID: $KEY_ID"
echo "Issuer ID: $ISSUER_ID"
echo "Key File: $P8_FILE"
echo ""

if [ -z "$CM_API_TOKEN" ] || [ -z "$CM_APP_ID" ]; then
    echo "Codemagic credentials not set. Outputting for manual entry:"
    echo ""
    echo "Add these to Codemagic (Settings → Environment Variables → app_store_credentials):"
    echo ""
    echo "APP_STORE_CONNECT_KEY_IDENTIFIER = $KEY_ID"
    echo "APP_STORE_CONNECT_ISSUER_ID = $ISSUER_ID"
    echo "APP_STORE_CONNECT_PRIVATE_KEY = (paste .p8 content)"
    echo ""
    exit 0
fi

echo "Configuring Codemagic via API..."

curl -s -X POST "https://api.codemagic.io/apps/$CM_APP_ID/variables" \
  -H "Content-Type: application/json" \
  -H "x-auth-token: $CM_API_TOKEN" \
  -d "{\"key\":\"APP_STORE_CONNECT_KEY_IDENTIFIER\",\"value\":\"$KEY_ID\",\"group\":\"app_store_credentials\",\"secure\":true}"

curl -s -X POST "https://api.codemagic.io/apps/$CM_APP_ID/variables" \
  -H "Content-Type: application/json" \
  -H "x-auth-token: $CM_API_TOKEN" \
  -d "{\"key\":\"APP_STORE_CONNECT_ISSUER_ID\",\"value\":\"$ISSUER_ID\",\"group\":\"app_store_credentials\",\"secure\":true}"

curl -s -X POST "https://api.codemagic.io/apps/$CM_APP_ID/variables" \
  -H "Content-Type: application/json" \
  -H "x-auth-token: $CM_API_TOKEN" \
  -d "{\"key\":\"APP_STORE_CONNECT_PRIVATE_KEY\",\"value\":\"$KEY_CONTENT\",\"group\":\"app_store_credentials\",\"secure\":true}"

echo ""
echo "✓ Apple credentials configured in Codemagic"
echo "✓ Builds will now auto-publish to TestFlight"
echo ""
echo "Trigger build: ./scripts/codemagic-trigger.sh"
