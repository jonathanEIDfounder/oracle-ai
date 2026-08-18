// =============================================================
// QuantumBehavioralAnalysis.swift — Hybrid Classical-Quantum Scoring
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
// =============================================================
//
// Hybrid scoring (60 % classical / 40 % quantum):
//
//   classicalScore = k-NN confidence (MLPipeline)
//   quantumScore   = Hamming fidelity of quantum measurement vs reference
//   hybridScore    = 0.60 × classicalScore + 0.40 × quantumScore
//
// The quantum fidelity measures how faithfully the device's current
// behavioral state matches the quantum circuit reference identity:
//   - High fidelity → the user's behavior matches the enrolled pattern
//   - Low fidelity  → anomalous behavior detected
//
// Decision thresholds:
//   hybridScore ≥ 0.85  → AUTHORIZED
//   hybridScore ≥ 0.60  → REVIEW (escalate to Face ID re-prompt)
//   hybridScore  < 0.60 → UNAUTHORIZED (block)
// =============================================================

import Foundation

// ── Score breakdown ───────────────────────────────────────────────────────────

public struct HybridScore: Sendable {
  /// Classical k-NN confidence ∈ [0, 1].
  public let classicalScore:  Double
  /// Quantum measurement fidelity ∈ [0, 1].
  public let quantumScore:    Double
  /// Weighted hybrid: 0.60×classical + 0.40×quantum.
  public let hybridScore:     Double
  /// Final authorization decision.
  public let decision:        AuthDecision
  /// Quantum job ID (nil if quantum step was skipped).
  public let quantumJobId:    String?
  /// Backend used (nil if quantum step was skipped).
  public let quantumBackend:  QuantumBackend?
  /// Timestamp of analysis.
  public let analyzedAt:      Date

  public init(classicalScore: Double,
              quantumScore: Double,
              quantumJobId: String? = nil,
              quantumBackend: QuantumBackend? = nil) {
    self.classicalScore  = classicalScore
    self.quantumScore    = quantumScore
    self.hybridScore     = 0.60 * classicalScore + 0.40 * quantumScore
    self.decision        = AuthDecision(score: self.hybridScore)
    self.quantumJobId    = quantumJobId
    self.quantumBackend  = quantumBackend
    self.analyzedAt      = .now
  }
}

// ── Auth decision ─────────────────────────────────────────────────────────────

public enum AuthDecision: String, Sendable {
  case authorized   = "AUTHORIZED"
  case review       = "REVIEW"
  case unauthorized = "UNAUTHORIZED"

  init(score: Double) {
    if score >= 0.85 { self = .authorized }
    else if score >= 0.60 { self = .review }
    else { self = .unauthorized }
  }

  public var shouldBlock: Bool { self == .unauthorized }
  public var requiresBiometric: Bool { self == .review }
}

// ── QuantumBehavioralAnalysis ─────────────────────────────────────────────────

/// Orchestrates the classical k-NN and quantum circuit branches,
/// combines their scores, and returns a final authorization decision.
public final class QuantumBehavioralAnalysis: @unchecked Sendable {

  public static let shared = QuantumBehavioralAnalysis()
  private init() {}

  // ── Weights ───────────────────────────────────────────────────────────────
  public var classicalWeight: Double = 0.60
  public var quantumWeight:   Double = 0.40

  // Cached reference measurement (captured during enrollment)
  private var referenceOutcome: String?
  private let refLock = NSLock()

  // =========================================================================
  // MARK: — Enrollment
  // =========================================================================

  /// Run a quantum enrollment job and cache the reference outcome.
  ///
  /// Call once per device, after collecting sufficient training data.
  public func enroll(weights: QuantumWeights,
                     referenceEmbedding: BehavioralEmbedding,
                     backend: QuantumBackend) async throws {
    let measurement = try await QuantumBridge.shared.verify(
      weights: weights,
      query: referenceEmbedding,
      backend: backend,
      shots: 8192   // Higher shot count for enrollment precision
    )
    refLock.lock(); defer { refLock.unlock() }
    referenceOutcome = measurement.topOutcome
  }

  /// Set reference outcome directly (e.g., loaded from encrypted storage).
  public func setReferenceOutcome(_ outcome: String) {
    refLock.lock(); defer { refLock.unlock() }
    referenceOutcome = outcome
  }

