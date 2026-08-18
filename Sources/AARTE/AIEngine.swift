// =============================================================
// AIEngine.swift — AARTE On-Device Neural Engine
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
// =============================================================
//
// Runs on the A12 Bionic Neural Engine (iPhone XR).
// Produces 24-dimensional behavioral embeddings from sensor
// and interaction data without any data leaving the device.
//
// Dimension layout (24 floats, L2-normalised):
//   [0..5]   Gesture dynamics   — velocity, pressure, acceleration,
//                                 jerk, contact area, angle
//   [6..11]  Temporal patterns  — session length, inter-tap interval,
//                                 typing cadence, dwell time,
//                                 scroll frequency, pause ratio
//   [12..17] Spatial patterns   — touch centroid-X/Y, scroll amplitude,
//                                 swipe direction bias, tap clustering,
//                                 edge-touch frequency
//   [18..23] App usage          — feature access rate, nav depth,
//                                 back-gesture ratio, search frequency,
//                                 notification response latency, idle ratio
// =============================================================

#if canImport(CoreML)
import CoreML
#endif
import Foundation

// ── Types ─────────────────────────────────────────────────────────────────────

/// 24-dimensional behavioral embedding produced by the Neural Engine.
public struct BehavioralEmbedding: Sendable {
  /// Raw 24-float vector (L2-normalised to unit sphere).
  public let vector: [Float]
  /// Device that produced this embedding.
  public let deviceId: String
  /// Wall-clock timestamp of embedding creation.
  public let capturedAt: Date

  public init(vector: [Float], deviceId: String, capturedAt: Date = .now) {
    precondition(vector.count == AIEngine.embeddingDimension,
                 "Embedding must be \(AIEngine.embeddingDimension)-dimensional")
    self.vector     = l2Normalize(vector)
    self.deviceId   = deviceId
    self.capturedAt = capturedAt
  }
}

/// Raw sensor snapshot fed into the Neural Engine.
public struct BehavioralSample: Sendable {
  // Gesture dynamics
  public var gestureMeanVelocity:     Float  // pts/s
  public var gestureMeanPressure:     Float  // 0–1 (Force Touch or capacitive area)
  public var gestureMeanAcceleration: Float  // pts/s²
  public var gestureJerk:             Float  // d³/dt³ position
  public var gestureContactArea:      Float  // normalised 0–1
  public var gestureAngleBias:        Float  // dominant stroke angle, radians
  // Temporal patterns
  public var sessionDurationSec:      Float
  public var interTapIntervalMs:      Float  // mean
  public var typingCadenceHz:         Float
  public var dwellTimeMs:             Float  // mean key/button dwell
  public var scrollFrequencyHz:       Float
  public var pauseRatio:              Float  // fraction of session in pause
  // Spatial patterns
  public var touchCentroidX:          Float  // normalised 0–1
  public var touchCentroidY:          Float  // normalised 0–1
  public var scrollAmplitudePts:      Float
  public var swipeDirectionBias:      Float  // +1 = rightward, -1 = leftward
  public var tapClusteringCoeff:      Float  // 0–1 (1 = all taps in one region)
  public var edgeTouchFrequency:      Float  // touches per second near edge
  // App usage
  public var featureAccessRate:       Float  // unique features/min
  public var navigationDepth:         Float  // mean stack depth
  public var backGestureRatio:        Float  // back gestures / total nav events
  public var searchFrequency:         Float  // searches/session
  public var notificationResponseMs:  Float  // mean response latency
  public var idleRatio:               Float  // fraction of time idle

  public static var zero: BehavioralSample { .init() }

