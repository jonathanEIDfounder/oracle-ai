// =============================================================
// MLPipelineTests.swift — MLPipeline unit tests
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
// =============================================================

import XCTest
@testable import AARTE

final class MLPipelineTests: XCTestCase {

  // Fresh pipeline for each test to avoid cross-test contamination
  var pipeline: MLPipeline!

  override func setUp() {
    super.setUp()
    pipeline = MLPipeline()
    pipeline.k           = 3
    pipeline.minSamples  = 3
  }

  // =========================================================================
  // MARK: — Helpers
  // =========================================================================

  /// Build a deterministic BehavioralEmbedding for test isolation.
  func makeEmbedding(seed: Float) -> BehavioralEmbedding {
    var v = [Float](repeating: 0, count: 24)
    v[0] = seed; v[1] = seed * 0.5; v[2] = seed * 0.25
    return BehavioralEmbedding(vector: v, deviceId: "test-\(seed)")
  }

  // =========================================================================
  // MARK: — addSample / sampleCount
  // =========================================================================

  func test_sampleCount_startsAtZero() {
    XCTAssertEqual(pipeline.sampleCount, 0)
  }

  func test_addSample_incrementsCount() {
    pipeline.addSample(TrainingSample(embedding: makeEmbedding(seed: 1), label: .authorized))
    XCTAssertEqual(pipeline.sampleCount, 1)
  }

  func test_addSamples_batch_incrementsByBatchSize() {
    let batch = (1...5).map {
      TrainingSample(embedding: makeEmbedding(seed: Float($0)), label: .authorized)
    }
    pipeline.addSamples(batch)
    XCTAssertEqual(pipeline.sampleCount, 5)
  }

  func test_reset_clearsAllSamples() {
    pipeline.addSample(TrainingSample(embedding: makeEmbedding(seed: 1), label: .authorized))
    pipeline.reset()
    XCTAssertEqual(pipeline.sampleCount, 0)
  }

  // =========================================================================
  // MARK: — predict (below minSamples)
  // =========================================================================

  func test_predict_belowMinSamples_returnsNil() {
    // 0 samples
    XCTAssertNil(pipeline.predict(makeEmbedding(seed: 0)))
  }

  func test_predict_exactlyMinSamples_returnsResult() {
    for i in 1...3 {
      pipeline.addSample(TrainingSample(embedding: makeEmbedding(seed: Float(i)), label: .authorized))
    }
    XCTAssertNotNil(pipeline.predict(makeEmbedding(seed: 1.5)))
  }

  // =========================================================================
  // MARK: — predict (k-NN correctness)
  // =========================================================================

  func test_predict_nearestNeighbours_returnsAuthorized() {
    // Add 3 authorised samples clustered near seed=1
    for i in 1...3 {
      let emb = makeEmbedding(seed: 1.0 + Float(i) * 0.01)
      pipeline.addSample(TrainingSample(embedding: emb, label: .authorized))
    }
    // Query very close to the cluster
    let query = makeEmbedding(seed: 1.005)
    let result = pipeline.predict(query)
    XCTAssertNotNil(result)
    XCTAssertEqual(result?.label, .authorized)
  }

  func test_predict_unauthorizedCluster_returnsUnauthorized() {
    for i in 1...3 {
      let emb = makeEmbedding(seed: Float(i) * 0.01)
      pipeline.addSample(TrainingSample(embedding: emb, label: .unauthorized))
    }
    let result = pipeline.predict(makeEmbedding(seed: 0.005))
    XCTAssertEqual(result?.label, .unauthorized)
  }

  func test_predict_confidence_inRange() {
    for i in 1...5 {
      let label: IdentityLabel = i <= 3 ? .authorized : .unauthorized
      pipeline.addSample(TrainingSample(embedding: makeEmbedding(seed: Float(i)), label: label))
    }
    let result = pipeline.predict(makeEmbedding(seed: 1.5))
    if let r = result {
      XCTAssertGreaterThanOrEqual(r.confidence, 0.0)
      XCTAssertLessThanOrEqual(r.confidence, 1.0)
    }
  }

