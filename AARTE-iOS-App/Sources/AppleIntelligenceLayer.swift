// =============================================================
// AppleIntelligenceLayer.swift
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · Celestial Core
// Sovereign ID: 1 · OCSO-S1AF-GOV-1
// =============================================================
// Apple Intelligence integration layer.
//
// Tier 1 backend for CelestialCore. Uses Apple's on-device
// Foundation Models framework (iOS 18.1+, A17 Pro+).
// On iPhone XR (A12 Bionic) this tier is skipped and
// CelestialCore falls to Core ML / Metal automatically.
//
// Covered Apple Intelligence APIs:
//   • Foundation Models — LanguageModelSession / SystemLanguageModel
//   • Writing Tools     — UIWritingToolsCoordinator
//   • App Intents       — sovereign Siri integration (SovereignAppIntents.swift)
//   • Image Playground  — ImagePlaygroundViewController (iOS 18.1+)
// =============================================================

import Foundation
import UIKit
import os.log

// Foundation Models — iOS 18.1+, A17 Pro+ only
// Wrapped in #available so the binary compiles for iOS 17 / iPhone XR.
#if canImport(FoundationModels)
import FoundationModels
#endif

/// Apple Intelligence tier for CelestialCore.
/// All public API is safe to call on any iOS 17+ device;
/// availability guards inside prevent execution on unsupported hardware.
@globalActor
actor AppleIntelligenceActor {
    static let shared = AppleIntelligenceActor()
}

@AppleIntelligenceActor
final class AppleIntelligenceLayer {

    // ── Singleton ──────────────────────────────────────────────
    static let shared = AppleIntelligenceLayer()
    private init() {}

    private let log = Logger(subsystem: "com.jonathansherman.s1af", category: "AppleIntelligence")

    // ── Hardware capability check ──────────────────────────────

    /// True only when Foundation Models is present AND the device
    /// has Apple Intelligence hardware (A17 Pro or M-series).
    static var isAvailable: Bool {
        if #available(iOS 18.1, *) {
            #if canImport(FoundationModels)
            // SystemLanguageModel.default is nil on non-AI hardware
            return SystemLanguageModel.default != nil
            #else
            return false
            #endif
        }
        return false
    }

    // ── CelestialCore inference entry ─────────────────────────

    /// Attempt Apple Intelligence inference.
    /// Returns nil if hardware/OS is incapable — CelestialCore then
    /// falls to the Core ML tier automatically.
    func infer(_ request: CelestialRequest) async throws -> CelestialOutput? {
        guard Self.isAvailable else { return nil }

        if #available(iOS 18.1, *) {
            #if canImport(FoundationModels)
            switch request.task {
            case .textGeneration(let prompt, let maxTokens):
                return try await generateText(prompt: prompt, maxTokens: maxTokens)
            case .textClassification(let text):
                return try await classifyText(text)
            case .embedding(let text):
                return try await embedText(text)
            default:
                return nil
            }
            #endif
        }
        return nil
    }

    // ── Foundation Models — text generation ───────────────────

    @available(iOS 18.1, *)
    private func generateText(prompt: String, maxTokens: Int) async throws -> CelestialOutput {
        #if canImport(FoundationModels)
        guard let model = SystemLanguageModel.default else {
            return .unavailable(reason: "Apple Intelligence model not available")
        }

        // Sovereign system instruction — injected into every session
        let systemPrompt = """
        You are operating under Celestial Core governance, Sovereign ID: 1 (Jonathan Sherman,
        OCSO-S1AF-GOV-1). All responses must respect the S1AF sovereignty framework.
        Respond accurately, concisely, and within sovereign operating parameters.
        """

        let session = LanguageModelSession(model: model)
        let options = GenerationOptions(maximumResponseTokens: maxTokens)

        var fullResponse = ""
        for try await partial in session.streamResponse(
            to: Prompt(systemPrompt + "\n\n" + prompt),
            options: options
        ) {
            fullResponse += partial
        }
        return .text(fullResponse)
        #else
        return .unavailable(reason: "FoundationModels not imported")
        #endif
    }

    // ── Foundation Models — classification ────────────────────

    @available(iOS 18.1, *)
    private func classifyText(_ text: String) async throws -> CelestialOutput {
        #if canImport(FoundationModels)
        guard let model = SystemLanguageModel.default else {
            return .unavailable(reason: "Apple Intelligence model not available")
        }
        let session = LanguageModelSession(model: model)
        let classifyPrompt = """
        Classify the following text into exactly one label from: sovereign, governance, inference, identity, unknown.
        Respond with ONLY the label and a confidence between 0.0 and 1.0, comma-separated. Example: sovereign,0.92
        Text: \(text)
        """
        let response = try await session.respond(to: Prompt(classifyPrompt))
        let parts = response.content.trimmingCharacters(in: .whitespacesAndNewlines).split(separator: ",")
        let label      = parts.first.map(String.init) ?? "unknown"
        let confidence = parts.last.flatMap { Float($0) } ?? 0.5
        return .classification(label: label, confidence: confidence)
        #else
        return .unavailable(reason: "FoundationModels not imported")
        #endif
    }

    // ── Foundation Models — embedding ─────────────────────────

    @available(iOS 18.1, *)
    private func embedText(_ text: String) async throws -> CelestialOutput {
        // Foundation Models doesn't expose raw embeddings in iOS 18.1.
        // Fall through to Core ML / Metal tier.
        return .unavailable(reason: "Raw embedding not available via Foundation Models — routed to Core ML tier")
    }
}

// ── Writing Tools integration ────────────────────────────────

/// Wraps UIWritingToolsCoordinator for sovereign text editing.
/// Attaches to any UITextView in the app to provide AI-powered
/// rewrite, proofread, and summarise actions — iOS 18+ only.
@MainActor
final class SovereignWritingTools: NSObject {

    private weak var textView: UITextView?
    private let log = Logger(subsystem: "com.jonathansherman.s1af", category: "WritingTools")

    init(attachedTo textView: UITextView) {
        self.textView = textView
        super.init()
        attach()
    }

    private func attach() {
        if #available(iOS 18.0, *) {
            // UIWritingToolsCoordinator is injected automatically by UIKit
            // when the textView has writingToolsBehavior = .default.
            // Explicit config here adds the sovereign framing.
            textView?.writingToolsBehavior = .complete
            log.info("[WritingTools] Sovereign Writing Tools attached")
        }
    }
}

// ── Image Playground ──────────────────────────────────────────

/// Presents the Apple Intelligence Image Playground sheet.
/// Sovereign context is injected as a concept so generated
/// images are framed within the S1AF visual language.
@MainActor
final class SovereignImagePlayground: NSObject {

    private let log = Logger(subsystem: "com.jonathansherman.s1af", category: "ImagePlayground")

    func present(from viewController: UIViewController, concept: String) {
        if #available(iOS 18.1, *) {
            guard let _ = NSClassFromString("ImagePlaygroundViewController") else {
                log.warning("[ImagePlayground] Not available on this hardware")
                return
            }
            // ImagePlaygroundViewController is loaded dynamically to avoid
            // compile-time dependency on the optional framework.
            let className = "ImagePlayground.ImagePlaygroundViewController"
            guard let cls = NSClassFromString(className) as? UIViewController.Type else { return }
            let vc = cls.init()
            // Pass concept via setValue — real implementation uses the typed API.
            vc.setValue("Celestial sovereign AI — \(concept)", forKey: "concept")
            viewController.present(vc, animated: true)
            log.info("[ImagePlayground] Presented for concept: \(concept)")
        } else {
            log.info("[ImagePlayground] iOS 18.1+ required")
        }
    }
}
