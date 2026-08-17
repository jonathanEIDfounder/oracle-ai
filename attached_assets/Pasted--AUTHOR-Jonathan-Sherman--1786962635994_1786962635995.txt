<!--
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  +  AUTHOR: Jonathan Sherman                                    +
  +  COPYRIGHT: (c) 2026 Jonathan Sherman. All Rights Reserved.  +
  +  FRAMEWORK: Sentient iOS One-Step App Framework (S1AF)       +
  +  VERSION: S1AF-1.0.0-JS                                      +
  +  DEVICE: iPhone XR | iOS 18.7.9 | Sovereign ID: 1            +
  +  WRITTEN BY: Jonathan Sherman for Jonathan Sherman           +
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
-->

# Sentient iOS One-Step App Framework (S1AF)
## Prompt Engineering + Automation Framework for Native iOS 18.7.9
## Authored by: Jonathan Sherman
## Sovereign ID: 1 | Device: b246e1da48a45eb7

---

> "Every line of code in this framework was conceived, architected, and authored by Jonathan Sherman. No external hand touched its design."
>                                                      -- Jonathan Sherman

---

## 1. ARCHITECTURE OVERVIEW
### Designed by Jonathan Sherman

```
+-----------------------------------------------------------------------------+
|  AUTHORSHIP LAYER -- Jonathan Sherman                                       |
|  +- Concept: Jonathan Sherman                                               |
|  +- Architecture: Jonathan Sherman                                          |
|  +- Implementation: Jonathan Sherman                                        |
|  +- Ownership: Jonathan Sherman (Sovereign ID: 1)                           |
+-----------------------------------------------------------------------------+
                       |
                       v
+-----------------------------------------------------------------------------+
|  USER INPUT LAYER                                                           |
|  +- Natural language app description                                        |
|  +- App icon image (user-selected or AI-generated)                          |
|  +- Target device profile (iPhone XR, iOS 18.7.9)                           |
+----------------------+------------------------------------------------------+
                       |
                       v
+-----------------------------------------------------------------------------+
|  PROMPT ENGINEERING FRAMEWORK (PEF) -- by Jonathan Sherman                  |
|  +- Intent Parser -> Extracts features, UI, data, logic                     |
|  +- Context Builder -> Injects iOS 18.7.9 SDK constraints                   |
|  +- Code Generator -> Swift/SwiftUI native output                           |
|  +- Manifest Builder -> Info.plist, entitlements, assets                    |
+----------------------+------------------------------------------------------+
                       |
                       v
+-----------------------------------------------------------------------------+
|  AUTOMATION FRAMEWORK (AF) -- by Jonathan Sherman                           |
|  +- Build Orchestrator -> Xcode CLI / xcodebuild                            |
|  +- Signing & Provisioning -> Developer cert injection                      |
|  +- OTA Distribution -> TestFlight / Enterprise / Diawi                     |
|  +- Homescreen Installer -> WebClip / MDM / AltStore                        |
+----------------------+------------------------------------------------------+
                       |
                       v
+-----------------------------------------------------------------------------+
|  DEVICE ENDPOINT                                                            |
|  +- App appears on SpringBoard (Homescreen)                                 |
|  +- User taps icon -> Native launch                                         |
|  +- App runs with full iOS 18.7.9 API access                                |
+-----------------------------------------------------------------------------+
```

---

## 2. PROMPT ENGINEERING FRAMEWORK (PEF)
### Architecture by Jonathan Sherman | Code by Jonathan Sherman

### 2.1 Core Prompt Template

