// =============================================================
// AIEngineTests.swift — AIEngine unit tests
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
// =============================================================

import XCTest
@testable import AARTE

final class AIEngineTests: XCTestCase {

  let engine = AIEngine.shared

  // =========================================================================
  // MARK: — BehavioralSample
  // =========================================================================

  func test_sample_toArray_returns24Elements() {
    let s = BehavioralSample()
    XCTAssertEqual(s.toArray().count, AIEngine.embeddingDimension)
  }

  func test_sample_zero_allZeroExceptCentroids() {
    let s = BehavioralSample.zero
    // touchCentroidX and Y default to 0.5, not 0
    XCTAssertEqual(s.touchCentroidX, 0.5)
    XCTAssertEqual(s.touchCentroidY, 0.5)
    XCTAssertEqual(s.gestureMeanVelocity, 0.0)
  }

  func test_sample_customValues_roundTrip() {
    var s = BehavioralSample()
    s.gestureMeanVelocity = 42.0
    s.sessionDurationSec  = 120.0
    s.idleRatio           = 0.3
    let arr = s.toArray()
    XCTAssertEqual(arr[0], 42.0)
    XCTAssertEqual(arr[6], 120.0)
    XCTAssertEqual(arr[23], 0.3)
  }

  // =========================================================================
  // MARK: — embed
  // =========================================================================

  func test_embed_returns24DimEmbedding() {
    let emb = engine.embed(.zero)
    XCTAssertEqual(emb.vector.count, AIEngine.embeddingDimension)
  }

  func test_embed_vectorIsL2Normalised() {
    let emb = engine.embed(.zero)
    let mag = sqrt(emb.vector.reduce(0) { $0 + $1 * $1 })
    // Zero vector normalises to zero — magnitude is 0, not 1
    // Any non-zero vector should be unit magnitude
    var s = BehavioralSample(); s.gestureMeanVelocity = 1.0
    let emb2 = engine.embed(s)
    let mag2 = sqrt(emb2.vector.reduce(0) { $0 + $1 * $1 })
    XCTAssertEqual(Double(mag2), 1.0, accuracy: 1e-5)
    _ = mag  // silence unused warning
  }

  func test_embed_differentSamplesDifferentEmbeddings() {
    var s1 = BehavioralSample(); s1.gestureMeanVelocity = 10.0
    var s2 = BehavioralSample(); s2.gestureMeanVelocity = 90.0
    let e1 = engine.embed(s1).vector
    let e2 = engine.embed(s2).vector
    XCTAssertNotEqual(e1, e2)
  }

  func test_embed_sameSampleProducesSameEmbedding() {
    var s = BehavioralSample()
    s.gestureMeanVelocity = 55.5
    s.sessionDurationSec  = 300.0
    let e1 = engine.embed(s).vector
    let e2 = engine.embed(s).vector
    XCTAssertEqual(e1, e2)
  }

  func test_embed_hasDeviceId() {
    let emb = engine.embed(.zero)
    XCTAssertFalse(emb.deviceId.isEmpty)
  }

  func test_embed_hasTimestamp() {
    let before = Date()
    let emb = engine.embed(.zero)
    let after  = Date()
    XCTAssertTrue(emb.capturedAt >= before)
    XCTAssertTrue(emb.capturedAt <= after)
  }

  // =========================================================================
  // MARK: — BehavioralEmbedding init
  // =========================================================================

  func test_embedding_init_preconditionDimension() {
    // Valid: 24 dims
    let valid = [Float](repeating: 0.5, count: 24)
    let emb = BehavioralEmbedding(vector: valid, deviceId: "test")
    XCTAssertEqual(emb.vector.count, 24)
  }

  func test_embedding_init_normalisesVector() {
    let raw = [Float](repeating: 1.0, count: 24)
    let emb = BehavioralEmbedding(vector: raw, deviceId: "test")
    let mag = sqrt(emb.vector.reduce(0) { $0 + $1 * $1 })
    XCTAssertEqual(Double(mag), 1.0, accuracy: 1e-5)
  }

  // =========================================================================
  // MARK: — batchEmbed
  // =========================================================================

  func test_batchEmbed_singleSample_matchesEmbed() {
    var s = BehavioralSample(); s.featureAccessRate = 5.0
    let single = engine.embed(s).vector
    let batch  = engine.batchEmbed([s]).vector
    // Both should be L2-normalised; directions should match (or be very close)
    let dot = zip(single, batch).reduce(0.0) { $0 + Double($1.0 * $1.1) }
    XCTAssertEqual(dot, 1.0, accuracy: 1e-4)
  }

  func test_batchEmbed_empty_returns24ZeroVector() {
    let emb = engine.batchEmbed([])
    XCTAssertEqual(emb.vector.count, AIEngine.embeddingDimension)
    XCTAssertEqual(emb.vector, [Float](repeating: 0, count: 24))
  }

  func test_batchEmbed_multipleSamples_is24Dim() {
    let samples = (0..<10).map { _ in BehavioralSample() }
    XCTAssertEqual(engine.batchEmbed(samples).vector.count, 24)
  }

  // =========================================================================
  // MARK: — l2Normalize helper
  // =========================================================================

  func test_l2Normalize_unitVector_unchanged() {
    var v = [Float](repeating: 0, count: 24)
    v[0] = 1.0  // already unit
    let n = l2Normalize(v)
    XCTAssertEqual(n[0], 1.0, accuracy: 1e-6)
  }

  func test_l2Normalize_zeroVector_unchanged() {
    let v = [Float](repeating: 0, count: 24)
    let n = l2Normalize(v)
    XCTAssertEqual(n, v)
  }

  func test_l2Normalize_scaledVector_becomesUnit() {
    let v = [Float](repeating: 3.0, count: 24)
    let n = l2Normalize(v)
    let mag = sqrt(n.reduce(0) { $0 + $1 * $1 })
    XCTAssertEqual(Double(mag), 1.0, accuracy: 1e-5)
  }

  // =========================================================================
  // MARK: — embeddingDimension
  // =========================================================================

  func test_embeddingDimension_is24() {
    XCTAssertEqual(AIEngine.embeddingDimension, 24)
  }
}
