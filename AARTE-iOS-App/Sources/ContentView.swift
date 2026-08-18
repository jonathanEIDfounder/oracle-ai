// =============================================================
// ContentView.swift
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
// =============================================================

import SwiftUI

struct ContentView: View {

    // ── S1AF authorship anchor ─────────────────────────────────
    private let _s1afAuthor = "© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1"

    @State private var auth = BiometricAuthManager.shared
    @State private var kimiResponse: String = ""
    @State private var isLoading: Bool = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()

                VStack(spacing: 24) {

                    // ── Header ─────────────────────────────────
                    VStack(spacing: 4) {
                        Text("Oracle-AI")
                            .font(.largeTitle.bold())
                            .foregroundStyle(.white)
                        Text("OCSO-S1AF-GOV-1 · Sovereign ID 1")
                            .font(.caption.monospaced())
                            .foregroundStyle(.white.opacity(0.4))
                    }
                    .padding(.top, 32)

                    Divider().background(.white.opacity(0.1))

                    // ── Kimi status ────────────────────────────
                    KimiStatusCard()

                    Spacer()

                    // ── Footer ─────────────────────────────────
                    Text("© 2026 Jonathan Sherman — All rights reserved")
                        .font(.caption2.monospaced())
                        .foregroundStyle(.white.opacity(0.2))
                        .padding(.bottom, 20)
                }
                .padding(.horizontal, 20)
            }
            .navigationBarHidden(true)
        }
    }
}

// ── Kimi status card ───────────────────────────────────────────
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

// ── Kimi configuration reader ──────────────────────────────────
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
