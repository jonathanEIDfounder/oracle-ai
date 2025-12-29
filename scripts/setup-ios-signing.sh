#!/bin/bash
set -e

REPO="jonathanEIDfounder/oracle-ai"
CERT_PASSWORD=$(openssl rand -base64 16)

echo "=== Oracle AI iOS Signing Setup ==="
echo ""

if [[ "$(uname)" != "Darwin" ]]; then
    echo "Error: This script must be run on macOS"
    exit 1
fi

read -p "Enter your GitHub Personal Access Token: " GITHUB_TOKEN
if [[ -z "$GITHUB_TOKEN" ]]; then
    echo "Error: GitHub token is required"
    exit 1
fi

echo ""
echo "Finding Apple Distribution certificates..."
IDENTITIES=$(security find-identity -v -p codesigning | grep "Apple Distribution" || true)

if [[ -z "$IDENTITIES" ]]; then
    echo "No Apple Distribution certificate found."
    echo "Please ensure you have a valid distribution certificate in Keychain Access."
    exit 1
fi

echo "$IDENTITIES"
echo ""

CERT_HASH=$(echo "$IDENTITIES" | head -1 | awk '{print $2}')
CERT_NAME=$(echo "$IDENTITIES" | head -1 | sed 's/.*"\(.*\)".*/\1/')

echo "Using certificate: $CERT_NAME"
echo "Hash: $CERT_HASH"
echo ""

TEMP_DIR=$(mktemp -d)
P12_PATH="$TEMP_DIR/certificate.p12"

echo "Exporting certificate..."
security export -k ~/Library/Keychains/login.keychain-db -t identities -f pkcs12 -o "$P12_PATH" -P "$CERT_PASSWORD" -T "" 2>/dev/null || \
security find-certificate -a -c "Apple Distribution" -p | openssl pkcs12 -export -out "$P12_PATH" -passout "pass:$CERT_PASSWORD" -nokeys 2>/dev/null || \
(echo "Trying alternative export method..." && \
 security export -k login.keychain -t identities -f pkcs12 -o "$P12_PATH" -P "$CERT_PASSWORD" 2>/dev/null)

if [[ ! -f "$P12_PATH" ]] || [[ ! -s "$P12_PATH" ]]; then
    echo ""
    echo "Automated export failed. Please export manually:"
    echo "1. Open Keychain Access"
    echo "2. Find certificate: $CERT_NAME"
    echo "3. Right-click → Export"
    echo "4. Save as: $P12_PATH"
    echo "5. Use password: $CERT_PASSWORD"
    echo ""
    read -p "Press Enter after manual export, or Ctrl+C to cancel..."
fi

if [[ ! -f "$P12_PATH" ]] || [[ ! -s "$P12_PATH" ]]; then
    echo "Error: Certificate file not found or empty"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo "Encoding certificate..."
CERT_BASE64=$(base64 -i "$P12_PATH")

echo "Getting GitHub repository public key..."
KEY_RESPONSE=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$REPO/actions/secrets/public-key")

PUBLIC_KEY=$(echo "$KEY_RESPONSE" | grep -o '"key":"[^"]*' | cut -d'"' -f4)
KEY_ID=$(echo "$KEY_RESPONSE" | grep -o '"key_id":"[^"]*' | cut -d'"' -f4)

if [[ -z "$PUBLIC_KEY" ]] || [[ -z "$KEY_ID" ]]; then
    echo "Error: Could not get repository public key"
    echo "Response: $KEY_RESPONSE"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo "Encrypting and uploading secrets..."

encrypt_secret() {
    local value="$1"
    python3 -c "
import base64
from nacl import encoding, public

public_key = '$PUBLIC_KEY'
secret_value = '''$value'''

public_key_bytes = base64.b64decode(public_key)
sealed_box = public.SealedBox(public.PublicKey(public_key_bytes))
encrypted = sealed_box.encrypt(secret_value.encode('utf-8'))
print(base64.b64encode(encrypted).decode('utf-8'))
"
}

pip3 install pynacl -q 2>/dev/null || pip install pynacl -q 2>/dev/null

ENCRYPTED_CERT=$(encrypt_secret "$CERT_BASE64")
ENCRYPTED_PASSWORD=$(encrypt_secret "$CERT_PASSWORD")

curl -s -X PUT \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$REPO/actions/secrets/APPLE_CERTIFICATE_BASE64" \
    -d "{\"encrypted_value\":\"$ENCRYPTED_CERT\",\"key_id\":\"$KEY_ID\"}" > /dev/null

curl -s -X PUT \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$REPO/actions/secrets/APPLE_CERTIFICATE_PASSWORD" \
    -d "{\"encrypted_value\":\"$ENCRYPTED_PASSWORD\",\"key_id\":\"$KEY_ID\"}" > /dev/null

rm -rf "$TEMP_DIR"

echo ""
echo "=== Setup Complete ==="
echo "Secrets uploaded to GitHub:"
echo "  - APPLE_CERTIFICATE_BASE64"
echo "  - APPLE_CERTIFICATE_PASSWORD"
echo ""
echo "Triggering new build..."

curl -s -X POST \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$REPO/actions/workflows/ios-build.yml/dispatches" \
    -d '{"ref":"main"}' > /dev/null

echo "Build triggered! Monitor at: https://github.com/$REPO/actions"
