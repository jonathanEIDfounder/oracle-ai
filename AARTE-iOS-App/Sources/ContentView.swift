// =============================================================
// ContentView.swift
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
// =============================================================
//
// Root TabView — three tabs:
//   1. Oracle-AI home (Kimi status, sovereign header)
//   2. IBM Quantum Network (QuantumView)
//   3. Identity (biometric / session status)
// =============================================================

import SwiftUI

struct ContentView: View {

  // ── S1AF authorship anchor ───────────────────────────────────
  private let _s1afAuthor = "© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1"

  var body: some View {
    TabView {
      HomeTab()
        .tabItem {
          Label("Oracle-AI", systemImage: "brain.head.profile")
        }
        .tag(0)

      QuantumView()
        .tabItem {
          Label("Quantum", systemImage: "atom")
        }
        .tag(1)

      IdentityTab()
        .tabItem {
          Label("Identity", systemImage: "person.badge.shield.checkmark")
        }
        .tag(2)
    }
    .tint(.cyan)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: — HomeTab
// ─────────────────────────────────────────────────────────────────────────────

private struct HomeTab: View {
  var body: some View {
    NavigationStack {
      ZStack {
        Color.black.ignoresSafeArea()

        ScrollView {
          VStack(spacing: 24) {

            // Header
            VStack(spacing: 4) {
              Image(systemName: "brain.head.profile")
                .font(.system(size: 44))
                .foregroundStyle(
                  LinearGradient(colors: [.cyan, .blue],
                                 startPoint: .topLeading, endPoint: .bottomTrailing)
                )
                .padding(.top, 32)

              Text("Oracle-AI")
                .font(.largeTitle.bold())
                .foregroundStyle(.white)

              Text("OCSO-S1AF-GOV-1 · Sovereign ID 1")
                .font(.caption.monospaced())
                .foregroundStyle(.white.opacity(0.4))
            }

            Divider().background(.white.opacity(0.1))

            // Kimi status
            KimiStatusCard()

            // AARTE quick status
            AARTEStatusCard()

            Spacer(minLength: 40)

            Text("© 2026 Jonathan Sherman — All rights reserved")
              .font(.caption2.monospaced())
              .foregroundStyle(.white.opacity(0.2))
              .padding(.bottom, 20)
          }
          .padding(.horizontal, 20)
        }
      }
      .navigationBarHidden(true)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: — IdentityTab
// ─────────────────────────────────────────────────────────────────────────────

private struct IdentityTab: View {
  @State private var auth = BiometricAuthManager.shared

  var body: some View {
    NavigationStack {
      ZStack {
        Color.black.ignoresSafeArea()
        VStack(spacing: 24) {
          Image(systemName: "person.badge.shield.checkmark.fill")
            .font(.system(size: 54))
            .foregroundStyle(LinearGradient(colors: [.green, .cyan],
                                            startPoint: .top, endPoint: .bottom))
            .padding(.top, 48)

          Text("Sovereign Identity")
            .font(.title2.bold())
            .foregroundStyle(.white)

          VStack(spacing: 12) {
            identityRow(icon: "person.fill",        label: "Operator",    value: "J. Sherman")
            identityRow(icon: "number",             label: "Sovereign ID", value: "1")
            identityRow(icon: "shield.fill",        label: "Governance",  value: "OCSO-S1AF-GOV-1")
            identityRow(icon: "iphone",             label: "Device",      value: "iPhone XR (A12)")
            identityRow(icon: "faceid",             label: "Biometric",   value: "Face ID Enrolled")
          }
          .padding(20)
          .background(.white.opacity(0.06))
          .clipShape(RoundedRectangle(cornerRadius: 16))

          Button {
            Task { try? await auth.reauthenticate() }
          } label: {
            Label("Re-authenticate", systemImage: "faceid")
              .frame(maxWidth: .infinity)
              .padding()
              .background(Color.cyan.opacity(0.15))
              .foregroundStyle(.cyan)
              .clipShape(RoundedRectangle(cornerRadius: 12))
              .overlay(RoundedRectangle(cornerRadius: 12).stroke(.cyan.opacity(0.4)))
          }

          Spacer()
        }
        .padding(.horizontal, 24)
      }
      .navigationTitle("Identity")
      .navigationBarTitleDisplayMode(.inline)
      .toolbarColorScheme(.dark, for: .navigationBar)
    }
  }

  private func identityRow(icon: String, label: String, value: String) -> some View {
    HStack {
      Image(systemName: icon)
        .foregroundStyle(.cyan)
        .frame(width: 24)
      Text(label)
        .foregroundStyle(.white.opacity(0.5))
        .font(.subheadline)
      Spacer()
      Text(value)
        .foregroundStyle(.white)
        .font(.subheadline.monospaced())
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: — Shared cards
// ─────────────────────────────────────────────────────────────────────────────

struct KimiStatusCard: View {
  @State private var config = KimiConfiguration.shared

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Label("Kimi AI", systemImage: "sparkles")
        .font(.headline.bold())
        .foregroundStyle(.white)

      HStack {
        Circle()
          .fill(config.isConfigured ? .green : .orange)
          .frame(width: 8, height: 8)
        Text(config.isConfigured ? "Connected · \(config.model)" : "Not configured")
          .font(.subheadline)
          .foregroundStyle(.white.opacity(0.8))
      }

      if let endpoint = config.endpoint {
        Text(endpoint)
          .font(.caption.monospaced())
          .foregroundStyle(.white.opacity(0.4))
          .lineLimit(1)
      }
    }
    .padding(16)
    .background(.white.opacity(0.06))
    .clipShape(RoundedRectangle(cornerRadius: 12))
  }
}

/// Mini AARTE summary card shown on the home tab.
struct AARTEStatusCard: View {
  @State private var score: Double? = nil

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Label("AARTE — Behavioral Auth", systemImage: "waveform.and.magnifyingglass")
        .font(.headline.bold())
        .foregroundStyle(.white)

      if let s = score {
        let decision = s >= 0.85 ? "AUTHORIZED" : s >= 0.60 ? "REVIEW" : "UNAUTHORIZED"
        let color: Color = s >= 0.85 ? .green : s >= 0.60 ? .orange : .red
        HStack {
          Circle().fill(color).frame(width: 8, height: 8)
          Text(decision)
            .font(.subheadline.monospaced().bold())
            .foregroundStyle(color)
          Spacer()
          Text(String(format: "%.0f%%", s * 100))
            .font(.title3.bold())
            .foregroundStyle(color)
        }
      } else {
        HStack {
          Circle().fill(.white.opacity(0.3)).frame(width: 8, height: 8)
          Text("STANDBY — run Quantum tab to verify")
            .font(.caption)
            .foregroundStyle(.white.opacity(0.5))
        }
      }

      Text("60 % classical k-NN · 40 % IBM Quantum")
        .font(.caption2.monospaced())
        .foregroundStyle(.white.opacity(0.3))
    }
    .padding(16)
    .background(.white.opacity(0.06))
    .clipShape(RoundedRectangle(cornerRadius: 12))
    .onReceive(NotificationCenter.default.publisher(for: .aarteSscoreUpdated)) { note in
      score = note.object as? Double
    }
  }
}

extension Notification.Name {
  static let aarteSscoreUpdated = Notification.Name("com.s1af.aarte.scoreUpdated")
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: — Kimi configuration reader
// ─────────────────────────────────────────────────────────────────────────────

@Observable
final class KimiConfiguration {
  static let shared = KimiConfiguration()

  var model:        String  = "kimi-k2-0711-preview"
  var endpoint:     String? = "https://api.moonshot.cn/v1"
  var isConfigured: Bool    = false

  private init() { load() }

  private func load() {
    guard let url = Bundle.main.url(forResource: "KimiConfig", withExtension: "plist"),
          let dict = NSDictionary(contentsOf: url) as? [String: Any]
    else { return }

    model        = dict["Model"]    as? String ?? model
    endpoint     = dict["Endpoint"] as? String
    isConfigured = (dict["Configured"] as? Bool) ?? false
  }
}
