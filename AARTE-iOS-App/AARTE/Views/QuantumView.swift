// =============================================================
// QuantumView.swift — IBM Quantum Connection Tab
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
// =============================================================
//
// SwiftUI tab for:
//   • IBM Quantum API token entry and Keychain storage
//   • Live backend selection (ibm_brisbane / ibm_sherbrooke / ibm_kyiv)
//   • Real-time quantum job status and fidelity display
//   • On-demand enrollment and verification triggers
// =============================================================

import SwiftUI
import Security

// ── Keychain helper ───────────────────────────────────────────────────────────

private enum QuantumKeychain {
  private static let service = "com.s1af.aarte.quantum"
  private static let account = "ibm-quantum-token"

  static func save(_ token: String) -> Bool {
    let data = token.data(using: .utf8)!
    let query: [String: Any] = [
      kSecClass as String:       kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecValueData as String:   data,
    ]
    SecItemDelete(query as CFDictionary)
    return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
  }

  static func load() -> String? {
    let query: [String: Any] = [
      kSecClass as String:            kSecClassGenericPassword,
      kSecAttrService as String:      service,
      kSecAttrAccount as String:      account,
      kSecReturnData as String:       true,
      kSecMatchLimit as String:       kSecMatchLimitOne,
    ]
    var result: AnyObject?
    guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
          let data = result as? Data else { return nil }
    return String(data: data, encoding: .utf8)
  }

  static func delete() {
    let query: [String: Any] = [
      kSecClass as String:       kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
    SecItemDelete(query as CFDictionary)
  }
}

// ── View model ────────────────────────────────────────────────────────────────

@MainActor
final class QuantumViewModel: ObservableObject {

  @Published var selectedBackend: QuantumBackend = .ibmSherbrooke
  @Published var tokenInput: String = ""
  @Published var isTokenSaved: Bool = false
  @Published var isConnected: Bool  = false

  @Published var jobStatus: QuantumJobStatus?
  @Published var lastScore: HybridScore?
  @Published var lastJobId: String?
  @Published var errorMessage: String?

  @Published var isVerifying: Bool    = false
  @Published var isEnrolling: Bool    = false

  init() {
    if let saved = QuantumKeychain.load() {
      tokenInput  = saved
      isTokenSaved = true
      QuantumBridge.shared.apiToken = saved
      isConnected = true
    }
  }

  func saveToken() {
    let token = tokenInput.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !token.isEmpty else { errorMessage = "Token cannot be empty"; return }
    isTokenSaved = QuantumKeychain.save(token)
    if isTokenSaved {
      QuantumBridge.shared.apiToken = token
      isConnected  = true
      errorMessage = nil
    } else {
      errorMessage = "Failed to save token to Keychain"
    }
  }

  func clearToken() {
    QuantumKeychain.delete()
    QuantumBridge.shared.apiToken = nil
    tokenInput   = ""
    isTokenSaved = false
    isConnected  = false
    lastScore    = nil
    lastJobId    = nil
  }

  func runVerification() {
    guard !isVerifying else { return }
    isVerifying  = true
    jobStatus    = .initializing
    errorMessage = nil

    Task {
      do {
        let sample   = BehavioralSample()          // In production: collect real sensor data
        let engine   = AIEngine.shared
        let query    = engine.embed(sample)
        let score    = try await QuantumBehavioralAnalysis.shared
                            .analyze(query: query, backend: selectedBackend)
        await MainActor.run {
          lastScore    = score
          lastJobId    = score.quantumJobId
          jobStatus    = .completed
          isVerifying  = false
        }
      } catch {
        await MainActor.run {
          errorMessage = error.localizedDescription
          jobStatus    = .failed
          isVerifying  = false
        }
      }
    }
  }

  func runEnrollment() {
    guard !isEnrolling else { return }
    isEnrolling  = true
    errorMessage = nil

    Task {
      do {
        // Collect a batch of samples to build a reference embedding
        let samples  = (0..<20).map { _ in BehavioralSample() }
        let engine   = AIEngine.shared
        let ref      = engine.batchEmbed(samples)

        guard let weights = MLPipeline.shared.exportQuantumWeights() else {
          await MainActor.run {
            errorMessage = "Not enough training data — add labeled samples first"
            isEnrolling  = false
          }
          return
        }
        try await QuantumBehavioralAnalysis.shared.enroll(
          weights: weights,
          referenceEmbedding: ref,
          backend: selectedBackend
        )
        await MainActor.run {
          isEnrolling = false
        }
      } catch {
        await MainActor.run {
          errorMessage = error.localizedDescription
          isEnrolling  = false
        }
      }
    }
  }
}

// ── QuantumView ───────────────────────────────────────────────────────────────

public struct QuantumView: View {
  @StateObject private var vm = QuantumViewModel()

