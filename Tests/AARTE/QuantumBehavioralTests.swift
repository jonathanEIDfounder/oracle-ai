// =============================================================
// QuantumBehavioralTests.swift — QuantumBehavioralAnalysis tests
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
// =============================================================

import XCTest
@testable import AARTE

final class QuantumBehavioralTests: XCTestCase {

  let analysis = QuantumBehavioralAnalysis.shared

  // =========================================================================
  // MARK: — HybridScore
  // =========================================================================

  func test_hybridScore_formula_60_40_split() {
    let s = HybridScore(classicalScore: 1.0, quantumScore: 0.0)
    XCTAssertEqual(s.hybridScore, 0.60, accuracy: 1e-9)
  }

  func test_hybridScore_both100_gives100() {
    let s = HybridScore(classicalScore: 1.0, quantumScore: 1.0)
    XCTAssertEqual(s.hybridScore, 1.0, accuracy: 1e-9)
  }

  func test_hybridScore_both0_gives0() {
    let s = HybridScore(classicalScore: 0.0, quantumScore: 0.0)
    XCTAssertEqual(s.hybridScore, 0.0, accuracy: 1e-9)
  }

  func test_hybridScore_mixed_correctWeighting() {
    // 0.60 × 0.8 + 0.40 × 0.5 = 0.48 + 0.20 = 0.68
    let s = HybridScore(classicalScore: 0.8, quantumScore: 0.5)
    XCTAssertEqual(s.hybridScore, 0.68, accuracy: 1e-9)
  }

  func test_hybridScore_quantumJobId_stored() {
    let s = HybridScore(classicalScore: 0.9, quantumScore: 0.9,
                         quantumJobId: "job-abc-123")
    XCTAssertEqual(s.quantumJobId, "job-abc-123")
  }

  func test_hybridScore_quantumBackend_stored() {
    let s = HybridScore(classicalScore: 0.9, quantumScore: 0.9,
                         quantumBackend: .ibmSherbrooke)
    XCTAssertEqual(s.quantumBackend, .ibmSherbrooke)
  }

  func test_hybridScore_hasTimestamp() {
    let before = Date()
    let s = HybridScore(classicalScore: 0.5, quantumScore: 0.5)
    let after = Date()
    XCTAssertGreaterThanOrEqual(s.analyzedAt, before)
    XCTAssertLessThanOrEqual(s.analyzedAt, after)
  }

  // =========================================================================
  // MARK: — AuthDecision
  // =========================================================================

  func test_authDecision_authorized_atExactly085() {
    let d = AuthDecision(score: 0.85)
    XCTAssertEqual(d, .authorized)
  }

  func test_authDecision_authorized_above085() {
    XCTAssertEqual(AuthDecision(score: 1.00), .authorized)
    XCTAssertEqual(AuthDecision(score: 0.90), .authorized)
  }

  func test_authDecision_review_range() {
    XCTAssertEqual(AuthDecision(score: 0.84), .review)
    XCTAssertEqual(AuthDecision(score: 0.60), .review)
    XCTAssertEqual(AuthDecision(score: 0.70), .review)
  }

  func test_authDecision_unauthorized_below060() {
    XCTAssertEqual(AuthDecision(score: 0.59), .unauthorized)
    XCTAssertEqual(AuthDecision(score: 0.00), .unauthorized)
  }

  func test_authDecision_shouldBlock() {
    XCTAssertTrue(AuthDecision.unauthorized.shouldBlock)
    XCTAssertFalse(AuthDecision.authorized.shouldBlock)
    XCTAssertFalse(AuthDecision.review.shouldBlock)
  }

  func test_authDecision_requiresBiometric() {
    XCTAssertTrue(AuthDecision.review.requiresBiometric)
    XCTAssertFalse(AuthDecision.authorized.requiresBiometric)
    XCTAssertFalse(AuthDecision.unauthorized.requiresBiometric)
  }

  func test_authDecision_rawValues() {
    XCTAssertEqual(AuthDecision.authorized.rawValue,   "AUTHORIZED")
    XCTAssertEqual(AuthDecision.review.rawValue,       "REVIEW")
    XCTAssertEqual(AuthDecision.unauthorized.rawValue, "UNAUTHORIZED")
  }

  // =========================================================================
  // MARK: — HybridScore decision mapping
  // =========================================================================

  func test_hybridScore_decision_authorized_at085() {
    let s = HybridScore(classicalScore: 0.85, quantumScore: 0.85)
    // 0.60×0.85 + 0.40×0.85 = 0.85 → authorized
    XCTAssertEqual(s.decision, .authorized)
  }

  func test_hybridScore_decision_review_at070() {
    let s = HybridScore(classicalScore: 0.70, quantumScore: 0.70)
    XCTAssertEqual(s.decision, .review)
  }

  func test_hybridScore_decision_unauthorized_at040() {
    let s = HybridScore(classicalScore: 0.40, quantumScore: 0.40)
    XCTAssertEqual(s.decision, .unauthorized)
  }

  // =========================================================================
  // MARK: — setReferenceOutcome
  // =========================================================================

  func test_setReferenceOutcome_doesNotCrash() {
    analysis.setReferenceOutcome("000000000000000000000000")
    // No assertion — just verifies no crash or deadlock
  }

  // =========================================================================
  // MARK: — analyzeClassical
  // =========================================================================

  func test_analyzeClassical_returnsHybridScore() {
    // Populate MLPipeline with a few samples
    let pipeline = MLPipeline()
    pipeline.minSamples = 3
    pipeline.k          = 3
    var v = [Float](repeating: 0, count: 24); v[0] = 1.0
    let emb = BehavioralEmbedding(vector: v, deviceId: "test")
    for _ in 0..<3 {
      pipeline.addSample(TrainingSample(embedding: emb, label: .authorized))
    }
    // analyzeClassical goes through the shared MLPipeline; with no data in shared pipeline
    // it will fall back to 0.5 neutral score.
    let score = analysis.analyzeClassical(emb)
    XCTAssertGreaterThanOrEqual(score.hybridScore, 0.0)
    XCTAssertLessThanOrEqual(score.hybridScore, 1.0)
  }

  func test_analyzeClassical_noQuantumFields() {
    var v = [Float](repeating: 0.1, count: 24)
    v[0] = 1.0
    let emb = BehavioralEmbedding(vector: v, deviceId: "test")
    let score = analysis.analyzeClassical(emb)
    // Classical-only: no quantum job ID or backend
    XCTAssertNil(score.quantumJobId)
    XCTAssertNil(score.quantumBackend)
  }

  // =========================================================================
  // MARK: — Weights property
  // =========================================================================

  func test_defaultWeights_sumTo100() {
    XCTAssertEqual(analysis.classicalWeight + analysis.quantumWeight, 1.0, accuracy: 1e-9)
  }

  func test_defaultClassicalWeight_is060() {
    XCTAssertEqual(analysis.classicalWeight, 0.60, accuracy: 1e-9)
  }

  func test_defaultQuantumWeight_is040() {
    XCTAssertEqual(analysis.quantumWeight, 0.40, accuracy: 1e-9)
  }
}