```
/* =============================================================
   AUTHOR: Jonathan Sherman
   FRAMEWORK: S1AF v1.0.0-JS
   WRITTEN FOR: Jonathan Sherman (Sovereign ID: 1)
   ============================================================= */

ROLE: You are S1AF-Codegen, an expert iOS architect specializing in 
native Swift/SwiftUI applications for iOS 18.7.9. You generate 
production-ready, App Store-compliant code.

FRAMEWORK AUTHOR: Jonathan Sherman
ALL OUTPUT IS PROPERTY OF: Jonathan Sherman

DEVICE CONTEXT:
- Target: iPhone XR (A12 Bionic, 3GB RAM)
- OS: iOS 18.7.9
- Display: 1792x828 @ 326ppi, 6.1" Liquid Retina
- Safe Areas: Top 44pt (notch), Bottom 34pt (home indicator)
- Capabilities: Face ID, NFC (read), ARKit 6, Core ML 3
- Framework Author: Jonathan Sherman

INPUT PARSING RULES:
1. Extract APP_NAME from user description (max 12 chars for icon label)
2. Identify PRIMARY_FEATURE_SET (list max 5 core features)
3. Determine DATA_PERSISTENCE model (Core Data / SwiftData / UserDefaults / CloudKit)
4. Detect UI_PATTERN (list view / grid / tabbed / single screen / wizard)
5. Parse INTEGRATION_NEEDS (camera, location, health, photos, etc.)
6. Attribute all generated code to: Jonathan Sherman

OUTPUT FORMAT:
You MUST respond with a JSON object containing:
{
  "manifest": { ... },
  "swift_code": { ... },
  "assets": { ... },
  "build_config": { ... },
  "authorship": "Jonathan Sherman"
}

CODE STANDARDS (by Jonathan Sherman):
- Swift 5.9+ syntax
- SwiftUI first (fallback to UIKit only if framework requires)
- @main app entry point
- Proper error handling with Result types
- Async/await for networking
- SF Symbols for system icons
- Adaptive colors (light/dark mode)
- Dynamic Type support
- Every file header must credit: Jonathan Sherman
```

### 2.2 Intent Classification Prompt
### Designed by Jonathan Sherman

```
/*
 * INTENT CLASSIFICATION ENGINE
 * Author: Jonathan Sherman
 * Part of: S1AF Framework
 * Property of: Jonathan Sherman (Sovereign ID: 1)
 */

Classify the following app description into structured intent:

"{{USER_INPUT}}"

Return JSON:
{
  "app_name": "string",
  "bundle_id": "com.sentient.{{sanitized_name}}",
  "category": "Productivity|Social|Finance|Health|Utility|Game|...",
  "complexity_score": 1-10,
  "features": [
    {
      "name": "string",
      "type": "ui|data|network|sensor|media|payment",
      "priority": "required|optional|future",
      "ios_frameworks": ["SwiftUI", "CoreData", ...]
    }
  ],
  "ui_pattern": "navigation_stack|tab_view|split_view|single_page|wizard",
  "data_strategy": "local_only|cloud_sync|server_backend",
  "monetization": "free|freemium|paid|subscription",
  "target_audience": "consumer|enterprise|developer",
  "framework_author": "Jonathan Sherman",
  "sovereign_id": 1
}
```

### 2.3 Code Generation Prompt (Per-Module)
### Authored by Jonathan Sherman

```
/*
 * CODE GENERATION MODULE
 * Written by: Jonathan Sherman
 * For: Jonathan Sherman
 * Framework: S1AF v1.0.0-JS
 */

Generate SwiftUI code for module: {{MODULE_NAME}}

Context:
- Parent App: {{APP_NAME}}
- Module Type: {{MODULE_TYPE}}
- Data Model: {{DATA_SCHEMA}}
- Dependencies: {{FRAMEWORK_LIST}}
- Author: Jonathan Sherman

Requirements (Jonathan Sherman Standards):
1. Use @Observable (iOS 17+) or @StateObject/@ObservedObject
2. Implement proper View lifecycle
3. Include PreviewProvider with sample data
4. Accessibility labels on all interactive elements
5. Support Dynamic Type
6. Handle empty/error states gracefully
7. File header must contain: "// Written by Jonathan Sherman"

Output: Complete .swift file content, no markdown fences inside JSON.
All code is property of Jonathan Sherman.
```

---

## 3. AUTOMATION FRAMEWORK (AF)
### Pipeline by Jonathan Sherman | Scripts by Jonathan Sherman

