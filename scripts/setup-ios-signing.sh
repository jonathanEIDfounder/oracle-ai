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

if command -v gh &> /dev/null && gh auth status &> /dev/null; then
    echo "Using GitHub CLI for authentication..."
    USE_GH_CLI=true
else
    USE_GH_CLI=false
    if [[ -z "$GITHUB_TOKEN" ]]; then
        echo "Enter your GitHub Personal Access Token"
        echo "(Token is read securely and not displayed)"
        read -s -p "Token: " GITHUB_TOKEN
        echo ""
    fi
    
    if [[ -z "$GITHUB_TOKEN" ]]; then
        echo "Error: GitHub token is required"
        echo "Set GITHUB_TOKEN environment variable or install gh CLI"
        exit 1
    fi
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
echo ""

TEMP_DIR=$(mktemp -d)
P12_PATH="$TEMP_DIR/certificate.p12"
trap "rm -rf $TEMP_DIR" EXIT

echo "Exporting certificate (you may be prompted for Keychain password)..."
security export -k ~/Library/Keychains/login.keychain-db -t identities -f pkcs12 -o "$P12_PATH" -P "$CERT_PASSWORD" 2>/dev/null || \
security export -k login.keychain -t identities -f pkcs12 -o "$P12_PATH" -P "$CERT_PASSWORD" 2>/dev/null || true

if [[ ! -f "$P12_PATH" ]] || [[ ! -s "$P12_PATH" ]]; then
    echo ""
    echo "Automated export requires manual approval. Please:"
    echo "1. Open Keychain Access"
    echo "2. Find: $CERT_NAME"
    echo "3. Right-click → Export → Save to: $P12_PATH"
    echo "4. Use password: $CERT_PASSWORD"
    echo ""
    read -p "Press Enter after export..."
fi

if [[ ! -f "$P12_PATH" ]] || [[ ! -s "$P12_PATH" ]]; then
    echo "Error: Certificate file not found"
    exit 1
fi

echo "Encoding certificate..."
CERT_BASE64=$(base64 -i "$P12_PATH")

upload_secret() {
    local name="$1"
    local value="$2"
    
    if [[ "$USE_GH_CLI" == "true" ]]; then
        echo "$value" | gh secret set "$name" -R "$REPO"
    else
        KEY_RESPONSE=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github+json" \
            "https://api.github.com/repos/$REPO/actions/secrets/public-key")
        
        PUBLIC_KEY=$(echo "$KEY_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('key',''))" 2>/dev/null)
        KEY_ID=$(echo "$KEY_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('key_id',''))" 2>/dev/null)
        
        if [[ -z "$PUBLIC_KEY" ]]; then
            echo "Error: Could not get repository public key"
            exit 1
        fi
        
        pip3 install pynacl -q 2>/dev/null || true
        
        ENCRYPTED=$(python3 -c "
import base64
from nacl import encoding, public
pk = base64.b64decode('$PUBLIC_KEY')
box = public.SealedBox(public.PublicKey(pk))
enc = box.encrypt('''$value'''.encode())
print(base64.b64encode(enc).decode())
")
        
        curl -s -X PUT \
            -H "Authorization: Bearer $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github+json" \
            "https://api.github.com/repos/$REPO/actions/secrets/$name" \
            -d "{\"encrypted_value\":\"$ENCRYPTED\",\"key_id\":\"$KEY_ID\"}" > /dev/null
    fi
}

echo "Uploading APPLE_CERTIFICATE_BASE64..."
upload_secret "APPLE_CERTIFICATE_BASE64" "$CERT_BASE64"

echo "Uploading APPLE_CERTIFICATE_PASSWORD..."
upload_secret "APPLE_CERTIFICATE_PASSWORD" "$CERT_PASSWORD"

echo ""
echo "=== Setup Complete ==="
echo "Triggering iOS build..."

if [[ "$USE_GH_CLI" == "true" ]]; then
    gh workflow run ios-build.yml -R "$REPO"
else
    curl -s -X POST \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github+json" \
        "https://api.github.com/repos/$REPO/actions/workflows/ios-build.yml/dispatches" \
        -d '{"ref":"main"}' > /dev/null
fi

echo "Done! Monitor build: https://github.com/$REPO/actions"
