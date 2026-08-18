// =============================================================
// MLPipeline.swift — AARTE On-Device Training & k-NN Classifier
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
// =============================================================
//
// On-device training pipeline:
//   1. Collect labeled BehavioralEmbedding samples
//   2. Train a k-NN classifier (cosine distance, k=5)
//   3. Export weights as normalised [Float] arrays suitable for
//      quantum amplitude encoding in QuantumBridge
//
// The model never leaves the device — weights are exported only
// as rotation angles (θ ∈ [0, π]) for QASM 3.0 Ry gates.
// =============================================================

import Foundation

// ── Label ─────────────────────────────────────────────────────────────────────

/// Identity label attached to a behavioral embedding during training.
public enum IdentityLabel: String, Sendable, Codable {
  case authorized   = "authorized"
  case unauthorized = "unauthorized"
  case unknown      = "unknown"
}

// ── Training sample ───────────────────────────────────────────────────────────

public struct TrainingSample: Sendable {
  public let embedding: BehavioralEmbedding
  public let label:     IdentityLabel
  public init(embedding: BehavioralEmbedding, label: IdentityLabel) {
    self.embedding = embedding
    self.label     = label
  }
}

// ── k-NN result ───────────────────────────────────────────────────────────────

public struct KNNResult: Sendable {
  public let label:       IdentityLabel
  /// Confidence in [0, 1] — fraction of k neighbours sharing `label`.
  public let confidence:  Double
  /// Cosine distance to the nearest training sample.
  public let nearestDist: Double
}

// ── Quantum weight export ─────────────────────────────────────────────────────

/// Rotation angles (θ) for Ry gates, one per embedding dimension.
/// θ = arccos(w) where w is the normalised weight value in [−1, 1].
public struct QuantumWeights: Sendable {
  /// 24 Ry rotation angles in [0, π].
  public let ryAngles: [Double]
  /// Training set size at export time.
  public let trainedOn: Int
  /// Accuracy on the training set (leave-one-out cross-validation).
  public let loocvAccuracy: Double

  /// QASM 3.0 snippet that encodes these weights via Ry gates.
  public func qasmEncoding(register: String = "q") -> String {
    ryAngles.enumerated().map { i, θ in
      String(format: "ry(%.8f) \(register)[\(i)];", θ)
    }.joined(separator: "\n")
  }
}

// ── MLPipeline ────────────────────────────────────────────────────────────────

/// On-device k-NN training pipeline with quantum weight export.
public final class MLPipeline: @unchecked Sendable {

  public static let shared = MLPipeline()
  private init() {}

  // ── Hyper-parameters ──────────────────────────────────────────────────────
  public var k: Int    = 5      // k-NN neighbours
  public var minSamples: Int = 10  // minimum before predictions are trusted

  // ── Training store (in-memory; persisted separately by the caller) ─────
  private var samples: [TrainingSample] = []
  private let lock = NSLock()

  // =========================================================================
  // MARK: — addSample
  // =========================================================================

  /// Add a labeled embedding to the training set.
  public func addSample(_ sample: TrainingSample) {
    lock.lock(); defer { lock.unlock() }
    samples.append(sample)
  }

  public func addSamples(_ batch: [TrainingSample]) {
    lock.lock(); defer { lock.unlock() }
    samples.append(contentsOf: batch)
  }

  /// Clear all training data (e.g., after device transfer).
  public func reset() {
    lock.lock(); defer { lock.unlock() }
    samples = []
  }

  public var sampleCount: Int {
    lock.lock(); defer { lock.unlock() }
    return samples.count
  }

  // =========================================================================
  // MARK: — predict
  // =========================================================================