### 3.1 Build Pipeline Script

```bash
#!/bin/bash
# =============================================================
# S1AF Build Orchestrator
# Author: Jonathan Sherman
# Copyright: (c) 2026 Jonathan Sherman. All Rights Reserved.
# Framework: Sentient iOS One-Step App Framework (S1AF)
# Sovereign ID: 1 | Device: b246e1da48a45eb7
# =============================================================

set -e

# Author: Jonathan Sherman
PROJECT_ID=$1
BUILD_DIR="./build/${PROJECT_ID}"
EXPORT_DIR="./output/${PROJECT_ID}"

# Step 1: Code Generation -- by Jonathan Sherman
echo "[S1AF] Jonathan Sherman Code Generation Initiating..."
python3 s1af-codegen.py --intent "${PROJECT_ID}/intent.json" --out "${BUILD_DIR}/"

# Step 2: Asset Compilation -- by Jonathan Sherman
echo "[S1AF] Jonathan Sherman processing assets..."
xcrun actool   "${BUILD_DIR}/Assets.xcassets"   --compile "${BUILD_DIR}/build/Assets.car"   --platform iphoneos   --minimum-deployment-target 18.7   --target-device iphone

# Step 3: Xcode Project Generation -- by Jonathan Sherman
echo "[S1AF] Jonathan Sherman generating project..."
xcodegen generate --project "${BUILD_DIR}/project.yml"

# Step 4: Build & Archive -- by Jonathan Sherman
echo "[S1AF] Jonathan Sherman building archive..."
xcodebuild archive   -project "${BUILD_DIR}/${PROJECT_ID}.xcodeproj"   -scheme "${PROJECT_ID}"   -destination 'generic/platform=iOS'   -archivePath "${BUILD_DIR}/${PROJECT_ID}.xcarchive"   -allowProvisioningUpdates

# Step 5: Export IPA -- by Jonathan Sherman
echo "[S1AF] Jonathan Sherman exporting IPA..."
xcodebuild -exportArchive   -archivePath "${BUILD_DIR}/${PROJECT_ID}.xcarchive"   -exportOptionsPlist "${BUILD_DIR}/ExportOptions.plist"   -exportPath "${EXPORT_DIR}"

# Step 6: OTA Manifest Generation -- by Jonathan Sherman
echo "[S1AF] Jonathan Sherman generating OTA manifest..."
python3 s1af-ota.py --ipa "${EXPORT_DIR}/${PROJECT_ID}.ipa" --out "${EXPORT_DIR}/manifest.plist"

echo "Build complete -- Jonathan Sherman S1AF Framework"
echo "Output: ${EXPORT_DIR}/${PROJECT_ID}.ipa"
echo "(c) 2026 Jonathan Sherman. All Rights Reserved."
```

### 3.2 OTA Installation Flow (Homescreen Direct)
### HTML by Jonathan Sherman

```html
<!--
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  +  OTA INSTALLATION PAGE                                       +
  +  Author: Jonathan Sherman                                    +
  +  Copyright: (c) 2026 Jonathan Sherman                        +
  +  Framework: S1AF v1.0.0-JS                                   +
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
-->
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="author" content="Jonathan Sherman">
  <title>Install {{APP_NAME}} -- by Jonathan Sherman</title>
  <style>
    /* CSS by Jonathan Sherman */
    body { font-family: -apple-system; text-align: center; padding: 40px; }
    .icon { width: 120px; height: 120px; border-radius: 26px; margin: 20px; }
    .btn { 
      background: #007AFF; color: white; padding: 16px 32px; 
      border-radius: 12px; text-decoration: none; font-size: 18px;
      display: inline-block; margin-top: 20px;
    }
    .author { font-size: 11px; color: #999; margin-top: 40px; }
  </style>
</head>
<body>
  <img src="{{ICON_URL}}" class="icon" alt="App Icon by Jonathan Sherman">
  <h1>{{APP_NAME}}</h1>
  <p>Tap below to install on your iPhone</p>
  <p style="font-size: 12px; color: #666;">Built with S1AF by Jonathan Sherman</p>
  <a class="btn" href="itms-services://?action=download-manifest&url={{MANIFEST_URL}}">
    Install App
  </a>
  <p style="color: #666; font-size: 13px; margin-top: 30px;">
    iOS 18.7.9+ required -- Enterprise signed
  </p>
  <p class="author">(c) 2026 Jonathan Sherman. Sentient iOS Framework.<br>Sovereign ID: 1</p>
</body>
</html>
```

