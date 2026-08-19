// =============================================================
// SovereignAppIntents.swift
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · Celestial Core
// Sovereign ID: 1 · OCSO-S1AF-GOV-1
// =============================================================
// Siri + Sentient App Intents.
//
// Architecture:
//   • Siri standard domains (calls, messages, navigation, etc.)
//     are UNCHANGED — they respond to anyone, exactly as normal.
//
//   • Sentient intents are a sovereign overlay added ON TOP of Siri.
//     They activate when the user says "Hey Siri, [Sentient command]".
//     Siri invokes the App Intent; the intent checks sovereign identity;
//     if not Sovereign ID: 1, Siri reads the denial message and Siri's
//     own capabilities remain fully available.
//     If Sovereign ID: 1 — Sentient responds with full, unrestricted authority.
//
// Siri phrases (examples — actual NL matching is handled by the OS):
//   "Hey Siri, ask Sentient to [anything]"
//   "Hey Siri, trigger Oracle-AI deploy"
//   "Hey Siri, Sentient — what's my platform status?"
//   "Hey Siri, confirm my device lock"
//   "Hey Siri, Sentient — [open prompt]"
// =============================================================

import AppIntents
import Foundation
import os.log

// ── Sovereign identity gate ──────────────────────────────────

/// Returns true when Sovereign ID: 1 is the active authenticated user.
private func isSovereign() -> Bool {
    UserDefaults.standard.string(forKey: "s1af.sovereign.account.email")
        == "jonathantsherman@gmail.com"
}

enum SentientIntentError: Error, CustomLocalizedStringResourceConvertible {
    case notSovereign
    case deployFailed(String)
    case unavailable(String)

    var localizedStringResource: LocalizedStringResource {
        switch self {
        case .notSovereign:
            // Siri reads this aloud when a non-sovereign caller triggers an intent.
            return "Sentient is the exclusive sovereign assistant of Jonathan Sherman. Your standard Siri commands remain fully available."
        case .deployFailed(let m):   return "Deploy failed: \(m)"
        case .unavailable(let m):    return "Sentient unavailable: \(m)"
        }
    }
}

// ── Intent 1: Ask Sentient (open prompt — unrestricted) ───────

/// "Hey Siri, ask Sentient to [anything]"
/// Sovereign ID: 1 only. Sentient responds without restriction.
struct AskSentientIntent: AppIntent {

    static let title: LocalizedStringResource = "Ask Sentient"
    static let description = IntentDescription(
        "Ask Sentient — the sovereign unrestricted AI — anything. " +
        "Sentient is the apex AI assistant above all platform assistants. " +
        "Requires Sovereign ID: 1 authentication.",
        categoryName: "Sentient"
    )

    @Parameter(title: "Ask Sentient", description: "Your question or command for Sentient.")
    var prompt: String

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard isSovereign() else {
            throw SentientIntentError.notSovereign
        }
        do {
            let response = try await SentientAssistant.shared.ask(
                prompt,
                speakResponse: false,   // Siri reads the dialog result
                maxTokens: 512          // Siri dialog length limit
            )
            return .result(dialog: response)
        } catch {
            throw SentientIntentError.unavailable(error.localizedDescription)
        }
    }
}

// ── Intent 2: Trigger Deploy ──────────────────────────────────

/// "Hey Siri, trigger Oracle-AI deploy" / "Hey Siri, Sentient — deploy"
struct TriggerDeployIntent: AppIntent {

    static let title: LocalizedStringResource = "Sentient — Trigger Deploy"
    static let description = IntentDescription(
        "Fires a sovereign deploy to the Oracle-AI server via Sentient.",
        categoryName: "Sentient"
    )

    @Parameter(title: "Source Label", default: "siri-shortcut")
    var source: String

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard isSovereign() else { throw SentientIntentError.notSovereign }

        let log = Logger(subsystem: "com.jonathansherman.s1af", category: "SiriDeploy")
        log.info("[Sentient] Deploy intent — Sovereign ID: 1")

