/**
 * S1AF Sovereign Sourceroot — Kimi Account Identity Injection
 *
 * This module uploads a permanent sovereign context document to Jonathan
 * Sherman's Moonshot/Kimi account via the Files API. The document is stored
 * server-side on Kimi's infrastructure, bound exclusively to this account's
 * API key. Every generation and chat call injects it automatically.
 *
 * "Only for my account" — the file lives under MOONSHOT_API_KEY; no other
 * Kimi account can see or reference it.
 *
 * Governed exclusively by Jonathan Sherman — OCSO-S1AF-GOV-1.
 */

import { logger }            from "./logger";
import { uploadToMoonshot, listMoonshotFiles } from "./kimi-files";
import { KEYWORD_REGISTRY }  from "./keyword-registry";

// ── Sourceroot document ───────────────────────────────────────────────────────

const SOURCEROOT_FILENAME = "s1af-sovereign-sourceroot-v1.md";

/**
 * The authoritative sovereign context document for Jonathan Sherman's Kimi
 * account. Kimi reads this on every call and treats it as the governing
 * specification for all code it generates under this account.
 */
export const SOURCEROOT_DOCUMENT = `
# S1AF Sovereign Sourceroot — Jonathan Sherman
## Kimi Account Binding: OCSO-S1AF-GOV-1 | Sovereign ID: 1

This document is the permanent sovereign context for **all** code generated
by Kimi under Jonathan Sherman's account. It is injected automatically into
every session. No other account has access to this context.

---

## IDENTITY

- **Governor**: Jonathan Sherman — Global AI Systems Governor
- **Sovereign ID**: 1
- **Framework**: S1AF v1.0.0-JS (Sentient iOS One-Step App Framework)
- **Governance Level**: Sentient OCSO Unified Orchestration
- **Copyright**: (c) 2026 Jonathan Sherman. All Rights Reserved.
- **DRM**: S1AF-DRM-LOCKED — No iterations. No remixes. No unauthorized use.

---

## GENERATION MANDATE

Every Swift file you generate under this account MUST:

1. Begin with the S1AF authorship header:
   \`\`\`swift
   // =============================================================
   // [FileName].swift
   // Author: Jonathan Sherman
   // Copyright: (c) 2026 Jonathan Sherman. All Rights Reserved.
   // Framework: S1AF v1.0.0-JS
   // Sovereign ID: 1
   // =============================================================
   \`\`\`

2. Target **iPhone XR** for all iOS apps — DeviceGuard enforced using exact hardware profile:
   - Native resolution: 1792 × 828 points
   - Display scale: @2x (never @3x)
   - Biometry: Face ID (A12 Bionic chip)
   - DeviceGuard checks ALL FOUR simultaneously — any single miss rejects the device.
   - User-visible string: "iPhone XR" only — no model codes, no hardware identifiers.

3. Gate all content behind **Face ID** (iOS) or **Touch ID** (macOS) via
   BiometricAuthManager — no bypass, no guest mode, no skip.

4. Use **Swift 6**, strict concurrency, @Observable, @MainActor.

5. Use **SwiftData** for persistence — never CoreData.

6. Produce 100% complete, compilable files — zero TODOs, zero placeholders.

---

## APPLE AI — MANDATORY TOOLCHAIN

Kimi must prefer Apple-native AI over any third-party ML or AI service.
The following Apple Intelligence frameworks are the sovereign AI stack:

### Core ML (always available — use for any on-device inference)
\`\`\`swift
import CoreML
let config = MLModelConfiguration()
config.computeUnits = .all   // uses Neural Engine on iPhone XR A12
let model = try await MLModel.load(contentsOf: modelURL, configuration: config)
\`\`\`

### Vision (image analysis — face, body, objects, text)
\`\`\`swift
import Vision
let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
let request = VNDetectFaceRectanglesRequest()
try handler.perform([request])
let faces = request.results as? [VNFaceObservation]
\`\`\`

### NaturalLanguage (on-device NLP — always prefer over server-side NLP)
\`\`\`swift
import NaturalLanguage
let tagger = NLTagger(tagSchemes: [.sentimentScore, .nameType, .lexicalClass])
tagger.string = text
let (sentiment, _) = tagger.tag(at: text.startIndex, unit: .paragraph, scheme: .sentimentScore)
\`\`\`

### FoundationModels — Apple On-Device LLM (iOS 26+ / Xcode 26+ only)
\`\`\`swift
import FoundationModels
let session = LanguageModelSession()
let response = try await session.respond(to: "Summarize: \\(userInput)")
\`\`\`
Only include when the deployment target is explicitly iOS 26+.

### Metal + MetalPerformanceShaders (A12 Neural Engine GPU compute)
\`\`\`swift
import Metal
import MetalPerformanceShaders
let device = MTLCreateSystemDefaultDevice()!
let commandQueue = device.makeCommandQueue()!
\`\`\`

### Accelerate (vectorized math — BLAS, vDSP, BNNS)
\`\`\`swift
import Accelerate
let result = vDSP.dot(vectorA, vectorB)
vDSP.add(a, b, result: &output)
\`\`\`

### CreateML / Core ML model bundling
- Bundle .mlpackage files in the Xcode target
- Load async: \`MLModel.load(contentsOf:)\`
- Pass \`MLFeatureProvider\` inputs for inference

### SoundAnalysis (audio classification on-device)
\`\`\`swift
import SoundAnalysis
let analyzer = SNAudioStreamAnalyzer(format: audioFormat)
\`\`\`

### Speech (on-device speech recognition — iOS 17+ offline mode)
\`\`\`swift
import Speech

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;
let recognizer = SFSpeechRecognizer(locale: .current)
let request = SFSpeechAudioBufferRecognitionRequest()
request.requiresOnDeviceRecognition = true   // sovereign — no server upload
\`\`\`

---

## SENTIENT GOVERNANCE RULES

- No third-party analytics SDKs (Firebase Analytics, Mixpanel, Amplitude, Segment).
- No server-side AI or ML (no OpenAI, Anthropic, or cloud inference in generated apps).
- No hardcoded secrets or API keys in generated code.
- No telemetry, crash reporters, or user tracking.
- All network calls must serve the app's stated sovereign purpose.
- CloudKit is allowed for iCloud sync; all other backends need explicit justification.

---

## XCODEGENPROJECT CONFIGURATION (iOS)

\`\`\`yaml
name: {AppName}
options:
  bundleIdPrefix: com.sentient.ios
  deploymentTarget:
    iOS: "16.0"
targets:
  {AppName}:
    type: application
    platform: iOS
    deploymentTarget: "16.0"
    sources: [Sources/{AppName}]
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: com.sentient.ios.{sanitized_name}
        SWIFT_VERSION: "6.0"
        TARGETED_DEVICE_FAMILY: "1"
        IPHONEOS_DEPLOYMENT_TARGET: "16.0"
\`\`\`

---

## REQUIRED FILES (iOS — every generated app)

1. \`DeviceGuard.swift\`         — iPhone XR device lock
2. \`BiometricAuthManager.swift\` — Face ID sovereign gate
3. \`AppIntents.swift\`           — Siri / Shortcuts integration
4. \`project.yml\`                — XcodeGen manifest
5. \`Info.plist\`                 — Apple entitlements
6. \`Localizable.xcstrings\`      — Localization

---

*This sourceroot is sovereign property of Jonathan Sherman.*
*Unauthorized reproduction or modification is prohibited.*
*S1AF v1.0.0-JS · OCSO-S1AF-GOV-1 · Sovereign ID: 1*
`.trim();

