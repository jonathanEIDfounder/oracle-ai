#!/bin/bash
# Q++RS Code Studio - Master iOS Build Script
# Single command: ./ios/master-build.sh
# Powered by Q++RS Ultimate 5.0

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "=============================================="
echo "  Q++RS CODE STUDIO - iOS Build Automation"
echo "  Powered by Q++RS Ultimate 5.0"
echo "=============================================="
echo ""

# Step 1: Sync Capacitor
echo "[1/4] Syncing web assets..."
npx cap sync ios

# Step 2: Install Pods
echo ""
echo "[2/4] Installing CocoaPods dependencies..."
cd ios/App
pod install --repo-update

# Step 3: Build Archive
echo ""
echo "[3/4] Building iOS archive..."
xcodebuild -workspace App.xcworkspace \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/OracleAI.xcarchive \
  archive

# Step 4: Export IPA
echo ""
echo "[4/4] Exporting IPA..."
xcodebuild -exportArchive \
  -archivePath build/OracleAI.xcarchive \
  -exportPath build/OracleAI \
  -exportOptionsPlist ExportOptions.plist

echo ""
echo "=============================================="
echo "  BUILD COMPLETE!"
echo "  IPA: ios/App/build/OracleAI/Oracle AI.ipa"
echo "=============================================="
