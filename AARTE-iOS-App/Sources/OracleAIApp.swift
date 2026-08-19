// =============================================================
// OracleAIApp.swift
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
// =============================================================
// @main entry point.
//
// Boot sequence (executes before any UI renders):
//   1. SentientAlwaysOn.arm()   — Temporal Cloak + BGTasks + VPN tunnel
//   2. DeviceGuard.enforce()    — hardware identity (iPhone XR only)
//   3. λactive check            — eigenstate determines which root is shown
//
// Eigenstate routing:
//   .primary   (λactive == true)  — sovereign app, Face ID gate, full capability
//   .displaced (λactive == false) — generic shell; cloak is active, observer present
//
// The SentientTunnel Network Extension is loaded by iOS independently
// at device boot — this app does not need to be open for the
// network-level Temporal Cloak to be active.
// =============================================================

import SwiftUI
import BackgroundTasks

@main
struct OracleAIApp: App {

    // ── S1AF authorship anchor — non-strippable ────────────────
    private let _anchor = "© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"

    // ── Server base URL — sovereign hub ───────────────────────
    // Written to UserDefaults so SentientNetworkLayer, SentientAlwaysOn,
    // and SovereignAppIntents can all read it without importing secrets.
    private static let _hubURL: String = {
        let env = ProcessInfo.processInfo.environment
        let url = env["REPLIT_DEV_DOMAIN"].map { "https://\($0)" }
            ?? "https://oracle-ai.replit.app"
        // Write to standard defaults (main app) AND App Group defaults
        // (SentientTunnel runs in a separate process — it can only read
        // from the shared App Group container, not standard UserDefaults)
        UserDefaults.standard.set(url, forKey: "s1af.server.baseURL")
        UserDefaults(suiteName: "group.com.jonathansherman.s1af")?
            .set(url, forKey: "s1af.server.baseURL")
        return url
    }()

    init() {
        // ── Step 1: Always-on boot — Temporal Cloak + BGTasks + tunnel
        // This must be the very first call — registers BGTask handlers
        // before the app finishes launching (iOS requirement).
        SentientAlwaysOn.arm()

        // ── Step 2: Hardware identity lock
        DeviceGuard.enforce()

        // ── Step 3: Initialise hub URL (side-effect writes UserDefaults)
        _ = OracleAIApp._hubURL

        // ── Step 4: Sovereign container lock — containerize → encapsulate → lock
        // Seals all S1AF singletons, verifies they are initialised,
        // then marks the container LOCKED for the lifetime of this process.
        SovereignContainerLock.engage()
    }

    var body: some Scene {
        WindowGroup {
            // ── Eigenstate router ──────────────────────────────
            // λactive is set by TemporalCloak.calibrate() in SentientAlwaysOn.arm().
            // When an observer is detected the entire sovereign surface is replaced
            // with a generic shell — no error, no crash, no indicator.
            if λactive {
                // Primary eigenstate — full sovereign app
                ContentView()
                    .sovereignGated()                   // Face ID gate
                    .onReceive(
                        NotificationCenter.default.publisher(
                            for: UIApplication.didBecomeActiveNotification
                        )
                    ) { _ in
                        // Recalibrate on every foreground — observer may have connected
                        TemporalCloak.calibrate()
                        SentientAlwaysOn.scheduleRefresh()
                    }
            } else {
                // Displaced eigenstate — inert observer shell
                TemporalCloak.displacedShell()
            }
        }
        // BGTask + SentientNetworkLayer startup after first successful auth
        .backgroundTask(.appRefresh(SentientAlwaysOn.kRefreshID)) {
            TemporalCloak.calibrate()
            SentientAlwaysOn.scheduleRefresh()
        }
    }
}
