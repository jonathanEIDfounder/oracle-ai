#!/bin/bash
set -e

echo "═══════════════════════════════════════════════════════════"
echo "  Oracle AI - iOS Deployment Automation"
echo "═══════════════════════════════════════════════════════════"

# Step 1: Sync iOS project
echo ""
echo "[1/3] Syncing iOS project..."
npx cap sync ios
echo "✓ iOS project synced"

# Step 2: Verify build files
echo ""
echo "[2/3] Verifying build configuration..."
if [ -f "codemagic.yaml" ]; then
    echo "✓ codemagic.yaml present"
else
    echo "✗ codemagic.yaml missing"
    exit 1
fi

if [ -d "ios/App/App.xcworkspace" ]; then
    echo "✓ Xcode workspace present"
else
    echo "✗ Xcode workspace missing"
    exit 1
fi

if [ -f "public/icons/app-icon.png" ]; then
    echo "✓ App icon present"
else
    echo "✗ App icon missing"
fi

# Step 3: Generate deployment info
echo ""
echo "[3/3] Deployment ready"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  MANUAL STEPS REQUIRED (External Authentication)"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  1. GITHUB: Push this repository"
echo "     → Use Replit's Git tab or run: git push origin main"
echo ""
echo "  2. CODEMAGIC: Connect repository"
echo "     → Visit: https://codemagic.io/start"
echo "     → Sign in with GitHub"
echo "     → Select this repository"
echo ""
echo "  3. APPLE: Link Developer Account"
echo "     → Codemagic → Settings → Integrations"
echo "     → Connect Apple Developer Portal"
echo "     → Team ID: (from developer.apple.com)"
echo ""
echo "  4. BUILD: Start iOS build"
echo "     → Codemagic → Start new build"
echo "     → Workflow: ios-release"
echo "     → Builds on Mac, uploads to TestFlight"
echo ""
echo "  5. INSTALL: TestFlight on iPhone XR"
echo "     → Open TestFlight app"
echo "     → Install Oracle AI"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Certificate: ORACLEAI-2025-QIP-001"
echo "  Bundle ID: com.oracleai.app"
echo "═══════════════════════════════════════════════════════════"
