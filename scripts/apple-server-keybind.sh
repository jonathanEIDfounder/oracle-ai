#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Q++RS ULTIMATE 5.0 - APPLE SERVER KEY BINDING
# ═══════════════════════════════════════════════════════════════════════════════
# Author: Jonathan Sherman
# Sovereign ID: 1
# Copyright (c) 2024-2025 Jonathan Sherman. All Rights Reserved.
# ═══════════════════════════════════════════════════════════════════════════════

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     Q++RS ULTIMATE 5.0 - APPLE SERVER KEY BINDING            ║"
echo "║     Author: Jonathan Sherman | Sovereign ID: 1               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

REPO="jonathanEIDfounder/oracle-ai"
KEY_DIR="$HOME/.appstoreconnect/private_keys"
AUTHKEY_PATTERN="AuthKey_*.p8"

find_authkey() {
    if [ -d "$KEY_DIR" ]; then
        KEY_FILE=$(find "$KEY_DIR" -name "$AUTHKEY_PATTERN" -type f 2>/dev/null | head -1)
        if [ -n "$KEY_FILE" ]; then
            echo "$KEY_FILE"
            return 0
        fi
    fi
    
    KEY_FILE=$(find "$HOME/Downloads" -name "$AUTHKEY_PATTERN" -type f 2>/dev/null | head -1)
    if [ -n "$KEY_FILE" ]; then
        echo "$KEY_FILE"
        return 0
    fi
    
    KEY_FILE=$(find "$HOME" -name "$AUTHKEY_PATTERN" -type f 2>/dev/null | head -1)
    if [ -n "$KEY_FILE" ]; then
        echo "$KEY_FILE"
        return 0
    fi
    
    return 1
}

echo "[Q++RS] Searching for App Store Connect API key..."

KEY_FILE=$(find_authkey)

if [ -z "$KEY_FILE" ]; then
    echo "[Q++RS] ERROR: No AuthKey_*.p8 file found"
    echo "[Q++RS] Please download from App Store Connect > Users and Access > Keys"
    exit 1
fi

echo "[Q++RS] Found: $KEY_FILE"

KEY_ID=$(basename "$KEY_FILE" .p8 | sed 's/AuthKey_//')
echo "[Q++RS] Key ID: $KEY_ID"

if ! openssl ec -in "$KEY_FILE" -noout 2>/dev/null; then
    echo "[Q++RS] ERROR: Invalid EC key format"
    exit 1
fi
echo "[Q++RS] ✓ Key validated (EC P-256)"

KEY_BASE64=$(base64 < "$KEY_FILE" | tr -d '\n')
echo "[Q++RS] ✓ Key encoded (base64)"

SERIAL_HASH=$(echo -n "$(system_profiler SPHardwareDataType 2>/dev/null | grep 'Serial Number' | awk '{print $NF}'):ORACLE_AI_SOVEREIGN" | openssl dgst -sha256 | cut -d' ' -f2)
echo "[Q++RS] Serial binding: ${SERIAL_HASH:0:16}..."

if command -v gh &> /dev/null; then
    echo "[Q++RS] Updating GitHub secrets..."
    
    echo "$KEY_BASE64" | gh secret set ASC_KEY_CONTENT_BASE64 -R "$REPO"
    echo "[Q++RS] ✓ ASC_KEY_CONTENT_BASE64 updated"
    
    echo "$KEY_ID" | gh secret set ASC_KEY_ID -R "$REPO"
    echo "[Q++RS] ✓ ASC_KEY_ID updated"
    
    echo "$SERIAL_HASH" | gh secret set SOVEREIGN_DEVICE_HASH -R "$REPO"
    echo "[Q++RS] ✓ SOVEREIGN_DEVICE_HASH updated"
    
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  Q++RS KEY BINDING COMPLETE                                  ║"
    echo "║  Author: Jonathan Sherman | Serial Bound: YES                ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    
    echo ""
    echo "[Q++RS] Triggering build..."
    gh workflow run ios-build.yml -R "$REPO" -f target=testflight
    echo "[Q++RS] ✓ Build triggered"
else
    echo ""
    echo "[Q++RS] GitHub CLI not installed. Manual update required:"
    echo ""
    echo "1. Go to: https://github.com/$REPO/settings/secrets/actions"
    echo ""
    echo "2. Update ASC_KEY_CONTENT_BASE64 with:"
    echo "$KEY_BASE64"
    echo ""
    echo "3. Update ASC_KEY_ID with:"
    echo "$KEY_ID"
    echo ""
    echo "4. Update SOVEREIGN_DEVICE_HASH with:"
    echo "$SERIAL_HASH"
fi
