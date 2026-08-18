// =============================================================
// QuantumBridgeTests.swift — QuantumBridge unit tests
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
// =============================================================
// Tests cover: circuit generation, string helpers, backend enum,
// error types, and result parsing logic.
// No live network calls are made.
// =============================================================

import XCTest
@testable import AARTE

final class QuantumBridgeTests: XCTestCase {

  let bridge = QuantumBridge.shared

  // =========================================================================
  // MARK: — QuantumBackend
  // =========================================================================

  func test_backend_rawValues() {
    XCTAssertEqual(QuantumBackend.ibmBrisbane.rawValue,   "ibm_brisbane")
    XCTAssertEqual(QuantumBackend.ibmSherbrooke.rawValue, "ibm_sherbrooke")
    XCTAssertEqual(QuantumBackend.ibmKyiv.rawValue,       "ibm_kyiv")
  }

  func test_backend_allCasesCount() {
    XCTAssertEqual(QuantumBackend.allCases.count, 3)
  }

  func test_backend_qubitCount_allAre127() {
    for b in QuantumBackend.allCases {
      XCTAssertEqual(b.qubitCount, 127, "\(b.rawValue) should have 127 qubits")
    }
  }

  // =========================================================================
  // MARK: — QuantumJobStatus
  // =========================================================================

  func test_jobStatus_terminalStates() {
    XCTAssertTrue(QuantumJobStatus.completed.isTerminal)
    XCTAssertTrue(QuantumJobStatus.failed.isTerminal)
    XCTAssertTrue(QuantumJobStatus.cancelled.isTerminal)
  }

  func test_jobStatus_nonTerminalStates() {
    XCTAssertFalse(QuantumJobStatus.initializing.isTerminal)
    XCTAssertFalse(QuantumJobStatus.queued.isTerminal)
    XCTAssertFalse(QuantumJobStatus.running.isTerminal)
  }

  func test_jobStatus_rawValues() {
    XCTAssertEqual(QuantumJobStatus(rawValue: "COMPLETED"), .completed)
    XCTAssertEqual(QuantumJobStatus(rawValue: "FAILED"),    .failed)
    XCTAssertNil(QuantumJobStatus(rawValue: "unknown_status"))
  }

  // =========================================================================
  // MARK: — QuantumBridgeError
  // =========================================================================

  func test_errors_haveDescriptions() {
    let errs: [QuantumBridgeError] = [
      .invalidToken, .networkError("test"), .jobFailed("oops"),
      .timeout, .decodingError("bad json"), .circuitTooLarge(28, 24),
    ]
    for e in errs {
      XCTAssertNotNil(e.errorDescription, "\(e) must have a description")
      XCTAssertFalse(e.errorDescription!.isEmpty)
    }
  }

  func test_circuitTooLarge_includesQubits() {
    let err = QuantumBridgeError.circuitTooLarge(32, 24)
    XCTAssertTrue(err.errorDescription?.contains("32") ?? false)
    XCTAssertTrue(err.errorDescription?.contains("24") ?? false)
  }

  // =========================================================================
  // MARK: — isConfigured
  // =========================================================================

  func test_isConfigured_falseByDefault() {
    bridge.apiToken = nil
    XCTAssertFalse(bridge.isConfigured)
  }

  func test_isConfigured_trueWhenTokenSet() {
    bridge.apiToken = "test-token-12345"
    XCTAssertTrue(bridge.isConfigured)
    bridge.apiToken = nil  // restore
  }

  // =========================================================================
  // MARK: — buildCircuit
  // =========================================================================

  func makeWeights() -> QuantumWeights {
    let angles = (0..<24).map { i in Double.pi * Double(i) / 24.0 }
    return QuantumWeights(ryAngles: angles, trainedOn: 50, loocvAccuracy: 0.92)
  }

  func makeQueryEmbedding() -> BehavioralEmbedding {
    var v = [Float](repeating: 0, count: 24)
    for i in 0..<24 { v[i] = Float(i) * 0.04 }
    return BehavioralEmbedding(vector: v, deviceId: "test")
  }

  func test_buildCircuit_containsOpenQASM3Header() {
    let qasm = bridge.buildCircuit(weights: makeWeights(), query: makeQueryEmbedding())
    XCTAssertTrue(qasm.contains("OPENQASM 3.0;"))
  }

