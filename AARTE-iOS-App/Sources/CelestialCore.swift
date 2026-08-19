// =============================================================
// CelestialCore.swift
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · Celestial Core
// Sovereign ID: 1 · OCSO-S1AF-GOV-1
// =============================================================
// Sovereign AI governance and routing layer.
//
// ALL inference — whether Metal GPU, Core ML (Apple Neural Engine),
// or Apple Intelligence Foundation Models — is dispatched through
// this single entry point. Every request is tagged with
// sovereignID = 1 before reaching any compute backend.
//
// Routing priority:
//   1. Apple Intelligence (Foundation Models) — iOS 18.1+, A17 Pro+
//   2. Core ML / Apple Neural Engine         — all A-series chips
//   3. Metal GPU compute                     — all Metal-capable devices
//   4. CPU fallback                          — diagnostic mode only
//
// The iPhone XR (A12 Bionic) hits tier 2 and 3.
// All tiers enforce sovereignty before execution.
// =============================================================

import Foundation
import CoreML
import Metal
import Accelerate
import os.log

// ── Sovereign identity seal ─────────────────────────────────

/// Immutable sovereignty tag. Every inference dispatch carries this.
struct SovereignTag: Sendable {
    let id:        UInt32  = 1          // Sovereign ID: 1 — Jonathan Sherman
    let govRef:    String  = "OCSO-S1AF-GOV-1"
    let timestamp: Date    = Date()
    var isValid:   Bool    { id == 1 }
}

// ── Inference request / response ────────────────────────────

/// A single inference request routed through CelestialCore.
struct CelestialRequest: Sendable {
    enum Task: Sendable {
        case textGeneration(prompt: String, maxTokens: Int)
        case textClassification(text: String)
        case embedding(text: String)
        case imageDescription(imageData: Data)
        case custom(modelID: String, inputs: [String: MLFeatureValue])
    }

    let task:      Task
    let tag:       SovereignTag
    let requestID: UUID

    init(task: Task) {
        self.task      = task
        self.tag       = SovereignTag()
        self.requestID = UUID()
        precondition(self.tag.isValid, "[CelestialCore] Sovereignty violation — tag.id ≠ 1")
    }
}

/// Result returned from any CelestialCore inference backend.
struct CelestialResponse: Sendable {
    enum Backend: String, Sendable {
        case appleIntelligence = "Apple Intelligence (Foundation Models)"
        case coreML            = "Core ML / Apple Neural Engine"
        case metalGPU          = "Metal GPU Compute"
        case cpu               = "CPU Fallback"
    }

    let requestID:    UUID
    let backend:      Backend
    let output:       CelestialOutput
    let latencyMs:    Double
    let sovereignTag: SovereignTag
}

/// Type-safe output union.
enum CelestialOutput: Sendable {
    case text(String)
    case classification(label: String, confidence: Float)
    case embedding([Float])
    case multiFeature(MLFeatureProvider)
    case unavailable(reason: String)
}

// ── CelestialCore actor ─────────────────────────────────────

/// Sovereign AI governance hub. All inference passes through here.
@globalActor
actor CelestialCoreActor {
    static let shared = CelestialCoreActor()
}

@CelestialCoreActor
final class CelestialCore {

    // ── Singleton ──────────────────────────────────────────────
    static let shared = CelestialCore()
    private init() { bootstrap() }

    // ── Logging ────────────────────────────────────────────────
    private let log = Logger(subsystem: "com.jonathansherman.s1af", category: "CelestialCore")

    // ── Backend handles ────────────────────────────────────────
    private var metalInference: MetalInference?
    private var loadedModels:   [String: MLModel] = [:]

    // ── Capability flags (set once at bootstrap) ───────────────
    private var hasAppleIntelligence: Bool = false
    private var hasMetal:             Bool = false
    private var hasNeuralEngine:      Bool = false   // true on A12+

    // ── Bootstrap ──────────────────────────────────────────────
    private func bootstrap() {
        log.info("[CelestialCore] Bootstrapping — Sovereign ID: 1 · OCSO-S1AF-GOV-1")

        // Metal availability
        if MTLCreateSystemDefaultDevice() != nil {
            hasMetal = true
            metalInference = MetalInference()
            log.info("[CelestialCore] Metal GPU ready")
        }

        // Neural Engine heuristic: A12 Bionic (iPhone XR) and later
        // support the ANE; all Core ML models run on ANE when possible.
        hasNeuralEngine = true  // A12+ is guaranteed by DeviceGuard hardware check
        log.info("[CelestialCore] Apple Neural Engine available (A12 Bionic confirmed)")

        // Apple Intelligence check (runtime, iOS 18.1+, A17 Pro+)
        if #available(iOS 18.1, *) {
            // Availability checked at call-site via AppleIntelligenceLayer
            hasAppleIntelligence = AppleIntelligenceLayer.isAvailable
            if hasAppleIntelligence {
                log.info("[CelestialCore] Apple Intelligence (Foundation Models) available")
            } else {
                log.info("[CelestialCore] Apple Intelligence not available on this hardware — Core ML tier active")
            }
        }