  public init() {}

  public var body: some View {
    NavigationView {
      ScrollView {
        VStack(spacing: 20) {
          connectionCard
          backendCard
          verificationCard
          if let score = vm.lastScore { scoreCard(score) }
          if let err = vm.errorMessage { errorCard(err) }
        }
        .padding()
      }
      .navigationTitle("IBM Quantum Network")
      .navigationBarTitleDisplayMode(.large)
      .background(Color(.systemGroupedBackground))
    }
  }

  // ── Connection card ─────────────────────────────────────────────────────────

  private var connectionCard: some View {
    VStack(alignment: .leading, spacing: 14) {
      Label("API Token", systemImage: "key.fill")
        .font(.headline)
        .foregroundColor(.primary)

      SecureField("Paste IBM Quantum API token…", text: $vm.tokenInput)
        .textContentType(.password)
        .autocorrectionDisabled()
        .padding(10)
        .background(Color(.secondarySystemBackground))
        .cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.gray.opacity(0.3)))

      HStack(spacing: 12) {
        Button(action: vm.saveToken) {
          Label(vm.isTokenSaved ? "Token Saved ✓" : "Save to Keychain",
                systemImage: vm.isTokenSaved ? "checkmark.seal.fill" : "lock.fill")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .tint(vm.isTokenSaved ? .green : .blue)
        .disabled(vm.tokenInput.trimmingCharacters(in: .whitespaces).isEmpty)

        if vm.isTokenSaved {
          Button(action: vm.clearToken) {
            Label("Clear", systemImage: "trash")
          }
          .buttonStyle(.bordered)
          .tint(.red)
        }
      }

      if vm.isConnected {
        HStack(spacing: 6) {
          Circle().fill(.green).frame(width: 8, height: 8)
          Text("Connected to IBM Quantum Platform")
            .font(.caption)
            .foregroundColor(.green)
        }
      }
    }
    .padding()
    .background(Color(.systemBackground))
    .cornerRadius(14)
    .shadow(color: .black.opacity(0.06), radius: 4, y: 2)
  }

  // ── Backend card ─────────────────────────────────────────────────────────────

  private var backendCard: some View {
    VStack(alignment: .leading, spacing: 14) {
      Label("Hardware Backend", systemImage: "cpu.fill")
        .font(.headline)

      ForEach(QuantumBackend.allCases, id: \.rawValue) { backend in
        Button {
          vm.selectedBackend = backend
        } label: {
          HStack {
            VStack(alignment: .leading, spacing: 4) {
              Text(backend.rawValue)
                .font(.system(.body, design: .monospaced))
                .foregroundColor(.primary)
              Text("\(backend.qubitCount) qubits · QASM 3.0 · Real hardware")
                .font(.caption)
                .foregroundColor(.secondary)
            }
            Spacer()
            if vm.selectedBackend == backend {
              Image(systemName: "checkmark.circle.fill")
                .foregroundColor(.blue)
                .font(.title3)
            }
          }
          .padding(12)
          .background(vm.selectedBackend == backend
                      ? Color.blue.opacity(0.08)
                      : Color(.secondarySystemBackground))
          .cornerRadius(10)
          .overlay(
            RoundedRectangle(cornerRadius: 10)
              .stroke(vm.selectedBackend == backend
                      ? Color.blue.opacity(0.4) : Color.clear, lineWidth: 1)
          )
        }
        .buttonStyle(.plain)
      }
    }
    .padding()
    .background(Color(.systemBackground))
    .cornerRadius(14)
    .shadow(color: .black.opacity(0.06), radius: 4, y: 2)
  }

  // ── Verification card ─────────────────────────────────────────────────────────