  func test_buildCircuit_includesStdgatesInclude() {
    let qasm = bridge.buildCircuit(weights: makeWeights(), query: makeQueryEmbedding())
    XCTAssertTrue(qasm.contains("include \"stdgates.inc\";"))
  }

  func test_buildCircuit_declares24QubitRegister() {
    let qasm = bridge.buildCircuit(weights: makeWeights(), query: makeQueryEmbedding())
    XCTAssertTrue(qasm.contains("qubit[24] q;"))
    XCTAssertTrue(qasm.contains("bit[24] c;"))
  }

  func test_buildCircuit_contains48RyGates_layer1and3() {
    let qasm = bridge.buildCircuit(weights: makeWeights(), query: makeQueryEmbedding())
    // Layer 1: 24 Ry gates + Layer 3: 24 Ry gates = 48 total
    let ryCount = qasm.components(separatedBy: "\nry(").count - 1
    XCTAssertEqual(ryCount, 48, "Expected 48 Ry gates (24 reference + 24 query)")
  }

  func test_buildCircuit_contains24CnotGates_entanglementRing() {
    let qasm = bridge.buildCircuit(weights: makeWeights(), query: makeQueryEmbedding())
    // cx q[i], q[(i+1)%24] for i in 0..<24
    let cxCount = qasm.components(separatedBy: "\ncx ").count - 1
    XCTAssertEqual(cxCount, 24)
  }

  func test_buildCircuit_containsMeasurement() {
    let qasm = bridge.buildCircuit(weights: makeWeights(), query: makeQueryEmbedding())
    XCTAssertTrue(qasm.contains("c = measure q;"))
  }

  func test_buildCircuit_containsRingClosure() {
    // Last CNOT should close the ring: cx q[23], q[0];
    let qasm = bridge.buildCircuit(weights: makeWeights(), query: makeQueryEmbedding())
    XCTAssertTrue(qasm.contains("cx q[23], q[0];"))
  }

  func test_buildCircuit_anglesAreNumeric() {
    let qasm = bridge.buildCircuit(weights: makeWeights(), query: makeQueryEmbedding())
    // All Ry angle values should be parseable as Double
    let lines = qasm.split(separator: "\n")
    for line in lines {
      guard line.hasPrefix("ry(") else { continue }
      let inner = line.dropFirst(3)  // drop "ry("
      if let end = inner.firstIndex(of: ")") {
        let angleStr = String(inner[inner.startIndex..<end])
        XCTAssertNotNil(Double(angleStr), "Angle '\(angleStr)' should be parseable")
      }
    }
  }

  // =========================================================================
  // MARK: — QuantumMeasurement
  // =========================================================================

  func makeMeasurement(counts: [String: Int]) -> QuantumMeasurement {
    QuantumMeasurement(
      jobId: "test-job-id",
      backend: .ibmSherbrooke,
      counts: counts,
      shots: counts.values.reduce(0, +),
      metadata: [:]
    )
  }

  func test_measurement_topOutcome_returnsHighestCount() {
    let m = makeMeasurement(counts: [
      "000000000000000000000000": 100,
      "111111111111111111111111": 200,
      "010101010101010101010101": 50,
    ])
    XCTAssertEqual(m.topOutcome, "111111111111111111111111")
  }

  func test_measurement_entropy_uniformDistribution_high() {
    // Uniform over 2 outcomes → H = 1 bit
    let m = makeMeasurement(counts: [
      "000000000000000000000000": 2048,
      "111111111111111111111111": 2048,
    ])
    XCTAssertGreaterThan(m.entropy, 0.9)
  }

  func test_measurement_entropy_singleOutcome_zero() {
    let m = makeMeasurement(counts: ["000000000000000000000000": 4096])
    XCTAssertEqual(m.entropy, 0.0, accuracy: 1e-9)
  }

  func test_measurement_shots_sumOfCounts() {
    let m = makeMeasurement(counts: ["0": 100, "1": 200, "2": 300])
    XCTAssertEqual(m.shots, 600)
  }

  // =========================================================================
  // MARK: — QuantumWeights.qasmEncoding (via bridge path)
  // =========================================================================

  func test_weights_qasmEncoding_matchesExpectedRyCount() {
    let w = makeWeights()
    let qasm = w.qasmEncoding()
    let ryCount = qasm.components(separatedBy: "ry(").count - 1
    XCTAssertEqual(ryCount, 24)
  }
}
