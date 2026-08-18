// =============================================================
// QuantumBridge.swift — IBM Quantum Network REST Client
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
// =============================================================
//
// IBM Quantum Platform REST API v2 — real hardware only.
// Supported backends: ibm_brisbane · ibm_sherbrooke · ibm_kyiv
//
// Workflow:
//   1. submitCircuit(qasm:backend:) → job ID
//   2. poll(jobId:) until status == .completed / .failed
//   3. fetchResults(jobId:) → measurement counts
//
// QASM 3.0 circuits are generated from QuantumWeights exported
// by MLPipeline and are 24-qubit amplitude-encoding circuits.
// =============================================================

import Foundation

// ── Backend ───────────────────────────────────────────────────────────────────

/// Available IBM Quantum hardware backends.
public enum QuantumBackend: String, Sendable, CaseIterable {
  case ibmBrisbane   = "ibm_brisbane"
  case ibmSherbrooke = "ibm_sherbrooke"
  case ibmKyiv       = "ibm_kyiv"

  /// Rough qubit count (for circuit feasibility checks).
  public var qubitCount: Int {
    switch self {
    case .ibmBrisbane:   return 127
    case .ibmSherbrooke: return 127
    case .ibmKyiv:       return 127
    }
  }
}

// ── Job status ────────────────────────────────────────────────────────────────

public enum QuantumJobStatus: String, Sendable {
  case initializing = "INITIALIZING"
  case queued       = "QUEUED"
  case running      = "RUNNING"
  case completed    = "COMPLETED"
  case failed       = "FAILED"
  case cancelled    = "CANCELLED"

  public var isTerminal: Bool {
    self == .completed || self == .failed || self == .cancelled
  }
}

// ── Job ───────────────────────────────────────────────────────────────────────

public struct QuantumJob: Sendable {
  public let id:        String
  public let backend:   QuantumBackend
  public let status:    QuantumJobStatus
  public let createdAt: Date
  public let shots:     Int
}

// ── Measurement results ───────────────────────────────────────────────────────

/// Raw measurement counts from the quantum hardware.
/// Key: 24-bit binary string (e.g. "101010...") · Value: count
public struct QuantumMeasurement: Sendable {
  public let jobId:    String
  public let backend:  QuantumBackend
  public let counts:   [String: Int]    // bit-string → count
  public let shots:    Int
  public let metadata: [String: String]

  /// Most-probable measurement outcome.
  public var topOutcome: String {
    counts.max(by: { $0.value < $1.value })?.key ?? ""
  }

  /// Shannon entropy of the measurement distribution (bits).
  public var entropy: Double {
    let total = Double(shots)
    return counts.values.reduce(0.0) { acc, c in
      let p = Double(c) / total
      return p > 0 ? acc - p * log2(p) : acc
    }
  }
}

// ── Errors ────────────────────────────────────────────────────────────────────

public enum QuantumBridgeError: LocalizedError, Sendable {
  case invalidToken
  case networkError(String)
  case jobFailed(String)
  case timeout
  case decodingError(String)
  case circuitTooLarge(Int, Int)   // (required, available)

  public var errorDescription: String? {
    switch self {
    case .invalidToken:             return "IBM Quantum API token is invalid or expired"
    case .networkError(let m):      return "Network error: \(m)"
    case .jobFailed(let m):         return "Quantum job failed: \(m)"
    case .timeout:                  return "Quantum job timed out"
    case .decodingError(let m):     return "Response decoding failed: \(m)"
    case .circuitTooLarge(let r, let a):
      return "Circuit requires \(r) qubits but \(a) available"
    }
  }
}

// ── QuantumBridge ─────────────────────────────────────────────────────────────

/// REST client for IBM Quantum Platform v2.
public final class QuantumBridge: @unchecked Sendable {

  // ── IBM Quantum Platform API base ─────────────────────────────────────────
  private static let apiBase = URL(string: "https://api.quantum-computing.ibm.com/runtime")!

  public static let shared = QuantumBridge()
  private init() {}

  // ── Token (set by QuantumView or quantum-setup.sh via Keychain) ─────────
  private var _token: String?
  private let tokenLock = NSLock()

  public var apiToken: String? {
    get { tokenLock.lock(); defer { tokenLock.unlock() }; return _token }
    set { tokenLock.lock(); defer { tokenLock.unlock() }; _token = newValue }
  }

  public var isConfigured: Bool { apiToken != nil }

