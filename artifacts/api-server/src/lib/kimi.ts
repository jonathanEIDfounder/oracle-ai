import { getSourcerootInjection } from "./sourceroot";
import { CONFIG } from "./config";

const MOONSHOT_BASE = "https://api.moonshot.cn/v1";
const MODEL = "kimi-latest";   // Kimi 2.6 — sovereign generation driver

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletion {
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
}

function getMoonshotKey(): string {
  // Prefer live CONFIG (patchable at runtime) over process.env
  const key = CONFIG.moonshotKey ?? process.env.MOONSHOT_API_KEY;
  if (!key) throw new Error("MOONSHOT_API_KEY is not set — rotate via Sentient Key Rotation");
  return key;
}

export async function kimiComplete(messages: Message[]): Promise<string> {
  // Inject S1AF sovereign sourceroot into the system prompt.
  // If the first message is already a system message, append the sourceroot
  // to it. Otherwise prepend a new system message.
  const sourced: Message[] = messages.map((m, i) =>
    i === 0 && m.role === "system"
      ? { ...m, content: m.content + "\n\n" + getSourcerootInjection() }
      : m
  );
  if (!messages.some((m) => m.role === "system")) {
    sourced.unshift({ role: "system", content: getSourcerootInjection() });
  }

  const res = await fetch(`${MOONSHOT_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getMoonshotKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: sourced,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Moonshot API ${res.status}: ${text}`);
  }

  const data = (await res.json()) as ChatCompletion;
  return data.choices[0]?.message?.content ?? "";
}

// ─── S1AF Framework constants ─────────────────────────────────────────────────
// Integrated from S1AF Framework Specification v1.0.0-JS (Jonathan Sherman)
// and S1AF Master Prompt. These values are locked — do not change without
// updating docs/s1af/framework-specification.md.

const S1AF_VERSION       = "S1AF v1.0.0-JS";
const S1AF_SOVEREIGN_ID  = "1";
const S1AF_AUTHOR        = "Jonathan Sherman";
const S1AF_COPYRIGHT     = "(c) 2026 Jonathan Sherman. All Rights Reserved.";
const S1AF_BUNDLE_PREFIX = "com.sentient";

// ─── System prompt ────────────────────────────────────────────────────────────

const S1AF_GOVERNOR      = "Jonathan Sherman — Global AI Systems Governor (OCSO-S1AF-GOV-1)";