  public init(
    gestureMeanVelocity:     Float = 0,
    gestureMeanPressure:     Float = 0,
    gestureMeanAcceleration: Float = 0,
    gestureJerk:             Float = 0,
    gestureContactArea:      Float = 0,
    gestureAngleBias:        Float = 0,
    sessionDurationSec:      Float = 0,
    interTapIntervalMs:      Float = 0,
    typingCadenceHz:         Float = 0,
    dwellTimeMs:             Float = 0,
    scrollFrequencyHz:       Float = 0,
    pauseRatio:              Float = 0,
    touchCentroidX:          Float = 0.5,
    touchCentroidY:          Float = 0.5,
    scrollAmplitudePts:      Float = 0,
    swipeDirectionBias:      Float = 0,
    tapClusteringCoeff:      Float = 0,
    edgeTouchFrequency:      Float = 0,
    featureAccessRate:       Float = 0,
    navigationDepth:         Float = 0,
    backGestureRatio:        Float = 0,
    searchFrequency:         Float = 0,
    notificationResponseMs:  Float = 0,
    idleRatio:               Float = 0
  ) {
    self.gestureMeanVelocity     = gestureMeanVelocity
    self.gestureMeanPressure     = gestureMeanPressure
    self.gestureMeanAcceleration = gestureMeanAcceleration
    self.gestureJerk             = gestureJerk
    self.gestureContactArea      = gestureContactArea
    self.gestureAngleBias        = gestureAngleBias
    self.sessionDurationSec      = sessionDurationSec
    self.interTapIntervalMs      = interTapIntervalMs
    self.typingCadenceHz         = typingCadenceHz
    self.dwellTimeMs             = dwellTimeMs
    self.scrollFrequencyHz       = scrollFrequencyHz
    self.pauseRatio              = pauseRatio
    self.touchCentroidX          = touchCentroidX
    self.touchCentroidY          = touchCentroidY
    self.scrollAmplitudePts      = scrollAmplitudePts
    self.swipeDirectionBias      = swipeDirectionBias
    self.tapClusteringCoeff      = tapClusteringCoeff
    self.edgeTouchFrequency      = edgeTouchFrequency
    self.featureAccessRate       = featureAccessRate
    self.navigationDepth         = navigationDepth
    self.backGestureRatio        = backGestureRatio
    self.searchFrequency         = searchFrequency
    self.notificationResponseMs  = notificationResponseMs
    self.idleRatio               = idleRatio
  }

  /// Flatten to [Float] in canonical dimension order.
  public func toArray() -> [Float] {
    [
      gestureMeanVelocity, gestureMeanPressure, gestureMeanAcceleration,
      gestureJerk, gestureContactArea, gestureAngleBias,
      sessionDurationSec, interTapIntervalMs, typingCadenceHz,
      dwellTimeMs, scrollFrequencyHz, pauseRatio,
      touchCentroidX, touchCentroidY, scrollAmplitudePts,
      swipeDirectionBias, tapClusteringCoeff, edgeTouchFrequency,
      featureAccessRate, navigationDepth, backGestureRatio,
      searchFrequency, notificationResponseMs, idleRatio,
    ]
  }
}

// ── L2 normalisation ──────────────────────────────────────────────────────────

func l2Normalize(_ v: [Float]) -> [Float] {
  let mag = sqrt(v.reduce(0) { $0 + $1 * $1 })
  guard mag > 1e-9 else { return v }
  return v.map { $0 / mag }
}

// ── AIEngine ──────────────────────────────────────────────────────────────────

/// Singleton inference engine — produces 24-dim behavioral embeddings.
///
/// On Apple silicon the embedding is computed by a Core ML model deployed
/// to the A12 (or later) Neural Engine.  On Linux (CI / server), a
/// heuristic projection is used so the SPM package compiles cross-platform.
public final class AIEngine: @unchecked Sendable {

  public static let shared = AIEngine()
  private init() { loadModelIfAvailable() }

  /// Canonical embedding dimension — never changes.
  public static let embeddingDimension = 24

  // ── Core ML model handle (nil on Linux) ──────────────────────────────────
#if canImport(CoreML)
  private var mlModel: MLModel?
#endif

  private func loadModelIfAvailable() {
#if canImport(CoreML)
    // Model bundle is embedded inside the app target.
    // Name: BehavioralEncoder.mlmodelc (compiled at build time).
    guard let url = Bundle.main.url(forResource: "BehavioralEncoder",
                                    withExtension: "mlmodelc") else { return }
    mlModel = try? MLModel(contentsOf: url,
                           configuration: {
                             let cfg = MLModelConfiguration()
                             cfg.computeUnits = .cpuAndNeuralEngine   // A12 NE
                             return cfg
                           }())
#endif
  }