  /// Classify a query embedding using cosine k-NN.
  ///
  /// - Returns: `nil` when fewer than `minSamples` are available.
  public func predict(_ query: BehavioralEmbedding) -> KNNResult? {
    lock.lock()
    let snap = samples
    lock.unlock()
    guard snap.count >= minSamples else { return nil }

    // Compute cosine distance to all training samples
    var dists: [(dist: Double, label: IdentityLabel)] = snap.map { s in
      let d = cosineDistance(query.vector, s.embedding.vector)
      return (d, s.label)
    }
    dists.sort { $0.dist < $1.dist }
    let neighbours = Array(dists.prefix(k))

    // Majority vote
    var votes: [IdentityLabel: Int] = [:]
    for n in neighbours { votes[n.label, default: 0] += 1 }
    let winner = votes.max(by: { $0.value < $1.value })!
    let confidence = Double(winner.value) / Double(k)
    let nearestDist = neighbours.first?.dist ?? 1.0

    return KNNResult(label: winner.key,
                     confidence: confidence,
                     nearestDist: nearestDist)
  }

  // =========================================================================
  // MARK: — exportQuantumWeights
  // =========================================================================

  /// Compute quantum weights from the current training set.
  ///
  /// Algorithm:
  ///   1. Compute per-class centroid embeddings (authorised vs not).
  ///   2. Take the authorised centroid as the "canonical" identity vector.
  ///   3. Map each dimension w ∈ [−1, 1] to θ = arccos(w) ∈ [0, π].
  ///   4. Estimate LOOCV accuracy for quality reporting.
  ///
  /// - Returns: `nil` when fewer than `minSamples` training points exist.
  public func exportQuantumWeights() -> QuantumWeights? {
    lock.lock()
    let snap = samples
    lock.unlock()
    guard snap.count >= minSamples else { return nil }

    let authorised = snap.filter { $0.label == .authorized }.map { $0.embedding.vector }
    guard !authorised.isEmpty else { return nil }

    // Centroid of authorised embeddings
    var centroid = [Float](repeating: 0, count: AIEngine.embeddingDimension)
    for v in authorised {
      for i in 0..<AIEngine.embeddingDimension { centroid[i] += v[i] }
    }
    let n = Float(authorised.count)
    centroid = centroid.map { $0 / n }
    centroid = l2Normalize(centroid)

    // Map to Ry angles: clamp to [-1,1] before arccos
    let ryAngles: [Double] = centroid.map { w in
      let clamped = Double(min(max(w, -1), 1))
      return acos(clamped)  // ∈ [0, π]
    }

    // Leave-one-out cross-validation accuracy
    let loocv = leaveOneOutAccuracy(snap)

    return QuantumWeights(ryAngles: ryAngles,
                          trainedOn: snap.count,
                          loocvAccuracy: loocv)
  }

  // =========================================================================
  // MARK: — Private helpers
  // =========================================================================

  /// Cosine distance ∈ [0, 2] (0 = identical, 2 = opposite).
  private func cosineDistance(_ a: [Float], _ b: [Float]) -> Double {
    precondition(a.count == b.count)
    var dot: Float = 0; var magA: Float = 0; var magB: Float = 0
    for i in 0..<a.count {
      dot  += a[i] * b[i]
      magA += a[i] * a[i]
      magB += b[i] * b[i]
    }
    let denom = sqrt(magA) * sqrt(magB)
    guard denom > 1e-9 else { return 1.0 }
    return Double(1.0 - dot / denom)
  }

  /// Estimate accuracy via leave-one-out cross-validation.
  private func leaveOneOutAccuracy(_ data: [TrainingSample]) -> Double {
    guard data.count > 1 else { return 1.0 }
    var correct = 0
    for i in 0..<data.count {
      var leave = data; leave.remove(at: i)
      var dists: [(dist: Double, label: IdentityLabel)] = leave.map { s in
        let d = cosineDistance(data[i].embedding.vector, s.embedding.vector)
        return (d, s.label)
      }
      dists.sort { $0.dist < $1.dist }
      let neighbours = Array(dists.prefix(k))
      var votes: [IdentityLabel: Int] = [:]
      for n in neighbours { votes[n.label, default: 0] += 1 }
      let predicted = votes.max(by: { $0.value < $1.value })!.key
      if predicted == data[i].label { correct += 1 }
    }
    return Double(correct) / Double(data.count)
  }
}