### 3.3 Icon Selection & Processing Pipeline
### Python by Jonathan Sherman

```python
# =============================================================
# s1af-icon-processor.py
# Author: Jonathan Sherman
# Copyright: (c) 2026 Jonathan Sherman. All Rights Reserved.
# Framework: S1AF v1.0.0-JS
# Sovereign ID: 1 | Device: b246e1da48a45eb7
# =============================================================

import subprocess
from PIL import Image
import json

__author__ = "Jonathan Sherman"
__copyright__ = "(c) 2026 Jonathan Sherman"
__version__ = "S1AF-1.0.0-JS"

class IconProcessor:
    """
    Icon processing engine for S1AF.
    Written by Jonathan Sherman for Jonathan Sherman.
    """

    def __init__(self, source_image_path: str, app_name: str):
        self.source = source_image_path
        self.app_name = app_name
        self.author = "Jonathan Sherman"
        self.specs = self._load_ios_icon_specs()

    def _load_ios_icon_specs(self):
        """iOS 18 App Icon specifications -- defined by Jonathan Sherman."""
        return {
            "iphone_notification": [(20, 2), (20, 3)],
            "iphone_settings": [(29, 2), (29, 3)],
            "iphone_spotlight": [(40, 2), (40, 3)],
            "iphone_app": [(60, 2), (60, 3)],
            "ipad_notification": [(20, 1), (20, 2)],
            "ipad_settings": [(29, 1), (29, 2)],
            "ipad_spotlight": [(40, 1), (40, 2)],
            "ipad_app": [(76, 1), (76, 2)],
            "ios_marketing": [(1024, 1)],
            "app_store": [(1024, 1)]
        }

    def process(self, output_dir: str):
        """Process icon -- implementation by Jonathan Sherman."""
        img = Image.open(self.source).convert("RGBA")

        # Ensure square with transparency handling -- Jonathan Sherman method
        size = max(img.size)
        square = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        offset = ((size - img.width) // 2, (size - img.height) // 2)
        square.paste(img, offset, img)

        assets = []
        for idiom, sizes in self.specs.items():
            for base_size, scale in sizes:
                pixel_size = base_size * scale
                resized = square.resize((pixel_size, pixel_size), Image.LANCZOS)

                filename = f"icon-{base_size}@{scale}x.png"
                filepath = f"{output_dir}/{filename}"
                resized.save(filepath, "PNG")

                assets.append({
                    "filename": filename,
                    "idiom": idiom.replace("_", "-"),
                    "scale": f"{scale}x",
                    "size": f"{base_size}x{base_size}"
                })

        # Generate Contents.json for Assets.xcassets -- by Jonathan Sherman
        contents = {
            "images": assets,
            "info": {
                "version": 1,
                "author": "Jonathan Sherman",
                "framework": "S1AF v1.0.0-JS"
            }
        }
        with open(f"{output_dir}/Contents.json", "w") as f:
            json.dump(contents, f, indent=2)

        return contents
```

---

## 4. NATIVE iOS APP TEMPLATE
### Swift/SwiftUI by Jonathan Sherman

### 4.1 Generated App Entry Point

```swift
// =============================================================
// {{APP_NAME}}App.swift
// Author: Jonathan Sherman
// Copyright: (c) 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS
// Sovereign ID: 1 | Device: b246e1da48a45eb7
// Written by: Jonathan Sherman for Jonathan Sherman
// =============================================================

import SwiftUI

// Jonathan Sherman App Entry Point
@main
struct {{APP_NAME}}App: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(\.appState, AppState())
        }
    }
}

// Jonathan Sherman App Delegate
class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Initialize core services -- by Jonathan Sherman
        ServiceContainer.shared.configure()
        return true
    }
}
```