  // =========================================================================
  // MARK: — analyze (full hybrid)
  // =========================================================================

  /// Perform a full classical-quantum behavioral analysis.
  ///
  /// Steps:
  ///   1. Classical: k-NN classify the query embedding.
  ///   2. Quantum:   Submit verification circuit; compute Hamming fidelity.
  ///   3. Combine:   60/40 weighted average.
  ///
  /// - Parameters:
  ///   - query:   Current behavioral embedding from AIEngine.
  ///   - backend: IBM Quantum backend to use.
  /// - Returns: `HybridScore` with decision.
  public func analyze(query: BehavioralEmbedding,
                      backend: QuantumBackend) async throws -> HybridScore {
    // ── Step 1: Classical k-NN ───────────────────────────────────────────────
    let knn = MLPipeline.shared.predict(query)
    let classicalScore: Double = knn.map {
      $0.label == .authorized ? $0.confidence : 1.0 - $0.confidence
    } ?? 0.5   // neutral when no training data

    // ── Step 2: Quantum circuit ──────────────────────────────────────────────
    guard let weights = MLPipeline.shared.exportQuantumWeights(),
          QuantumBridge.shared.isConfigured else {
      // Quantum unavailable — fall back to classical-only
      return HybridScore(classicalScore: classicalScore, quantumScore: classicalScore)
    }

    let measurement = try await QuantumBridge.shared.verify(
      weights: weights,
      query: query,
      backend: backend
    )

    let quantumScore = hammingFidelity(measurement: measurement)

    return HybridScore(
      classicalScore:  classicalScore,
      quantumScore:    quantumScore,
      quantumJobId:    measurement.jobId,
      quantumBackend:  backend
    )
  }

  // =========================================================================
  // MARK: — analyze (classical-only shortcut)
  // =========================================================================

  /// Fast classical-only analysis when IBM Quantum is unavailable.
  public func analyzeClassical(query: BehavioralEmbedding) -> HybridScore {
    let knn = MLPipeline.shared.predict(query)
    let classicalScore: Double = knn.map {
      $0.label == .authorized ? $0.confidence : 1.0 - $0.confidence
    } ?? 0.5
    return HybridScore(classicalScore: classicalScore,
                       quantumScore: classicalScore)
  }

  // =========================================================================
  // MARK: — Quantum fidelity
  // =========================================================================

  /// Compute Hamming fidelity between measurement and reference outcome.
  ///
  /// Fidelity = (shots where Hamming distance ≤ threshold) / total shots.
  /// Threshold = 4 bits (≤ 16 % error rate on 24 qubits).
  private func hammingFidelity(measurement: QuantumMeasurement,
                               threshold: Int = 4) -> Double {
    refLock.lock()
    let ref = referenceOutcome
    refLock.unlock()

    guard let ref else {
      // No reference enrolled — use entropy-based score
      return entropyFidelity(measurement)
    }

    let total   = Double(measurement.shots)
    var passing = 0.0
    for (bitString, count) in measurement.counts {
      let dist = hammingDistance(bitString, ref)
      if dist <= threshold { passing += Double(count) }
    }
    return total > 0 ? passing / total : 0.0
  }

  /// Fallback fidelity when no reference outcome is stored.
  /// High entropy (uniform superposition) → low fidelity (anomalous).
  /// Low entropy (peaked distribution) → high fidelity (coherent identity).
  private func entropyFidelity(_ m: QuantumMeasurement) -> Double {
    let maxEntropy = log2(Double(m.shots > 0 ? m.shots : 1))
    guard maxEntropy > 0 else { return 0.5 }
    let normalised = m.entropy / maxEntropy
    // Invert: low entropy (coherent) → high fidelity
    return 1.0 - normalised
  }

  /// Bit-level Hamming distance between two equal-length binary strings.
  private func hammingDistance(_ a: String, _ b: String) -> Int {
    let la = Array(a); let lb = Array(b)
    let len = min(la.count, lb.count)
    var dist = 0
    for i in 0..<len { if la[i] != lb[i] { dist += 1 } }
    dist += abs(la.count - lb.count)
    return dist
  }
}