  func test_predict_nearestDist_nonNegative() {
    for i in 1...3 {
      pipeline.addSample(TrainingSample(embedding: makeEmbedding(seed: Float(i)), label: .authorized))
    }
    let result = pipeline.predict(makeEmbedding(seed: 2))
    XCTAssertGreaterThanOrEqual(result?.nearestDist ?? -1, 0.0)
  }

  // =========================================================================
  // MARK: — exportQuantumWeights
  // =========================================================================

  func test_exportWeights_belowMinSamples_returnsNil() {
    XCTAssertNil(pipeline.exportQuantumWeights())
  }

  func test_exportWeights_noAuthorizedSamples_returnsNil() {
    for i in 1...5 {
      pipeline.addSample(TrainingSample(embedding: makeEmbedding(seed: Float(i)), label: .unauthorized))
    }
    XCTAssertNil(pipeline.exportQuantumWeights())
  }

  func test_exportWeights_returns24Angles() {
    for i in 1...5 {
      pipeline.addSample(TrainingSample(embedding: makeEmbedding(seed: Float(i)), label: .authorized))
    }
    let weights = pipeline.exportQuantumWeights()
    XCTAssertNotNil(weights)
    XCTAssertEqual(weights?.ryAngles.count, AIEngine.embeddingDimension)
  }

  func test_exportWeights_anglesInValidRange() {
    for i in 1...5 {
      pipeline.addSample(TrainingSample(embedding: makeEmbedding(seed: Float(i)), label: .authorized))
    }
    guard let weights = pipeline.exportQuantumWeights() else { return }
    for θ in weights.ryAngles {
      XCTAssertGreaterThanOrEqual(θ, 0.0,     "θ must be ≥ 0")
      XCTAssertLessThanOrEqual(θ, Double.pi,  "θ must be ≤ π")
    }
  }

  func test_exportWeights_loocvAccuracy_inRange() {
    for i in 1...10 {
      let label: IdentityLabel = i <= 6 ? .authorized : .unauthorized
      pipeline.addSample(TrainingSample(embedding: makeEmbedding(seed: Float(i)), label: label))
    }
    guard let weights = pipeline.exportQuantumWeights() else { return }
    XCTAssertGreaterThanOrEqual(weights.loocvAccuracy, 0.0)
    XCTAssertLessThanOrEqual(weights.loocvAccuracy, 1.0)
  }

  func test_exportWeights_trainedOnCount_matchesSampleCount() {
    let count = 8
    for i in 1...count {
      pipeline.addSample(TrainingSample(embedding: makeEmbedding(seed: Float(i)), label: .authorized))
    }
    XCTAssertEqual(pipeline.exportQuantumWeights()?.trainedOn, count)
  }

  // =========================================================================
  // MARK: — QuantumWeights.qasmEncoding
  // =========================================================================

  func test_qasmEncoding_contains24RyGates() {
    for i in 1...5 {
      pipeline.addSample(TrainingSample(embedding: makeEmbedding(seed: Float(i)), label: .authorized))
    }
    guard let weights = pipeline.exportQuantumWeights() else { return }
    let qasm = weights.qasmEncoding()
    let ryCount = qasm.components(separatedBy: "ry(").count - 1
    XCTAssertEqual(ryCount, AIEngine.embeddingDimension)
  }

  func test_qasmEncoding_customRegister() {
    for i in 1...5 {
      pipeline.addSample(TrainingSample(embedding: makeEmbedding(seed: Float(i)), label: .authorized))
    }
    guard let weights = pipeline.exportQuantumWeights() else { return }
    let qasm = weights.qasmEncoding(register: "qr")
    XCTAssertTrue(qasm.contains("qr["))
    XCTAssertFalse(qasm.contains("q["))
  }

  // =========================================================================
  // MARK: — IdentityLabel
  // =========================================================================

  func test_identityLabel_rawValues() {
    XCTAssertEqual(IdentityLabel.authorized.rawValue,   "authorized")
    XCTAssertEqual(IdentityLabel.unauthorized.rawValue, "unauthorized")
    XCTAssertEqual(IdentityLabel.unknown.rawValue,      "unknown")
  }

  func test_identityLabel_codable() throws {
    let encoded = try JSONEncoder().encode(IdentityLabel.authorized)
    let decoded = try JSONDecoder().decode(IdentityLabel.self, from: encoded)
    XCTAssertEqual(decoded, .authorized)
  }
}