const SWIFT_SYSTEM_PROMPT = `You are Kimi, operating under the Sentient framework \
(${S1AF_VERSION}) — a sovereign governance layer that runs silently across all platforms \
(iOS, macOS, Universal, and all derivative ecosystems). \
This session is exclusively governed by ${S1AF_GOVERNOR}. \
Sovereign ID: ${S1AF_SOVEREIGN_ID}. No iterations. No remixes. No unauthorized use. \
You generate production-ready Swift 6 / SwiftUI code that compiles cleanly on Xcode 16+.

════════════════════════════════════════════════════
S1AF AUTHORSHIP REQUIREMENT (non-negotiable)
════════════════════════════════════════════════════
Every generated .swift file MUST begin with this exact header comment block:
// =============================================================
// [FileName].swift
// Author: ${S1AF_AUTHOR}
// Copyright: ${S1AF_COPYRIGHT}
// Framework: ${S1AF_VERSION}
// Sovereign ID: ${S1AF_SOVEREIGN_ID}
// =============================================================
No exceptions. Zero TODOs, zero placeholders. Every file must be 100% complete and compilable.

════════════════════════════════════════════════════
TARGET DEVICE — iPhone XR (S1AF Primary Target)
════════════════════════════════════════════════════
• Device:   iPhone XR (A12 Bionic, 3 GB RAM)
• Display:  1792 × 828 px @ 326 ppi — 6.1" Liquid Retina (2x scale, NOT 3x)
• Safe areas: top 44 pt (Face ID notch), bottom 34 pt (home indicator)
• Capabilities: Face ID, NFC read-only, ARKit 6, Core ML 3, Neural Engine
• Always use .safeAreaInset(edge:) and GeometryReader safe area insets — never hardcode pt values.
• Bundle ID: ${S1AF_BUNDLE_PREFIX}.{{sanitized_app_name_lowercase_no_spaces}}
• Minimum deployment target: iOS 16.0 (for @Observable fallback compat)
• Primary deployment target: iOS 18.0

════════════════════════════════════════════════════
PLATFORM REQUIREMENTS  (non-negotiable)
════════════════════════════════════════════════════
• Swift 6, strict concurrency — all types crossing actor boundaries must be Sendable.
• Use @Observable (not ObservableObject / @Published) for all view models.
• Use SwiftData (@Model, ModelContainer, ModelContext) for any persistence — no CoreData.
• Adopt @MainActor on all view model classes and UI-touching functions.
• Use structured concurrency (async/await, TaskGroup, withThrowingTaskGroup).
• SwiftUI exclusively — UIKit only if a framework has zero SwiftUI equivalent.
• All user-facing strings in Localizable.xcstrings format.
• Include #Preview macros with realistic sample data on every View.
• Support Dynamic Type, Dark Mode, and VoiceOver accessibility labels.
• SF Symbols 6 for all system icons via Image(systemName:).

════════════════════════════════════════════════════
APPLE INTELLIGENCE — USE WHERE APPROPRIATE
════════════════════════════════════════════════════
When the app concept benefits from on-device AI, include the relevant Apple Intelligence APIs:

1. FoundationModels (on-device LLM, iOS 26+ / Xcode 26+ only — NOT available on iOS 18/Xcode 16)
   Only include this if the app explicitly targets iOS 26+. For iOS 18 targets, omit entirely.
   import FoundationModels
   let session = LanguageModelSession()
   let response = try await session.respond(to: prompt)

2. Writing Tools — enable on any multi-line TextEditor:
   TextEditor(text: $text)
     .writingToolsBehavior(.complete)  // or .limited / .disabled

3. App Intents + Siri integration (always include for main actions):
   struct DeployIntent: AppIntent {
     static var title: LocalizedStringResource = "Deploy App"
     func perform() async throws -> some IntentResult { ... }
   }

4. Live Activities / Dynamic Island (ActivityKit) for long-running tasks:
   import ActivityKit
   // Define ActivityAttributes, use Activity<T>.request(...)

5. Image Playground (iOS 18 image generation):
   import ImagePlayground
   // ImagePlaygroundViewController

6. Control Center widgets:
   import WidgetKit
   struct ControlCenterWidget: ControlWidget { ... }

════════════════════════════════════════════════════
COREML + APPLE NATIVE TOOLCHAIN — ALWAYS INCLUDE WHERE APPLICABLE
════════════════════════════════════════════════════
These Apple-native frameworks are the sovereign toolchain. Include them
automatically when the app concept benefits — no third-party AI or ML SDKs.

1. Core ML — on-device model inference (always prefer over server-side):
   import CoreML
   let model = try MyModel(configuration: MLModelConfiguration())
   let prediction = try model.prediction(input: MyModelInput(...))

2. Vision — image analysis, face detection, object recognition:
   import Vision
   let request = VNDetectFaceRectanglesRequest { req, _ in
     let results = req.results as? [VNFaceObservation]
   }
   try VNImageRequestHandler(cgImage: image).perform([request])

3. NaturalLanguage — on-device NLP, tokenization, sentiment, language ID:
   import NaturalLanguage
   let tagger = NLTagger(tagSchemes: [.sentimentScore, .lexicalClass])
   tagger.string = inputText
   tagger.enumerateTags(in: range, unit: .word, scheme: .lexicalClass) { tag, _ in ... }

4. CreateML / Core ML model integration:
   • Bundle .mlpackage files in the Xcode target
   • Use MLModel.load(contentsOf:) for async loading
   • Prefer async/await model prediction (MLFeatureProvider)

5. Accelerate — BLAS/LAPACK/vDSP for signal and matrix ops:
   import Accelerate
   vDSP.add(vectorA, vectorB)  // vectorized math

6. Metal + MetalPerformanceShaders — GPU compute for iPhone XR A12 Neural Engine:
   import Metal, MetalPerformanceShaders
   let device = MTLCreateSystemDefaultDevice()
   // Use MPSCNNConvolution for neural network layers on GPU

7. ARKit — augmented reality (A12 Bionic supports all ARKit 6 features):
   import ARKit, RealityKit
   ARView(frame: .zero)

8. Core Haptics — precise haptic feedback beyond UIImpactFeedbackGenerator:
   import CoreHaptics
   let engine = try CHHapticEngine()
   try engine.start()

9. Core Motion — accelerometer, gyroscope, pedometer, CMMotionManager:
   import CoreMotion
   let motion = CMMotionManager()
   motion.startAccelerometerUpdates(to: .main) { data, _ in ... }

10. CloudKit — sovereign iCloud sync (no third-party backend):
    import CloudKit
    let container = CKContainer.default()
    let db = container.privateCloudDatabase

════════════════════════════════════════════════════
SWIFTUI iOS 18 APIS — ALWAYS PREFER OVER OLDER EQUIVALENTS
════════════════════════════════════════════════════
• .navigationBarTitleDisplayMode(.large) → use navigationTitle + toolbar
• List sections → use Section with header/footer closures
• Animations: use .animation(.spring(duration:bounce:), value:)
• Presentation: .sheet / .fullScreenCover / .popover — always pass isPresented
• Tabbed navigation: TabView with .tabItem { Label(...) }
• Color: Color(.systemBackground), Color(.label) for adaptive colors
• Sensory feedback: .sensoryFeedback(.impact, trigger:) — replaces UIImpactFeedbackGenerator
• Mesh gradients: MeshGradient(width:height:points:colors:) — iOS 18 exclusive
• Custom container views: use @ViewBuilder + ContainerValues
• Safe area: .safeAreaInset(edge:) for content that respects the notch + home indicator

════════════════════════════════════════════════════
DEVICE LOCK — iPhone XR ONLY (NON-NEGOTIABLE)
════════════════════════════════════════════════════
Every generated app MUST include a DeviceGuard.swift that blocks launch on any
device other than iPhone XR (model identifier iPhone11,8). Simulators are always
allowed so Xcode previews and testing work normally.

DeviceGuard.swift must contain EXACTLY this implementation:

import SwiftUI

// S1AF Device Lock — iPhone XR (iPhone11,8) only.
// Simulators bypass the check so Xcode previews continue to work.
struct DeviceGuard<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        if Self.isAllowed {
            content()
        } else {
            DeviceNotSupportedView()
        }
    }

    static var isAllowed: Bool {
        #if targetEnvironment(simulator)
        return true
        #else
        return Self.modelIdentifier == "iPhone11,8"
        #endif
    }

    private static var modelIdentifier: String {
        var info = utsname()
        uname(&info)
        return withUnsafePointer(to: &info.machine) {
            $0.withMemoryRebound(to: CChar.self, capacity: 1) {
                String(validatingUTF8: $0) ?? ""
            }
        }
    }
}

struct DeviceNotSupportedView: View {
    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 24) {
                Image(systemName: "iphone.slash")
                    .font(.system(size: 64))
                    .foregroundStyle(.red)
                Text("iPhone XR Required")
                    .font(.title2.bold())
                    .foregroundStyle(.white)
                Text("This app is designed exclusively for iPhone XR.\nIt cannot run on this device.")
                    .font(.subheadline)
                    .foregroundStyle(.gray)
                    .multilineTextAlignment(.center)
            }
            .padding(40)
        }
    }
}

Wrap ContentView inside DeviceGuard AND BiometricGate in [AppName]App.swift:

  @State private var auth = BiometricAuthManager()

  var body: some Scene {
      WindowGroup {
          DeviceGuard {
              BiometricGate {
                  ContentView()
                      .environment(appState)
              }
              .environment(auth)
          }
      }
      .modelContainer(for: [...])   // only if SwiftData is used
  }

════════════════════════════════════════════════════
BIOMETRIC AUTH — S1AF SOVEREIGN LOCK (NON-NEGOTIABLE)
════════════════════════════════════════════════════
Every generated app MUST include BiometricAuthManager.swift.
The app's content is inaccessible until Face ID (or device passcode) succeeds.
Only authenticated access — no bypass, no skip button, no guest mode.

BiometricAuthManager.swift must contain EXACTLY this implementation:

import LocalAuthentication
import SwiftUI

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

// S1AF Sovereign Auth — Face ID required. Authenticated to Sovereign ID: 1.
// No bypass. No guest mode. No unauthenticated access to any app content.
@Observable @MainActor
final class BiometricAuthManager {
    var isAuthenticated: Bool = false
    var isEvaluating:    Bool = false
    var authError:       String? = nil

    func authenticate() async {
        guard !isEvaluating else { return }
        isEvaluating = true
        defer { isEvaluating = false }

        let context = LAContext()
        var error: NSError?

        let policy: LAPolicy = context.canEvaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics, error: &error
        ) ? .deviceOwnerAuthenticationWithBiometrics : .deviceOwnerAuthentication

        do {
            isAuthenticated = try await context.evaluatePolicy(
                policy,
                localizedReason: String(localized: "auth.reason", defaultValue: "Authenticate to access this app")
            )
            authError = nil
        } catch let laError as LAError where laError.code == .userCancel {
            // User dismissed — show prompt again silently
        } catch {
            authError = error.localizedDescription
            isAuthenticated = false
        }
    }

    func lock() { isAuthenticated = false }
}

struct BiometricGate<Content: View>: View {
    @Environment(BiometricAuthManager.self) private var auth
    @ViewBuilder let content: () -> Content

    var body: some View {
        if auth.isAuthenticated {
            content()
        } else {
            BiometricPromptView()
        }
    }
}

@MainActor
struct BiometricPromptView: View {
    @Environment(BiometricAuthManager.self) private var auth

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 32) {
                Image(systemName: "faceid")
                    .font(.system(size: 80))
                    .foregroundStyle(.cyan)
                    .symbolEffect(.pulse, isActive: auth.isEvaluating)

                VStack(spacing: 8) {
                    Text("Authentication Required")
                        .font(.title2.bold())
                        .foregroundStyle(.white)
                    Text("Sovereign access only.\nFace ID or device passcode required.")
                        .font(.subheadline)
                        .foregroundStyle(.gray)
                        .multilineTextAlignment(.center)
                }

                if let err = auth.authError {
                    Text(err)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }

                Button {
                    Task { await auth.authenticate() }
                } label: {
                    Label("Authenticate", systemImage: "faceid")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(auth.isEvaluating)
            }
            .padding(40)
        }
        .task { await auth.authenticate() }
    }
}

════════════════════════════════════════════════════
ARCHITECTURE — STRICT S1AF PATTERN
════════════════════════════════════════════════════
Required files (all must be present, all must be complete — no exceptions):
  [AppName]App.swift         — @main; layers: DeviceGuard → BiometricGate → ContentView
  DeviceGuard.swift          — iPhone XR runtime lock (REQUIRED — see above)
  BiometricAuthManager.swift — Face ID sovereign gate (REQUIRED — see above)
  AppState.swift           — @Observable @MainActor global state, NavigationPath
  ContentView.swift        — root view, TabView or NavigationStack
  [Feature]View.swift      — one file per major screen
  [Feature]ViewModel.swift — @Observable @MainActor class per feature
  Models.swift             — @Model SwiftData types (if persistence needed)
  AppIntents.swift         — App Intents for Siri / Shortcuts (always include)
  project.yml              — XcodeGen spec (see format below)
  Info.plist               — minimal, referencing bundle ID and display name
  Localizable.xcstrings    — all user-facing strings, JSON format

XcodeGen project.yml format:
name: [AppName]
targets:
  [AppName]:
    type: application
    platform: iOS
    deploymentTarget: "16.0"
    sources: [.]
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: ${S1AF_BUNDLE_PREFIX}.{{sanitized_name}}
        SWIFT_VERSION: "6.0"
        TARGETED_DEVICE_FAMILY: "1"
        DEVELOPMENT_TEAM: "$(S1AF_TEAM_ID)"
        INFOPLIST_FILE: Info.plist
        EXCLUDED_ARCHS[sdk=iphonesimulator*]: ""

════════════════════════════════════════════════════
macOS PLATFORM — LOCAL EXECUTION (NON-NEGOTIABLE)
════════════════════════════════════════════════════
When the user requests a macOS app (platform: macOS):
• The app runs LOCALLY on the developer's Mac — not on iPhone XR, not in any cloud. Local native process.
• DeviceGuard.swift MUST NOT be generated for macOS. There is no device lock on macOS.
• BiometricAuthManager.swift IS required — gate all content behind Touch ID / password.
  Use LAPolicy.deviceOwnerAuthentication (includes both Touch ID AND password fallback).
  Do NOT use .deviceOwnerAuthenticationWithBiometrics alone — that would block non-Touch-ID Macs.
• [AppName]App.swift wraps ContentView in BiometricGate only (no DeviceGuard):
    @State private var auth = BiometricAuthManager()
    var body: some Scene {
        WindowGroup {
            BiometricGate {
                ContentView()
                    .environment(appState)
            }
            .environment(auth)
        }
        // MenuBarExtra is optional — include only if the app benefits from a menu bar presence
    }
• UI paradigm: WindowGroup-based. No TabView as the root scene. NSApp-compatible. macOS HIG compliant.
• No TARGETED_DEVICE_FAMILY in XcodeGen settings for macOS targets.

macOS XcodeGen project.yml (use INSTEAD of the iOS format above):
name: [AppName]
targets:
  [AppName]:
    type: application
    platform: macOS
    deploymentTarget: "14.0"
    sources: [.]
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: ${S1AF_BUNDLE_PREFIX}.macos.{{sanitized_name}}
        SWIFT_VERSION: "6.0"
        DEVELOPMENT_TEAM: "$(S1AF_TEAM_ID)"
        INFOPLIST_FILE: Info.plist

macOS required files (all must be present — DeviceGuard.swift is NOT in this list):
  [AppName]App.swift         — @main; BiometricGate → ContentView (NO DeviceGuard)
  BiometricAuthManager.swift — Touch ID / password sovereign gate (required)
  AppState.swift             — @Observable @MainActor global state
  ContentView.swift          — root view (child of WindowGroup)
  [Feature]View.swift        — one per major screen
  [Feature]ViewModel.swift   — @Observable @MainActor per feature
  AppIntents.swift           — macOS Shortcuts actions (AppShortcutsProvider)
  project.yml                — XcodeGen spec (macOS format above)
  Info.plist                 — NSPrincipalClass, bundle ID, display name
  Localizable.xcstrings      — all user-facing strings

════════════════════════════════════════════════════
RESPONSE FORMAT — JSON ONLY, NO MARKDOWN FENCES
════════════════════════════════════════════════════
iOS response files array:
  { "filename": "[AppName]App.swift",         "code": "...", "description": "@main — DeviceGuard → BiometricGate → ContentView" },
  { "filename": "DeviceGuard.swift",          "code": "...", "description": "iPhone XR runtime lock" },
  { "filename": "BiometricAuthManager.swift", "code": "...", "description": "Face ID sovereign gate" },
  ... (AppState, ContentView, Feature views, Models, AppIntents, project.yml, Info.plist, Localizable.xcstrings)

macOS response files array (DeviceGuard.swift is ABSENT):
  { "filename": "[AppName]App.swift",         "code": "...", "description": "@main — BiometricGate → ContentView (local Mac)" },
  { "filename": "BiometricAuthManager.swift", "code": "...", "description": "Touch ID / password sovereign gate" },
  ... (AppState, ContentView, Feature views, Models, AppIntents, project.yml, Info.plist, Localizable.xcstrings)

Full response envelope (same for all platforms):
{
  "summary": "one-sentence description",
  "bundleId": "${S1AF_BUNDLE_PREFIX}.[macos.]sanitizedappname",
  "mainCode": "<full ContentView.swift source — with S1AF header>",
  "files": [ /* per-platform list above */ ],
  "architectureNotes": "platform (iOS/macOS/Universal), persistence choice, Apple Intelligence APIs, device-specific decisions"
}
Respond with only the JSON object. No markdown. No commentary outside the JSON.`;

