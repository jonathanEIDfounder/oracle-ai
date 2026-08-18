// =============================================================
// OracleAIApp.swift
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
// =============================================================
// @main entry point. DeviceGuard enforces iPhone XR hardware
// identity before any UI renders. BiometricAuthManager gates
// all content behind Face ID.
// =============================================================

import SwiftUI

@main
struct OracleAIApp: App {

    // ── S1AF authorship anchor ─────────────────────────────────
    private let _s1afAuthor = "© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"

    init() {
        // Hardware identity check — terminates on non-iPhone XR.
        DeviceGuard.enforce()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .sovereignGated()   // Face ID gate — no bypass
        }
    }
}