  // ── Circuit parameters ───────────────────────────────────────────────────
  public var defaultShots: Int = 4096
  public var pollIntervalSec: Double = 2.0
  public var maxPollAttempts: Int = 300   // 10 min at 2-sec intervals

  // =========================================================================
  // MARK: — QASM 3.0 circuit generation
  // =========================================================================

  /// Generate a 24-qubit QASM 3.0 amplitude-encoding + verification circuit.
  ///
  /// Circuit structure:
  ///   1. Ry rotation layer — encodes quantum weights as amplitudes
  ///   2. CNOT entanglement ring — nearest-neighbour coupling
  ///   3. Ry rotation layer (query) — encodes the query embedding
  ///   4. Measurement
  ///
  /// - Parameters:
  ///   - weights: Reference identity weights from MLPipeline.
  ///   - query:   Query embedding (from current session's AIEngine output).
  /// - Returns: QASM 3.0 source string.
  public func buildCircuit(weights: QuantumWeights,
                           query: BehavioralEmbedding) -> String {
    let n = AIEngine.embeddingDimension
    precondition(weights.ryAngles.count == n)
    precondition(query.vector.count == n)

    // Map query vector to Ry angles
    let queryAngles: [Double] = query.vector.map { w in
      acos(Double(min(max(w, -1), 1)))
    }

    var lines: [String] = []
    lines.append("// AARTE Behavioral Verification Circuit — QASM 3.0")
    lines.append("// © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1")
    lines.append("OPENQASM 3.0;")
    lines.append("include \"stdgates.inc\";")
    lines.append("")
    lines.append("// \(n)-qubit register")
    lines.append("qubit[\(n)] q;")
    lines.append("bit[\(n)] c;")
    lines.append("")
    lines.append("// === Layer 1: Reference identity encoding (Ry) ===")
    for (i, θ) in weights.ryAngles.enumerated() {
      lines.append(String(format: "ry(%.8f) q[%d];", θ, i))
    }
    lines.append("")
    lines.append("// === Layer 2: Entanglement ring (CNOT) ===")
    for i in 0..<n {
      lines.append("cx q[\(i)], q[\((i + 1) % n)];")
    }
    lines.append("")
    lines.append("// === Layer 3: Query embedding encoding (Ry) ===")
    for (i, θ) in queryAngles.enumerated() {
      lines.append(String(format: "ry(%.8f) q[%d];", θ, i))
    }
    lines.append("")
    lines.append("// === Measurement ===")
    lines.append("c = measure q;")

    return lines.joined(separator: "\n")
  }

  // =========================================================================
  // MARK: — submitCircuit
  // =========================================================================

  /// Submit a QASM 3.0 circuit to IBM Quantum hardware.
  ///
  /// - Parameters:
  ///   - qasm:    QASM 3.0 circuit string.
  ///   - backend: Target hardware backend.
  ///   - shots:   Number of measurement shots (default: `defaultShots`).
  /// - Returns: Job ID string.
  /// - Throws: `QuantumBridgeError` on failure.
  public func submitCircuit(qasm: String,
                            backend: QuantumBackend,
                            shots: Int? = nil) async throws -> String {
    guard let token = apiToken, !token.isEmpty else {
      throw QuantumBridgeError.invalidToken
    }
    let shotCount = shots ?? defaultShots

    let body: [String: Any] = [
      "program_id":  "sampler",
      "backend":     backend.rawValue,
      "params": [
        "circuits": [qasm],
        "run_options": [
          "shots":     shotCount,
          "memory":    false,
          "use_measure_esp": true,
        ],
      ],
    ]

    var req = URLRequest(url: Self.apiBase.appendingPathComponent("jobs"))
    req.httpMethod = "POST"
    req.setValue("application/json",    forHTTPHeaderField: "Content-Type")
    req.setValue("Bearer \(token)",     forHTTPHeaderField: "Authorization")
    req.setValue("AARTE/1.0 S1AF",     forHTTPHeaderField: "X-Qiskit-Header")
    req.httpBody = try JSONSerialization.data(withJSONObject: body)

    let (data, resp) = try await URLSession.shared.data(for: req)
    guard let http = resp as? HTTPURLResponse else {
      throw QuantumBridgeError.networkError("Non-HTTP response")
    }
    guard (200..<300).contains(http.statusCode) else {
      let msg = String(data: data, encoding: .utf8) ?? "status \(http.statusCode)"
      throw QuantumBridgeError.networkError(msg)
    }

    guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let jobId = json["id"] as? String else {
      throw QuantumBridgeError.decodingError("Missing 'id' field in response")
    }
    return jobId
  }