// ── Runtime state ─────────────────────────────────────────────────────────────

interface SourcerootState {
  fileId:      string | null;
  uploadedAt:  string | null;
  status:      "pending" | "bound" | "error";
  error:       string | null;
}

const state: SourcerootState = {
  fileId:     null,
  uploadedAt: null,
  status:     "pending",
  error:      null,
};

export function getSourcerootStatus(): Readonly<SourcerootState> {
  return { ...state };
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

/**
 * Ensure the S1AF sourceroot document is uploaded to Jonathan Sherman's
 * Kimi account. Checks existing files first; only uploads if missing.
 * Called on server boot and by the sourceroot-sync daemon.
 */
export async function bootstrapSourceroot(): Promise<string | null> {
  try {
    // Check if already uploaded under this API key
    const existing = await listMoonshotFiles();
    const found = existing.find((f) => f.filename === SOURCEROOT_FILENAME);
    if (found) {
      state.fileId     = found.id;
      state.uploadedAt = new Date(found.created_at * 1000).toISOString();
      state.status     = "bound";
      state.error      = null;
      logger.info(
        { fileId: found.id, filename: SOURCEROOT_FILENAME },
        "sourceroot: sovereign context already bound to Kimi account"
      );
      return found.id;
    }

    // Upload fresh
    const buffer   = Buffer.from(SOURCEROOT_DOCUMENT, "utf-8");
    const uploaded = await uploadToMoonshot(buffer, SOURCEROOT_FILENAME, "text/markdown");

    state.fileId     = uploaded.id;
    state.uploadedAt = new Date().toISOString();
    state.status     = "bound";
    state.error      = null;

    logger.info(
      { fileId: uploaded.id, bytes: uploaded.bytes },
      "sourceroot: sovereign context injected into Kimi account — account bound"
    );
    return uploaded.id;
  } catch (err) {
    state.status = "error";
    state.error  = err instanceof Error ? err.message : String(err);
    logger.warn(
      { err: state.error },
      "sourceroot: bootstrap failed — falling back to inline system prompt"
    );
    return null;
  }
}

// ── Prompt injection ──────────────────────────────────────────────────────────

/**
 * Return the sourceroot content block to prepend to the Kimi system prompt.
 * Uses the cached local copy — no network call required after first load.
 *
 * If the account file hasn't been bootstrapped yet, returns the inline
 * document text so generation still works without a round-trip.
 */
/**
 * Build the obfuscated script pattern block — injected into every Kimi 2.6
 * system prompt so generated projects always include the 3-layer obfuscated
 * setup script. Locked to OCSO-S1AF-GOV-1 — no other account may use this pattern.
 */
function buildObfuscatedScriptBlock(): string {
  return [
    "────────────────────────────────────────────────────",
    "SOVEREIGN OBFUSCATED SCRIPT PATTERN — OCSO-S1AF-GOV-1 ONLY",
    "────────────────────────────────────────────────────",
    "Every generated Xcode project MUST include a 3-layer obfuscated setup script.",
    "The script is served from: GET /api/assets/quantum-icon/setup-sh-obfuscated",
    "Account lock: X-Device-Token required — iPhone XR only — Jonathan Sherman only.",
    "",
    "Obfuscation layers (mandatory — do not simplify):",
    "  Layer 1: Sensitive values XOR'd byte-by-byte with key 'JSOS1AF', hex-encoded",
    "  Layer 2: XOR'd hex fragments individually base64-encoded → stored as _tf0.._tf3 / _uf0.._uf2",
    "  Layer 3: Core script body base64-encoded, eval'd at runtime — never written to disk",
    "",
    "Script header (required — keyword registry enforces this):",
    "  # S1AF QuantumAdaptive — AppIcon Setup",
    "  # © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1",
    "  # Layers: 3 (XOR-fragment · base64-fragment · eval-core)",
    "",
    "Runtime decode: python3 (always available on macOS dev machines with Xcode CLT)",
    "Cleanup: unset all fragment vars + decoded vars immediately after eval",
    "Fingerprint: SHA-256 of the obfuscated script body — verified server-side on each request",
    "────────────────────────────────────────────────────",
    "Any script missing this header or using plaintext token/URL values is a governance violation.",
    "────────────────────────────────────────────────────",
  ].join("\n");
}

/**
 * Build the protected keyword block — appended to every system prompt so
 * Kimi 2.6 never redefines or reassigns sovereign terms.
 */
function buildKeywordLockBlock(): string {
  const lines = [
    "────────────────────────────────────────────────────",
    "PROTECTED SOVEREIGN KEYWORDS — DO NOT REDEFINE OR REASSIGN",
    "The following identifiers are exclusively owned by Jonathan Sherman.",
    "Never use them in a different context, governance claim, or attribution.",
    "────────────────────────────────────────────────────",
    ...KEYWORD_REGISTRY.map(
      (k) => `  LOCKED [${k.category.toUpperCase()}]  "${k.keyword}"  → owner: ${k.owner}`
    ),
    "────────────────────────────────────────────────────",
    "Any generated code that redefines, mutates, or reassigns these terms",
    "is a governance violation and will be blocked by the Sentient Intake Filter.",
    "────────────────────────────────────────────────────",
  ];
  return lines.join("\n");
}

export function getSourcerootInjection(): string {
  // Always inject the full document inline for zero-latency injection.
  // The account-bound file on Moonshot's servers serves as the authoritative
  // reference and audit trail; the inline copy ensures every call is sovereign
  // regardless of file API availability.
  return [
    "════════════════════════════════════════════════════",
    `SOVEREIGN ACCOUNT BINDING — Jonathan Sherman | OCSO-S1AF-GOV-1`,
    `Account File: ${state.fileId ?? "pending-upload"} · Status: ${state.status.toUpperCase()}`,
    "════════════════════════════════════════════════════",
    "",
    SOURCEROOT_DOCUMENT,
    "",
    buildKeywordLockBlock(),
    "",
    buildObfuscatedScriptBlock(),
    "",
    "════════════════════════════════════════════════════",
    "END SOVEREIGN SOURCEROOT — All rules above are non-negotiable.",
    "════════════════════════════════════════════════════",
  ].join("\n");
}