  private var verificationCard: some View {
    VStack(alignment: .leading, spacing: 14) {
      Label("Quantum Verification", systemImage: "waveform.and.magnifyingglass")
        .font(.headline)

      if let status = vm.jobStatus {
        jobStatusRow(status)
      }

      if let jobId = vm.lastJobId {
        HStack {
          Text("Job ID:")
            .font(.caption)
            .foregroundColor(.secondary)
          Text(jobId.prefix(16) + "…")
            .font(.system(.caption, design: .monospaced))
            .foregroundColor(.blue)
        }
      }

      HStack(spacing: 12) {
        Button(action: vm.runVerification) {
          if vm.isVerifying {
            ProgressView().tint(.white)
          } else {
            Label("Verify Now", systemImage: "atom")
          }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(vm.isConnected ? Color.blue : Color.gray)
        .foregroundColor(.white)
        .cornerRadius(10)
        .disabled(!vm.isConnected || vm.isVerifying)

        Button(action: vm.runEnrollment) {
          if vm.isEnrolling {
            ProgressView().tint(.purple)
          } else {
            Label("Enroll", systemImage: "person.badge.plus")
          }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color(.secondarySystemBackground))
        .foregroundColor(.purple)
        .cornerRadius(10)
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.purple.opacity(0.4)))
        .disabled(!vm.isConnected || vm.isEnrolling)
      }

      Text("AARTE uses 24-qubit amplitude encoding on real IBM Quantum hardware. No simulators.")
        .font(.caption2)
        .foregroundColor(.secondary)
    }
    .padding()
    .background(Color(.systemBackground))
    .cornerRadius(14)
    .shadow(color: .black.opacity(0.06), radius: 4, y: 2)
  }

  private func jobStatusRow(_ status: QuantumJobStatus) -> some View {
    HStack(spacing: 8) {
      statusDot(status)
      Text(status.rawValue)
        .font(.system(.caption, design: .monospaced))
        .foregroundColor(statusColor(status))
      Spacer()
      if !status.isTerminal {
        ProgressView().scaleEffect(0.7)
      }
    }
    .padding(8)
    .background(statusColor(status).opacity(0.08))
    .cornerRadius(8)
  }

  private func statusDot(_ status: QuantumJobStatus) -> some View {
    Circle()
      .fill(statusColor(status))
      .frame(width: 8, height: 8)
  }

  private func statusColor(_ status: QuantumJobStatus) -> Color {
    switch status {
    case .completed:   return .green
    case .failed, .cancelled: return .red
    case .running:     return .blue
    default:           return .orange
    }
  }

  // ── Score card ─────────────────────────────────────────────────────────────

  private func scoreCard(_ score: HybridScore) -> some View {
    VStack(alignment: .leading, spacing: 14) {
      Label("Hybrid Score", systemImage: "chart.bar.xaxis")
        .font(.headline)

      HStack(spacing: 0) {
        decisionBadge(score.decision)
        Spacer()
        Text(String(format: "%.1f%%", score.hybridScore * 100))
          .font(.system(size: 28, weight: .bold, design: .rounded))
          .foregroundColor(decisionColor(score.decision))
      }

      Divider()

      VStack(spacing: 8) {
        scoreRow("Classical (60%)", score.classicalScore, .blue)
        scoreRow("Quantum (40%)", score.quantumScore, .purple)
        scoreRow("Hybrid", score.hybridScore,
                 decisionColor(score.decision))
      }

      if let backend = score.quantumBackend {
        Text("Verified on \(backend.rawValue) · \(score.analyzedAt.formatted(date: .omitted, time: .standard))")
          .font(.caption2)
          .foregroundColor(.secondary)
      }
    }
    .padding()
    .background(Color(.systemBackground))
    .cornerRadius(14)
    .shadow(color: .black.opacity(0.06), radius: 4, y: 2)
  }

  private func scoreRow(_ label: String, _ value: Double, _ color: Color) -> some View {
    HStack {
      Text(label)
        .font(.caption)
        .foregroundColor(.secondary)
        .frame(width: 130, alignment: .leading)
      GeometryReader { geo in
        ZStack(alignment: .leading) {
          Capsule().fill(color.opacity(0.15)).frame(height: 8)
          Capsule().fill(color).frame(width: geo.size.width * value, height: 8)
        }
      }
      .frame(height: 8)
      Text(String(format: "%.0f%%", value * 100))
        .font(.system(.caption, design: .monospaced))
        .foregroundColor(color)
        .frame(width: 38, alignment: .trailing)
    }
  }

  private func decisionBadge(_ d: AuthDecision) -> some View {
    Text(d.rawValue)
      .font(.system(.caption, design: .monospaced).bold())
      .padding(.horizontal, 10).padding(.vertical, 4)
      .background(decisionColor(d).opacity(0.15))
      .foregroundColor(decisionColor(d))
      .cornerRadius(6)
  }

  private func decisionColor(_ d: AuthDecision) -> Color {
    switch d {
    case .authorized:   return .green
    case .review:       return .orange
    case .unauthorized: return .red
    }
  }

  // ── Error card ─────────────────────────────────────────────────────────────

  private func errorCard(_ message: String) -> some View {
    HStack(alignment: .top, spacing: 10) {
      Image(systemName: "exclamationmark.triangle.fill").foregroundColor(.red)
      Text(message).font(.callout).foregroundColor(.primary)
      Spacer()
    }
    .padding()
    .background(Color.red.opacity(0.08))
    .cornerRadius(12)
    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.red.opacity(0.25)))
  }
}

// ── Preview ───────────────────────────────────────────────────────────────────

#if DEBUG
struct QuantumView_Previews: PreviewProvider {
  static var previews: some View {
    QuantumView()
  }
}
#endif