  // =========================================================================
  // MARK: — embed
  // =========================================================================

  /// Convert a raw behavioral sample into a 24-dim unit embedding.
  ///
  /// - Parameter sample: Sensor and interaction snapshot.
  /// - Returns: L2-normalised 24-float embedding.
  public func embed(_ sample: BehavioralSample) -> BehavioralEmbedding {
    let raw = sample.toArray()
    precondition(raw.count == Self.embeddingDimension)

#if canImport(CoreML)
    if let model = mlModel, let out = runCoreML(model: model, input: raw) {
      logInferencePath("Neural Engine (BehavioralEncoder.mlmodelc)")
      return BehavioralEmbedding(vector: out,
                                 deviceId: deviceIdentifier())
    }
#endif
    // Heuristic fallback (deterministic, no model required)
    logInferencePath("Heuristic (no model bundle — run scripts/train-behavioral-encoder.py)")
    return BehavioralEmbedding(vector: heuristicEmbed(raw),
                               deviceId: deviceIdentifier())
  }

  // =========================================================================
  // MARK: — batchEmbed
  // =========================================================================

  /// Embed multiple samples and return the centroid embedding.
  public func batchEmbed(_ samples: [BehavioralSample]) -> BehavioralEmbedding {
    guard !samples.isEmpty else {
      return BehavioralEmbedding(vector: [Float](repeating: 0,
                                                count: Self.embeddingDimension),
                                 deviceId: deviceIdentifier())
    }
    let vecs = samples.map { embed($0).vector }
    var centroid = [Float](repeating: 0, count: Self.embeddingDimension)
    for v in vecs {
      for i in 0..<Self.embeddingDimension { centroid[i] += v[i] }
    }
    let n = Float(vecs.count)
    centroid = centroid.map { $0 / n }
    return BehavioralEmbedding(vector: centroid, deviceId: deviceIdentifier())
  }

  // =========================================================================
  // MARK: — Private helpers
  // =========================================================================

#if canImport(CoreML)
  private func runCoreML(model: MLModel, input: [Float]) -> [Float]? {
    // The BehavioralEncoder model accepts a 24-float MultiArray named "input"
    // and produces a 24-float MultiArray named "embedding".
    guard let inputArr = try? MLMultiArray(shape: [24], dataType: .float32) else { return nil }
    for (i, v) in input.enumerated() { inputArr[i] = NSNumber(value: v) }
    let provider = try? MLDictionaryFeatureProvider(dictionary: ["input": inputArr])
    guard let fp = provider,
          let result = try? model.prediction(from: fp),
          let outArr = result.featureValue(for: "embedding")?.multiArrayValue
    else { return nil }
    return (0..<24).map { outArr[$0].floatValue }
  }
#endif

  /// Deterministic heuristic embedding (used when Core ML model is absent).
  /// Applies a fixed Hadamard-like mixing across dimensions.
  private func heuristicEmbed(_ v: [Float]) -> [Float] {
    var out = [Float](repeating: 0, count: Self.embeddingDimension)
    let n = Self.embeddingDimension
    for i in 0..<n {
      var acc: Float = 0
      for j in 0..<n {
        let angle = Float.pi * Float(i * j) / Float(n)
        acc += v[j] * cos(angle)
      }
      out[i] = acc / Float(n)
    }
    return out
  }

  // Log the active inference path once per session.
  private var _didLogPath = false
  private func logInferencePath(_ path: String) {
    guard !_didLogPath else { return }
    _didLogPath = true
    print("[AARTE] Inference path: \(path)")
  }

  private func deviceIdentifier() -> String {
#if canImport(UIKit)
    return UIDevice.current.identifierForVendor?.uuidString ?? "unknown"
#else
    return ProcessInfo.processInfo.hostName
#endif
  }
}
