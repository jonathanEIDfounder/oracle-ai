#!/bin/bash
# Oracle AI - iOS Build & Deploy
set -e
npx cap sync ios 2>&1 | tail -3
echo "✓ iOS project ready at ios/App/App.xcworkspace"
echo "✓ Codemagic config: codemagic.yaml"
echo "→ Push to GitHub, connect Codemagic, build deploys to TestFlight"