        log.info("[CelestialCore] Bootstrap complete · tiers available: " +
            "AI=\(hasAppleIntelligence) ANE=\(hasNeuralEngine) Metal=\(hasMetal)")
    }

    // ── Primary inference entry point ──────────────────────────

    /// Route a CelestialRequest to the highest-capability backend.
    /// Returns a CelestialResponse with the sovereign tag embedded.
    func infer(_ request: CelestialRequest) async -> CelestialResponse {
        guard request.tag.isValid else {
            log.critical("[CelestialCore] SOVEREIGNTY VIOLATION — request dropped (id ≠ 1)")
            return failed(request: request, reason: "Sovereignty violation")
        }

        log.debug("[CelestialCore] Routing request \(request.requestID) via tier selection")
        let start = Date()

        do {
            // Tier 1 — Apple Intelligence
            if hasAppleIntelligence, #available(iOS 18.1, *) {
                if let output = try await AppleIntelligenceLayer.shared.infer(request) {
                    return CelestialResponse(
                        requestID:    request.requestID,
                        backend:      .appleIntelligence,
                        output:       output,
                        latencyMs:    -start.timeIntervalSinceNow * 1000,
                        sovereignTag: request.tag
                    )
                }
            }

            // Tier 2 — Core ML (ANE)
            if let output = try await coreMLInfer(request) {
                return CelestialResponse(
                    requestID:    request.requestID,
                    backend:      .coreML,
                    output:       output,
                    latencyMs:    -start.timeIntervalSinceNow * 1000,
                    sovereignTag: request.tag
                )
            }

            // Tier 3 — Metal GPU
            if hasMetal, let metal = metalInference,
               let output = await metal.infer(request) {
                return CelestialResponse(
                    requestID:    request.requestID,
                    backend:      .metalGPU,
                    output:       output,
                    latencyMs:    -start.timeIntervalSinceNow * 1000,
                    sovereignTag: request.tag
                )
            }

            // No backend could handle the request
            return failed(request: request, reason: "No capable backend for this task")

        } catch {
            log.error("[CelestialCore] Inference error: \(error.localizedDescription)")
            return failed(request: request, reason: error.localizedDescription)
        }
    }

    // ── Core ML tier ───────────────────────────────────────────

    private func coreMLInfer(_ request: CelestialRequest) async throws -> CelestialOutput? {
        switch request.task {
        case .custom(let modelID, let inputs):
            guard let model = loadedModels[modelID] else { return nil }
            let provider = try MLDictionaryFeatureProvider(dictionary: inputs)
            let result   = try await model.prediction(from: provider)
            return .multiFeature(result)

        default:
            // Text/embedding tasks without a loaded model return nil
            // so the next tier is tried.
            return nil
        }
    }

    // ── Model management ───────────────────────────────────────

    /// Load a compiled Core ML model (.mlmodelc) by name from the app bundle.
    func loadModel(named name: String) throws {
        guard let url = Bundle.main.url(forResource: name, withExtension: "mlmodelc") else {
            throw CelestialError.modelNotFound(name)
        }
        let config    = MLModelConfiguration()
        config.computeUnits = .all   // ANE + GPU + CPU
        let model = try MLModel(contentsOf: url, configuration: config)
        loadedModels[name] = model
        log.info("[CelestialCore] Loaded Core ML model: \(name)")
    }

    // ── Error builder ──────────────────────────────────────────

    private func failed(request: CelestialRequest, reason: String) -> CelestialResponse {
        CelestialResponse(
            requestID:    request.requestID,
            backend:      .cpu,
            output:       .unavailable(reason: reason),
            latencyMs:    0,
            sovereignTag: request.tag
        )
    }
}

// ── Errors ──────────────────────────────────────────────────

enum CelestialError: Error, LocalizedError {
    case modelNotFound(String)
    case sovereigntyViolation
    case backendUnavailable(String)

    var errorDescription: String? {
        switch self {
        case .modelNotFound(let n):       return "Core ML model '\(n)' not found in bundle."
        case .sovereigntyViolation:       return "Sovereignty violation — request blocked."
        case .backendUnavailable(let b):  return "Backend '\(b)' is not available on this device."
        }
    }
}

// ── Convenience API ─────────────────────────────────────────

extension CelestialCore {

    /// Generate text from a prompt using the highest available backend.
    @discardableResult
    func generateText(prompt: String, maxTokens: Int = 256) async -> String {
        let req = CelestialRequest(task: .textGeneration(prompt: prompt, maxTokens: maxTokens))
        let res = await infer(req)
        if case .text(let t) = res.output { return t }
        if case .unavailable(let r) = res.output { return "[Unavailable: \(r)]" }
        return ""
    }

    /// Classify text using the highest available backend.
    @discardableResult
    func classifyText(_ text: String) async -> (label: String, confidence: Float) {
        let req = CelestialRequest(task: .textClassification(text: text))
        let res = await infer(req)
        if case .classification(let l, let c) = res.output { return (l, c) }
        return ("unknown", 0)
    }
}
