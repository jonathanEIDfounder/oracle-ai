#!/usr/bin/env bash
# =============================================================================
# © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1
# S1AF — Sentient iOS One-Step App Framework · Sovereign ID: 1
# Author      : Jonathan Sherman (jonathanEIDfounder)
# Copyright   : © 2026 Jonathan Sherman. All rights reserved.
# License     : PROPRIETARY
# DRM         : S1AF-DRM-LOCKED
# =============================================================================
# replit-xcode-generate.sh
# Generates a complete, buildable Oracle-AI Xcode project on Replit (Linux).
# No macOS or xcodegen required — pure bash + python3.
# =============================================================================
set -euo pipefail
readonly _S1AF_AUTHOR="© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${REPO_ROOT}/Oracle-AI-Kimi-Xcode"
XCODEPROJ="${OUT}/Oracle-AI.xcodeproj"
SOURCES="${OUT}/OracleAI"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}  ✓  $*${RESET}"; }
info() { echo -e "${CYAN}  →  $*${RESET}"; }
hdr()  { echo -e "\n${BOLD}── $* ──${RESET}"; }

echo -e "${BOLD}"
echo "  ╔═══════════════════════════════════════════════════════╗"
echo "  ║  S1AF · Oracle-AI Xcode Project Generator            ║"
echo "  ║  © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1           ║"
echo "  ╚═══════════════════════════════════════════════════════╝"
echo -e "${RESET}"

# ── 1. Scaffold directories ───────────────────────────────────────────────────
hdr "1  Scaffolding"
mkdir -p \
  "${XCODEPROJ}/project.xcworkspace/xcshareddata" \
  "${XCODEPROJ}/xcshareddata/xcschemes" \
  "${SOURCES}" \
  "${OUT}/OracleAIWidget"

ok "Directory tree created"

# ── 2. Copy Swift sources from AARTE-iOS-App/Sources ─────────────────────────
hdr "2  Swift Sources"
cp "${REPO_ROOT}/AARTE-iOS-App/Sources/"*.swift "${SOURCES}/" 2>/dev/null || true
ok "Copied: $(ls "${SOURCES}"/*.swift 2>/dev/null | wc -l | tr -d ' ') Swift files"

# ── 3. Copy plists ────────────────────────────────────────────────────────────
hdr "3  Plists"
# Info.plist
cp "${REPO_ROOT}/AARTE-iOS-App/Info.plist" "${SOURCES}/Info.plist"
ok "Info.plist"

# KimiConfig.plist — stamp timestamp
sed "s/__GENERATED_AT__/${NOW}/" \
  "${REPO_ROOT}/AARTE-iOS-App/KimiConfig.plist" > "${SOURCES}/KimiConfig.plist"
ok "KimiConfig.plist (generated at ${NOW})"

# ── 4. Assets.xcassets ───────────────────────────────────────────────────────
hdr "4  Assets"
mkdir -p "${SOURCES}/Assets.xcassets/AppIcon.appiconset"
cat > "${SOURCES}/Assets.xcassets/Contents.json" << 'JSON'
{ "info": { "author": "xcode", "version": 1 } }
JSON
cat > "${SOURCES}/Assets.xcassets/AppIcon.appiconset/Contents.json" << 'JSON'
{
  "images": [
    { "idiom": "universal", "platform": "ios", "size": "1024x1024", "scale": "1x" }
  ],
  "info": { "author": "Jonathan Sherman — OCSO-S1AF-GOV-1", "version": 1 }
}
JSON
ok "Assets.xcassets"

# ── 5. xcworkspace ───────────────────────────────────────────────────────────
hdr "5  Workspace"
cat > "${XCODEPROJ}/project.xcworkspace/contents.xcworkspacedata" << 'XML'
<?xml version="1.0" encoding="UTF-8"?>
<Workspace version = "1.0">
  <FileRef location = "self:">
  </FileRef>
</Workspace>
XML
cat > "${XCODEPROJ}/project.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist" << 'XML'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>IDEDidComputeMac32BitWarning</key><true/>
</dict></plist>
XML
ok "Workspace files"

# ── 6. xcscheme ──────────────────────────────────────────────────────────────
hdr "6  Scheme"
MAIN_TARGET_ID="AA000000000000000000AABB"
cat > "${XCODEPROJ}/xcshareddata/xcschemes/Oracle-AI.xcscheme" << XML
<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1540" version="1.7">
  <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES">
    <BuildActionEntries>
      <BuildActionEntry buildForTesting="YES" buildForRunning="YES"
        buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">
        <BuildableReference
          BuildableIdentifier="primary"
          BlueprintIdentifier="${MAIN_TARGET_ID}"
          BuildableName="Oracle-AI.app"
          BlueprintName="OracleAI"
          ReferencedContainer="container:Oracle-AI.xcodeproj">
        </BuildableReference>
      </BuildActionEntry>
    </BuildActionEntries>
  </BuildAction>
  <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB"
    selectedLauncherIdentifier="Xcode.DebuggerFoundation.Launcher.LLDB" launchStyle="0"
    useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO"
    debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES">
    <BuildableProductRunnable runnableDebuggingMode="0">
      <BuildableReference
        BuildableIdentifier="primary"
        BlueprintIdentifier="${MAIN_TARGET_ID}"
        BuildableName="Oracle-AI.app"
        BlueprintName="OracleAI"
        ReferencedContainer="container:Oracle-AI.xcodeproj">
      </BuildableReference>
    </BuildableProductRunnable>
  </LaunchAction>
  <ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>
XML
ok "Oracle-AI.xcscheme"

# ── 7. project.pbxproj (Python-generated) ────────────────────────────────────
hdr "7  project.pbxproj"
python3 "${REPO_ROOT}/scripts/gen-pbxproj.py" \
  --out "${XCODEPROJ}/project.pbxproj" \
  --sources-dir "${SOURCES}" \
  --now "${NOW}"
ok "project.pbxproj ($(wc -l < "${XCODEPROJ}/project.pbxproj") lines)"

# ── 8. Summary ───────────────────────────────────────────────────────────────
hdr "Done"
TOTAL=$(find "${OUT}" -type f | wc -l | tr -d ' ')
echo ""
echo -e "  ${GREEN}${BOLD}${TOTAL} files generated${RESET}"
echo -e "  ${DIM}Output: ${OUT}${RESET}"
echo -e "  ${DIM}${_S1AF_AUTHOR}${RESET}"
echo ""