  // =========================================================================
  // MARK: — poll
  // =========================================================================

  /// Poll a job until it reaches a terminal state.
  ///
  /// - Parameter jobId: Job ID from `submitCircuit`.
  /// - Returns: Final `QuantumJobStatus`.
  /// - Throws: `QuantumBridgeError.timeout` after `maxPollAttempts`.
  public func poll(jobId: String) async throws -> QuantumJobStatus {
    guard let token = apiToken, !token.isEmpty else {
      throw QuantumBridgeError.invalidToken
    }
    var req = URLRequest(url: Self.apiBase.appendingPathComponent("jobs/\(jobId)"))
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

    for _ in 0..<maxPollAttempts {
      try await Task.sleep(nanoseconds: UInt64(pollIntervalSec * 1_000_000_000))
      let (data, _) = try await URLSession.shared.data(for: req)
      guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let statusStr = json["status"] as? String,
            let status = QuantumJobStatus(rawValue: statusStr.uppercased())
      else { continue }
      if status.isTerminal { return status }
    }
    throw QuantumBridgeError.timeout
  }

  // =========================================================================
  // MARK: — fetchResults
  // =========================================================================

  /// Fetch measurement results for a completed job.
  ///
  /// - Parameters:
  ///   - jobId:   Job ID from `submitCircuit`.
  ///   - backend: Backend the job ran on (for attribution).
  /// - Returns: `QuantumMeasurement` containing bit-string counts.
  /// - Throws: `QuantumBridgeError` on failure or unexpected format.
  public func fetchResults(jobId: String,
                           backend: QuantumBackend) async throws -> QuantumMeasurement {
    guard let token = apiToken, !token.isEmpty else {
      throw QuantumBridgeError.invalidToken
    }
    var req = URLRequest(url: Self.apiBase.appendingPathComponent("jobs/\(jobId)/results"))
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

    let (data, resp) = try await URLSession.shared.data(for: req)
    guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
      throw QuantumBridgeError.networkError("Non-200 fetching results")
    }

    guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let results = json["results"] as? [[String: Any]],
          let first  = results.first,
          let data_  = first["data"] as? [String: Any],
          let meas   = data_["meas"] as? [String: Any],
          let rawCounts = meas["counts"] as? [String: Any]
    else {
      throw QuantumBridgeError.decodingError("Unexpected results schema")
    }

    // Convert hex keys → binary strings
    var counts: [String: Int] = [:]
    for (key, val) in rawCounts {
      let intKey = key.hasPrefix("0x")
        ? Int(key.dropFirst(2), radix: 16) ?? 0
        : Int(key) ?? 0
      let binStr = String(intKey, radix: 2).leftPadded(toLength: AIEngine.embeddingDimension)
      let count  = (val as? Int) ?? 0
      counts[binStr] = count
    }

    let shots = counts.values.reduce(0, +)
    let meta: [String: String] = [
      "backend":  backend.rawValue,
      "job_id":   jobId,
      "fetched":  ISO8601DateFormatter().string(from: .now),
    ]
    return QuantumMeasurement(jobId: jobId, backend: backend,
                              counts: counts, shots: shots, metadata: meta)
  }

  // =========================================================================
  // MARK: — submit + wait (convenience)
  // =========================================================================

  /// One-shot: build circuit → submit → poll → fetch.
  public func verify(weights: QuantumWeights,
                     query: BehavioralEmbedding,
                     backend: QuantumBackend,
                     shots: Int? = nil) async throws -> QuantumMeasurement {
    let qasm  = buildCircuit(weights: weights, query: query)
    let jobId = try await submitCircuit(qasm: qasm, backend: backend, shots: shots)
    let final = try await poll(jobId: jobId)
    guard final == .completed else {
      throw QuantumBridgeError.jobFailed("Job ended with status: \(final.rawValue)")
    }
    return try await fetchResults(jobId: jobId, backend: backend)
  }
}

// ── String helpers ────────────────────────────────────────────────────────────

private extension String {
  func leftPadded(toLength len: Int, with char: Character = "0") -> String {
    guard count < len else { return self }
    return String(repeating: char, count: len - count) + self
  }
}