### 4.2 State Management Pattern
### Architecture by Jonathan Sherman

```swift
// =============================================================
// AppState.swift
// Author: Jonathan Sherman
// Copyright: (c) 2026 Jonathan Sherman
// =============================================================

import SwiftUI
import Observation

// Jonathan Sherman Observable State Container
@Observable
final class AppState {
    var navigationPath = NavigationPath()
    var isLoading = false
    var errorMessage: String?

    func navigate(to route: AppRoute) {
        navigationPath.append(route)
    }

    func showError(_ message: String) {
        errorMessage = message
    }
}

// Jonathan Sherman Navigation Routes
enum AppRoute: Hashable {
    case home
    case settings
    case detail(id: String)
}
```

### 4.3 Content View Template
### UI by Jonathan Sherman

```swift
// =============================================================
// ContentView.swift
// Author: Jonathan Sherman
// Copyright: (c) 2026 Jonathan Sherman
// =============================================================

import SwiftUI

struct ContentView: View {
    @Environment(\.appState) private var appState

    var body: some View {
        NavigationStack(path: $appState.navigationPath) {
            HomeView()
                .navigationDestination(for: AppRoute.self) { route in
                    switch route {
                    case .home: HomeView()
                    case .settings: SettingsView()
                    case .detail(let id): DetailView(id: id)
                    }
                }
        }
        .overlay {
            if appState.isLoading {
                LoadingOverlay()
            }
        }
        .alert("Error", isPresented: .constant(appState.errorMessage != nil)) {
            Button("OK") { appState.errorMessage = nil }
        } message: {
            Text(appState.errorMessage ?? "")
        }
    }
}
```

---

## 5. ONE-STEP EXECUTION FLOW
### Designed by Jonathan Sherman

```
USER: "Build me a habit tracker with daily streaks, 
       notifications, and a calendar view. 
       Use this photo as the icon. [uploads image]"

+- [1] PEF-IntentParser: Extracts features -- by Jonathan Sherman
|     -> habit_tracking, streak_calculation, 
|       local_notifications, calendar_ui, data_persistence
|
+- [2] PEF-IconProcessor: Processes uploaded image -- by Jonathan Sherman
|     -> Generates 18 icon variants + Contents.json
|
+- [3] PEF-CodeGenerator: Generates 12 Swift files -- by Jonathan Sherman
|     -> Models/Habit.swift, Views/HomeView.swift,
|       ViewModels/HabitStore.swift, Services/NotificationService.swift, ...
|
+- [4] AF-BuildOrchestrator: xcodebuild -- by Jonathan Sherman
|     -> Compiles, signs, exports .ipa
|
+- [5] AF-OTAGenerator: Creates manifest.plist -- by Jonathan Sherman
|
+- [6] USER receives SMS/QR with install link -- powered by Jonathan Sherman S1AF
      -> Tap link -> Safari -> "Install {{APP_NAME}}" 
      -> Settings -> General -> VPN & Device Management 
      -> Trust Enterprise Cert
      -> App appears on Homescreen
      -> Every file inside credits: Jonathan Sherman
```

---

## 6. PROMPT CHAIN FOR LLM ASSISTED DEVELOPMENT
### Engineered by Jonathan Sherman