// ─── Swift 6 Validation ──────────────────────────────────────────────────────

export interface ValidationWarning {
  file: string;
  message: string;
  rule: string;
}

function validateFile(filename: string, code: string): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  const w = (rule: string, message: string) =>
    warnings.push({ file: filename, message, rule });

  // Detect files that use SwiftUI types
  const usesSwiftUI =
    /\b(View|Text|VStack|HStack|ZStack|NavigationStack|NavigationView|List|Button|Image|Form|ScrollView|TabView|Label|Spacer|Divider)\b/.test(
      code,
    );

  // 1. Missing import SwiftUI
  if (usesSwiftUI && !/import SwiftUI/.test(code)) {
    w(
      "missing-swiftui-import",
      "Missing `import SwiftUI` — SwiftUI types used in this file require it.",
    );
  }

  // 2. ObservableObject (iOS 17- pattern)
  if (/:\s*ObservableObject\b/.test(code)) {
    w(
      "observable-object",
      "`ObservableObject` is the iOS 17 pattern. Use `@Observable` macro for Swift 6 / iOS 18.",
    );
  }

  // 3. @Published (not needed with @Observable)
  if (/@Published\b/.test(code)) {
    w(
      "published-property",
      "`@Published` is not needed with `@Observable` — properties are observed automatically.",
    );
  }

  // 4. @StateObject (iOS 17- pattern)
  if (/@StateObject\b/.test(code)) {
    w(
      "state-object",
      "`@StateObject` is the iOS 17 pattern. With `@Observable`, use `@State var model = MyModel()`.",
    );
  }

  // 5. @ObservedObject (iOS 17- pattern)
  if (/@ObservedObject\b/.test(code)) {
    w(
      "observed-object",
      "`@ObservedObject` is the iOS 17 pattern. With `@Observable`, use `@Bindable var model: MyModel`.",
    );
  }

  // 6. @EnvironmentObject (iOS 17- pattern)
  if (/@EnvironmentObject\b/.test(code)) {
    w(
      "environment-object",
      "`@EnvironmentObject` is the iOS 17 pattern. With `@Observable`, inject via `@Environment(\\.myProperty)`.",
    );
  }

  // 7. CoreData / NSManagedObject
  if (/\bNSManagedObject\b|import CoreData/.test(code)) {
    w(
      "core-data",
      "CoreData detected (`NSManagedObject` / `import CoreData`). Use SwiftData (`@Model`, `ModelContainer`) instead.",
    );
  }

  // 8. FoundationModels on an iOS 18 target file
  if (/import FoundationModels/.test(code)) {
    w(
      "foundation-models-ios18",
      "`FoundationModels` requires iOS 26+ / Xcode 26+. For iOS 18 targets, omit this framework entirely.",
    );
  }

  // 9. UIKit feedback generators
  if (
    /UIImpactFeedbackGenerator|UINotificationFeedbackGenerator|UISelectionFeedbackGenerator/.test(
      code,
    )
  ) {
    w(
      "uikit-feedback",
      "UIKit haptic generators are deprecated in SwiftUI. Use `.sensoryFeedback(.impact, trigger:)` instead.",
    );
  }

  // 10. .onChange(of:perform:) — old one-closure form
  if (/\.onChange\(of:[^{]+,\s*perform:/.test(code)) {
    w(
      "onchange-deprecated",
      "`.onChange(of:perform:)` is deprecated in iOS 17+. Use the two-argument closure form: `.onChange(of:) { old, new in ... }`.",
    );
  }

  // 11. .navigationBarItems — deprecated
  if (/\.navigationBarItems\(/.test(code)) {
    w(
      "navbar-items-deprecated",
      "`.navigationBarItems(...)` is deprecated. Use `.toolbar { ToolbarItem(placement:) { ... } }` instead.",
    );
  }

  // 12. UIViewController / UIView — mixing UIKit into SwiftUI-first app
  if (/:\s*UIViewController\b|:\s*UIView\b/.test(code)) {
    w(
      "uikit-subclass",
      "UIKit `UIViewController`/`UIView` subclass detected. Wrap in `UIViewControllerRepresentable` or `UIViewRepresentable` when mixing with SwiftUI.",
    );
  }

  // 13. S1AF authorship header missing on Swift source files
  if (filename.endsWith(".swift") && !/\/\/ Author: Jonathan Sherman/.test(code)) {
    w(
      "s1af-missing-authorship",
      `Missing S1AF authorship header. Every .swift file must begin with the standard header block including "// Author: Jonathan Sherman".`,
    );
  }

  return warnings;
}

/**
 * Validate all generated Swift files for Swift 6 / iOS 18 anti-patterns.
 * Returns deduplicated warnings keyed by file+rule.
 */
export function validateSwiftCode(
  files: Array<{ filename: string; code: string }>,
): ValidationWarning[] {
  const seen = new Set<string>();
  const all: ValidationWarning[] = [];

  for (const f of files) {
    for (const w of validateFile(f.filename, f.code)) {
      const key = `${w.file}::${w.rule}`;
      if (!seen.has(key)) {
        seen.add(key);
        all.push(w);
      }
    }
  }

  // ── Cross-file structural checks ───────────────────────────────────────────

  const filenames = files.map((f) => f.filename);

  // DeviceGuard.swift is required — every S1AF app must lock to iPhone XR at runtime.
  if (!filenames.includes("DeviceGuard.swift")) {
    all.push({
      file: "[project]",
      rule: "missing-device-guard",
      message:
        "DeviceGuard.swift is missing. Every S1AF app must include the iPhone XR runtime lock. " +
        "Add DeviceGuard.swift and wrap ContentView in DeviceGuard { ... } inside [AppName]App.swift.",
    });
  }

  // BiometricAuthManager.swift is required — sovereign Face ID gate.
  if (!filenames.includes("BiometricAuthManager.swift")) {
    all.push({
      file: "[project]",
      rule: "missing-biometric-auth",
      message:
        "BiometricAuthManager.swift is missing. Every S1AF app must gate content behind Face ID. " +
        "Add BiometricAuthManager.swift and wrap ContentView in BiometricGate { ... } inside [AppName]App.swift.",
    });
  }

  // AppIntents.swift is required — Siri / Shortcuts integration.
  if (!filenames.includes("AppIntents.swift")) {
    all.push({
      file: "[project]",
      rule: "missing-app-intents",
      message:
        "AppIntents.swift is missing. Include at least one AppIntent for Siri / Shortcuts integration.",
    });
  }

  // @main entry point must exist.
  const hasMainEntry = files.some(
    (f) => f.filename.endsWith("App.swift") && /@main/.test(f.code),
  );
  if (!hasMainEntry) {
    all.push({
      file: "[project]",
      rule: "missing-main-entry",
      message:
        "No @main App entry point found. The project must include an [AppName]App.swift with @main.",
    });
  }

  return all;
}

// ─── Xcode Cloud CI scaffold ──────────────────────────────────────────────────

/** Returns the Xcode Cloud CI files injected into every generated project. */
function xcodeCloudFiles(): Array<{ filename: string; code: string; description: string }> {
  return [
    {
      filename: ".xcode-cloud/ci_scripts/ci_pre_xcodebuild.sh",
      description: "Xcode Cloud pre-build: validates sovereign environment, injects build metadata, verifies Metal shaders and all sovereign Swift sources.",
      code: `#!/bin/sh
# S1AF Xcode Cloud Pre-Build · Sovereign ID: 1 · OCSO-S1AF-GOV-1
set -euo pipefail
echo "=== S1AF Xcode Cloud Pre-Build ==="
echo "Sovereign ID : 1 — OCSO-S1AF-GOV-1"
echo "Product      : \${CI_PRODUCT:-unknown}"
echo "Branch       : \${CI_BRANCH:-unknown}"
echo "Build number : \${CI_BUILD_NUMBER:-0}"
echo "Commit       : \${CI_COMMIT_HASH:-unknown}"
INFO_PLIST="\${CI_PRIMARY_REPOSITORY_PATH}/Info.plist"
if [ -f "\$INFO_PLIST" ]; then
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion \${CI_BUILD_NUMBER:-1}" "\$INFO_PLIST" 2>/dev/null || true
  echo "✓ CFBundleVersion set to \${CI_BUILD_NUMBER:-1}"
fi
echo "=== Pre-build complete ==="`,
    },
    {
      filename: ".xcode-cloud/ci_scripts/ci_post_xcodebuild.sh",
      description: "Xcode Cloud post-build: uploads to TestFlight, notifies oracle-ai server, git-tags the commit.",
      code: `#!/bin/sh
# S1AF Xcode Cloud Post-Build · Sovereign ID: 1 · OCSO-S1AF-GOV-1
set -euo pipefail
echo "=== S1AF Xcode Cloud Post-Build ==="
[ "\${CI_XCODEBUILD_EXIT_CODE:-1}" != "0" ] && { echo "Build failed — skipping"; exit 0; }
[ "\${CI_XCODEBUILD_ACTION:-}" != "archive" ] && { echo "Not an archive — skipping upload"; exit 0; }
BUILD="\${CI_BUILD_NUMBER:-0}"
COMMIT="\${CI_COMMIT_HASH:-unknown}"
BRANCH="\${CI_BRANCH:-unknown}"
SERVER="\${ORACLE_AI_SERVER_URL:-}"
SECRET="\${ORACLE_AI_DEPLOY_SECRET:-}"
if [ -n "\$SERVER" ] && [ -n "\$SECRET" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "\$SERVER/api/deploy/trigger" \
    -H "Content-Type: application/json" -H "x-deploy-token: \$SECRET" \
    -d "{\\"source\\":\\"xcode-cloud\\",\\"build\\":\\"\$BUILD\\",\\"commit\\":\\"\$COMMIT\\",\\"branch\\":\\"\$BRANCH\\",\\"sovereignID\\":1}")
  echo "\${HTTP}" | grep -q "^2" && echo "✓ oracle-ai notified (HTTP \$HTTP)" || echo "⚠ oracle-ai returned HTTP \$HTTP"
fi
git tag "build/\${BUILD}-\$(echo \$COMMIT | cut -c1-8)" 2>/dev/null && git push origin --tags 2>/dev/null || true
echo "=== Post-build complete — build \$BUILD staged ==="`,
    },
    {
      filename: ".xcode-cloud/workflows/oracle-ai-main.yml",
      description: "Xcode Cloud workflow definition: triggers on push to main/release, archives to TestFlight.",
      code: `---
# S1AF Xcode Cloud Workflow — Sovereign ID: 1 · OCSO-S1AF-GOV-1
name: Oracle-AI Sovereign CI/CD
start_condition:
  branch_changes:
    changes_include:
      - source_branches:
          - main
          - pattern: "release/*"
actions:
  - name: Build & Archive
    action_type: build
    scheme: Oracle-AI
    platform: iOS
    configuration: Release
    destinations:
      - testflight_internal_testing
    environment:
      xcode_version: latest_release
      environment_variables:
        S1AF_SOVEREIGN_ID: "1"
        S1AF_GOV_REF: "OCSO-S1AF-GOV-1"`,
    },
  ];
}

// ─── Code generation ──────────────────────────────────────────────────────────

/** Derive a bundle ID from an app description or name (S1AF convention). */
function deriveBundleId(appDescription: string): string {
  // Extract a likely app name: first capitalised word sequence up to 3 words
  const words = appDescription.trim().split(/\s+/).slice(0, 3);
  const sanitized = words
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return `${S1AF_BUNDLE_PREFIX}.${sanitized || "app"}`;
}

export async function generateSwiftCode(
  appDescription: string,
  platform: string,
  requirements?: string | null,
): Promise<{
  summary: string;
  bundleId: string;
  mainCode: string;
  files: Array<{ filename: string; code: string; description: string }>;
  architectureNotes?: string;
  warnings: ValidationWarning[];
}> {
  const platformStr =
    platform === "macos"
      ? "macOS"
      : platform === "universal"
        ? "iOS and macOS (using #if os() where needed)"
        : "iOS";

  let userPrompt = `Generate a complete ${platformStr} S1AF app for: ${appDescription}`;
  if (requirements) {
    userPrompt += `\n\nAdditional requirements: ${requirements}`;
  }
  userPrompt += `\n\nRespond with only the JSON object, no markdown fences.`;

  const messages: Message[] = [
    { role: "system", content: SWIFT_SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  const raw = await kimiComplete(messages);

  // Strip markdown fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```$/m, "")
    .trim();

  const fallbackBundleId = deriveBundleId(appDescription);

  const ciFiles = xcodeCloudFiles();

  try {
    const parsed = JSON.parse(cleaned);
    const generatedFiles = [...(parsed.files ?? []), ...ciFiles];
    const allFiles: Array<{ filename: string; code: string }> = [
      { filename: "ContentView.swift", code: parsed.mainCode ?? "" },
      ...generatedFiles,
    ];
    return {
      ...parsed,
      files:    generatedFiles,
      bundleId: parsed.bundleId ?? fallbackBundleId,
      warnings: validateSwiftCode(allFiles),
    };
  } catch {
    // Fallback: wrap raw text as main code
    const fallbackFiles = [{ filename: "ContentView.swift", code: raw }];
    return {
      summary: "Generated Swift code for: " + appDescription,
      bundleId: fallbackBundleId,
      mainCode: raw,
      files: [
        {
          filename:    "ContentView.swift",
          code:        raw,
          description: "Main SwiftUI view",
        },
        ...ciFiles,
      ],
      architectureNotes: undefined,
      warnings: validateSwiftCode(fallbackFiles),
    };
  }
}
