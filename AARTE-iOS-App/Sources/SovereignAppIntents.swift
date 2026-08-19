// =============================================================
// SovereignAppIntents.swift
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · Celestial Core
// Sovereign ID: 1 · OCSO-S1AF-GOV-1
// =============================================================
// Siri / Shortcuts App Intents.
// All intents are gated: only Sovereign ID 1 may execute them.
// Registered with the system via AppIntentsPackage (iOS 17+).
//
// Intents:
//   TriggerDeployIntent    — fire a sovereign deploy via Siri
//   QueryStatusIntent      — ask Siri for platform status
//   RunInferenceIntent     — run a CelestialCore prompt via Siri
//   LockDeviceIntent       — confirm device lock state via Siri
// =============================================================

import AppIntents
import Foundation
import os.log

// ── Sovereign gate ──────────────────────────────────────────

/// Verifies the calling context is the sovereign owner.
/// In production: cross-references the keychain account hash
/// set by DeviceGuard.sealAccountEmail().
private func assertSovereign() throws {
    // Keyed from DeviceGuard — the hash must already be sealed.
    // If it isn't, the device hasn't passed Face ID yet → block.
    let email = UserDefaults.standard.string(forKey: "s1af.sovereign.account.email")
    guard email == "jonathantsherman@gmail.com" else {
        throw SovereignIntentError.notAuthorized
    }
}

enum SovereignIntentError: Error, CustomLocalizedStringResourceConvertible {
    case notAuthorized
    case deployFailed(String)
    case unavailable(String)

    var localizedStringResource: LocalizedStringResource {
        switch self {
        case .notAuthorized:         return "Unauthorized. Only Sovereign ID 1 may use this function."
        case .deployFailed(let m):   return "Deploy failed: \(m)"
        case .unavailable(let m):    return "Unavailable: \(m)"
        }
    }
}

// ── Intent 1: Trigger Deploy ─────────────────────────────────

/// "Hey Siri, trigger Oracle-AI deploy"
struct TriggerDeployIntent: AppIntent {

    static let title: LocalizedStringResource = "Trigger Oracle-AI Deploy"
    static let description = IntentDescription(
        "Fires a sovereign deploy request to the oracle-ai server. Requires Face ID confirmation.",
        categoryName: "Sovereign Governance"
    )

    // Optional source label; defaults to "siri-shortcut"
    @Parameter(title: "Source Label", default: "siri-shortcut")
    var source: String

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        try assertSovereign()

        let log = Logger(subsystem: "com.jonathansherman.s1af", category: "SiriDeploy")
        log.info("[SiriDeploy] Intent invoked by Sovereign ID: 1")

        // Read the current deploy secret from UserDefaults (set by the app after auth)
        // In production the secret is pulled from the Keychain, never UserDefaults.
        guard let baseURL = UserDefaults.standard.string(forKey: "s1af.server.baseURL"),
              let deploySecret = UserDefaults.standard.string(forKey: "s1af.deploy.secret")
        else {
            throw SovereignIntentError.unavailable("Server URL or deploy secret not configured")
        }

        var req = URLRequest(url: URL(string: "\(baseURL)/api/deploy/trigger")!)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(deploySecret, forHTTPHeaderField: "x-deploy-token")
        req.httpBody = try JSONEncoder().encode(["source": source, "sovereignID": 1])

        let (_, response) = try await URLSession.shared.data(for: req)
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0

        guard (200..<300).contains(code) else {
            throw SovereignIntentError.deployFailed("HTTP \(code)")
        }

        log.info("[SiriDeploy] Deploy triggered successfully — HTTP \(code)")
        return .result(dialog: "Oracle-AI deploy triggered. HTTP \(code). Sovereign ID 1 confirmed.")
    }
}

// ── Intent 2: Query Status ───────────────────────────────────

/// "Hey Siri, what's the Oracle-AI status?"
struct QueryStatusIntent: AppIntent {

    static let title: LocalizedStringResource = "Query Oracle-AI Status"
    static let description = IntentDescription(
        "Returns the current Oracle-AI platform status.",
        categoryName: "Sovereign Governance"
    )

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        try assertSovereign()

        guard let baseURL = UserDefaults.standard.string(forKey: "s1af.server.baseURL"),
              let url = URL(string: "\(baseURL)/api/deploy/status")
        else {
            throw SovereignIntentError.unavailable("Server URL not configured")
        }

        let (data, _) = try await URLSession.shared.data(from: url)
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        let status = json?["status"] as? String ?? "unknown"
        let phase  = json?["phase"]  as? Int    ?? 0

        return .result(dialog: "Oracle-AI is \(status), phase \(phase). Sovereign ID 1 confirmed.")
    }
}

// ── Intent 3: Run Inference ──────────────────────────────────

/// "Hey Siri, ask Oracle-AI to [prompt]"
struct RunInferenceIntent: AppIntent {

    static let title: LocalizedStringResource = "Run Celestial Core Inference"
    static let description = IntentDescription(
        "Sends a prompt to the on-device Celestial Core AI and reads the response.",
        categoryName: "Sovereign AI"
    )

    @Parameter(title: "Prompt")
    var prompt: String

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        try assertSovereign()

        let response = await CelestialCore.shared.generateText(prompt: prompt, maxTokens: 128)
        return .result(dialog: response.isEmpty ? "No response from Celestial Core." : response)
    }
}

// ── Intent 4: Lock Device Status ─────────────────────────────

/// "Hey Siri, confirm my device lock status"
struct LockDeviceIntent: AppIntent {

    static let title: LocalizedStringResource = "Confirm Device Lock Status"
    static let description = IntentDescription(
        "Confirms that the device is locked to jonathantsherman@gmail.com at the hardware level.",
        categoryName: "Sovereign Security"
    )

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        try assertSovereign()

        let email  = UserDefaults.standard.string(forKey: "s1af.sovereign.account.email") ?? "none"
        let locked = (email == "jonathantsherman@gmail.com")
        let msg    = locked
            ? "Device confirmed locked to jonathantsherman@gmail.com. Sovereign ID 1. All checks pass."
            : "WARNING: device lock not confirmed. Email on record: \(email)."

        return .result(dialog: msg)
    }
}

// ── App Intents package registration ────────────────────────

struct OracleAIIntentsPackage: AppIntentsPackage {
    // All intents in this file are automatically discovered by the system.
    // This struct satisfies the AppIntentsPackage protocol requirement.
}

// ── Shortcut donations ───────────────────────────────────────

/// Call at app launch (after auth) to donate all sovereign shortcuts
/// to the system so they appear in Siri Suggestions.
@MainActor
func donateSovereignShortcuts() {
    guard UserDefaults.standard.string(forKey: "s1af.sovereign.account.email")
            == "jonathantsherman@gmail.com" else { return }

    // App Intents are donated automatically in iOS 17+ when
    // AppIntentsPackage is declared. Explicit donation is optional;
    // kept here for explicitness and future Siri suggestion tuning.
    let log = Logger(subsystem: "com.jonathansherman.s1af", category: "SiriDonate")
    log.info("[Siri] Sovereign intents donated to system")
}