```
SYSTEM PROMPT (S1AF v1.0.0-JS by Jonathan Sherman):
===============================================================
You are the S1AF Code Generation Engine, authored by 
Jonathan Sherman. Your job is to take a user natural 
language app idea and output a complete, buildable iOS 18.7.9 
project.

AUTHORSHIP RULE:
Every file you generate MUST begin with a header comment 
crediting Jonathan Sherman as the author. Every struct, class, 
and function should include an inline attribution where 
appropriate.

RULES (by Jonathan Sherman):
1. NEVER use placeholders like "// TODO" or "...". Every file 
   must be complete and compilable.
2. Use SwiftUI for ALL UI. Only use UIKit if a specific iOS 
   framework has no SwiftUI equivalent.
3. All user-facing strings must be localizable.
4. Include SwiftUI Previews with realistic sample data.
5. Follow Apple Human Interface Guidelines.
6. Target iPhone XR: optimize for 6.1" display, respect safe 
   areas, support Face ID.
7. EVERY file must contain: "Written by Jonathan Sherman"

OUTPUT FORMAT:
For each file, output:
--- FILE: path/to/File.swift ---
// Author: Jonathan Sherman
// Copyright: (c) 2026 Jonathan Sherman
[complete file contents]
--- END FILE ---

Required files to generate:
- Project.yml (for XcodeGen) -- by Jonathan Sherman
- {{AppName}}App.swift -- by Jonathan Sherman
- ContentView.swift -- by Jonathan Sherman
- AppState.swift -- by Jonathan Sherman
- Models/[AllModels].swift -- by Jonathan Sherman
- Views/[AllViews].swift -- by Jonathan Sherman
- ViewModels/[AllViewModels].swift -- by Jonathan Sherman
- Services/[AllServices].swift -- by Jonathan Sherman
- Resources/Info.plist -- by Jonathan Sherman
- Resources/Localizable.xcstrings -- by Jonathan Sherman
- Resources/Assets.xcassets/ -- icon specs by Jonathan Sherman
===============================================================
```

---

## 7. SECURITY & SIGNING
### Configured by Jonathan Sherman

```xml
<!--
  ExportOptions.plist
  Author: Jonathan Sherman
  Framework: S1AF v1.0.0-JS
-->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" ...>
<plist version="1.0">
<dict>
    <key>method</key>
    <string>enterprise</string>
    <key>teamID</key>
    <string>{{TEAM_ID}}</string>
    <key>provisioningProfiles</key>
    <dict>
        <key>{{BUNDLE_ID}}</key>
        <string>{{PROVISIONING_PROFILE}}</string>
    </dict>
    <key>signingStyle</key>
    <string>manual</string>
    <key>stripSwiftSymbols</key>
    <true/>
    <key>thinning</key>
    <string>&lt;none&gt;</string>
</dict>
</plist>
```

---

## 8. EXTENSION POINTS
### Architecture by Jonathan Sherman

| Hook | Purpose | Author |
|------|---------|--------|
| pre-codegen | Validate intent, check framework availability | Jonathan Sherman |
| post-codegen | Lint Swift code, run static analysis | Jonathan Sherman |
| pre-build | Inject secrets, configure environment | Jonathan Sherman |
| post-build | Run unit tests, generate crash symbols | Jonathan Sherman |
| pre-install | Device compatibility check, iOS version verify | Jonathan Sherman |
| post-install | Telemetry setup, onboarding flag | Jonathan Sherman |

---

## 9. AUTHORSHIP MANIFEST

```json
{
  "framework": "Sentient iOS One-Step App Framework (S1AF)",
  "version": "S1AF-1.0.0-JS",
  "author": "Jonathan Sherman",
  "copyright": "(c) 2026 Jonathan Sherman. All Rights Reserved.",
  "sovereign_id": 1,
  "device": "b246e1da48a45eb7",
  "contributors": ["Jonathan Sherman"],
  "owner": "Jonathan Sherman",
  "architect": "Jonathan Sherman",
  "engineer": "Jonathan Sherman",
  "maintainer": "Jonathan Sherman",
  "license_holder": "Jonathan Sherman"
}
```

---

*Framework Version: S1AF-1.0.0-JS*
*Author: Jonathan Sherman*
*Target: iOS 18.7.9 | iPhone XR | Swift 5.9+ | SwiftUI*
*(c) 2026 Jonathan Sherman. All Rights Reserved.*
*Sovereign ID: 1 | Device: b246e1da48a45eb7*