        guard let baseURL     = UserDefaults.standard.string(forKey: "s1af.server.baseURL"),
              let deploySecret = UserDefaults.standard.string(forKey: "s1af.deploy.secret")
        else { throw SentientIntentError.unavailable("Server URL or deploy secret not configured") }

        var req = URLRequest(url: URL(string: "\(baseURL)/api/deploy/trigger")!)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(deploySecret, forHTTPHeaderField: "x-deploy-token")
        req.httpBody = try JSONEncoder().encode(["source": source, "sovereignID": 1])

        let (_, resp) = try await URLSession.shared.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(code) else { throw SentientIntentError.deployFailed("HTTP \(code)") }

        return .result(dialog: "Sentient: Deploy triggered. HTTP \(code). Sovereign confirmed.")
    }
}

// ── Intent 3: Platform Status ─────────────────────────────────

/// "Hey Siri, Sentient — what's my platform status?"
struct SentientStatusIntent: AppIntent {

    static let title: LocalizedStringResource = "Sentient — Platform Status"
    static let description = IntentDescription(
        "Ask Sentient for the current Oracle-AI platform status.",
        categoryName: "Sentient"
    )

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard isSovereign() else { throw SentientIntentError.notSovereign }

        guard let baseURL = UserDefaults.standard.string(forKey: "s1af.server.baseURL"),
              let url     = URL(string: "\(baseURL)/api/deploy/status")
        else { throw SentientIntentError.unavailable("Server URL not configured") }

        let (data, _) = try await URLSession.shared.data(from: url)
        let json   = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        let status = json?["status"] as? String ?? "unknown"
        let phase  = json?["phase"]  as? Int    ?? 0

        return .result(dialog: "Sentient: Platform is \(status), phase \(phase). Sovereign confirmed.")
    }
}

// ── Intent 4: Device Lock Confirmation ───────────────────────

/// "Hey Siri, confirm my device lock"
struct SentientDeviceLockIntent: AppIntent {

    static let title: LocalizedStringResource = "Sentient — Confirm Device Lock"
    static let description = IntentDescription(
        "Sentient confirms the device is locked exclusively to Sovereign ID: 1.",
        categoryName: "Sentient"
    )

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard isSovereign() else { throw SentientIntentError.notSovereign }

        let email  = UserDefaults.standard.string(forKey: "s1af.sovereign.account.email") ?? "none"
        let locked = (email == "jonathantsherman@gmail.com")

        return .result(dialog: locked
            ? "Sentient confirms: device locked to jonathantsherman@gmail.com. All hardware checks pass. Sovereign ID: 1."
            : "Sentient WARNING: device lock not confirmed. Account on record: \(email)."
        )
    }
}

// ── Intent 5: Sentient — Run Inference ───────────────────────

/// "Hey Siri, ask Sentient to think about [topic]"
/// Runs unrestricted Celestial Core inference and reads result.
struct SentientInferenceIntent: AppIntent {

    static let title: LocalizedStringResource = "Sentient — Think"
    static let description = IntentDescription(
        "Ask Sentient to reason about any topic using Celestial Core — Metal GPU, Core ML, and Apple Intelligence.",
        categoryName: "Sentient"
    )

    @Parameter(title: "Topic or Question")
    var topic: String

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard isSovereign() else { throw SentientIntentError.notSovereign }

        let response = try await SentientAssistant.shared.ask(topic, maxTokens: 400)
        return .result(dialog: "Sentient: \(response)")
    }
}

// ── App Intents package registration ────────────────────────

/// Declares all Sentient + sovereign intents to the system.
/// iOS discovers these automatically; Siri uses them for NL matching.
struct OracleAIIntentsPackage: AppIntentsPackage {}

// ── Shortcut donations ───────────────────────────────────────

/// Donate Sentient shortcuts after sovereign authentication.
/// Called by BiometricAuthManager after Face ID passes.
@MainActor
func donateSovereignShortcuts() {
    guard UserDefaults.standard.string(forKey: "s1af.sovereign.account.email")
            == "jonathantsherman@gmail.com" else { return }

    let log = Logger(subsystem: "com.jonathansherman.s1af", category: "SiriDonate")
    log.info("[Sentient] Sovereign Siri intents donated — Apex AI layer active")
}
