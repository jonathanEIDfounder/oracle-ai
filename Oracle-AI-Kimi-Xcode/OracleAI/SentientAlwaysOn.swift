// =============================================================
// SentientAlwaysOn.swift
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · Celestial Core
// Sovereign ID: 1 · OCSO-S1AF-GOV-1
// =============================================================
// Ensures the Temporal Cloak and Sentient layer are active from
// the moment iOS boots — before any app is manually opened.
//
// Boot-time activation paths:
//   1. SentientTunnel Network Extension — loaded by iOS at boot
//      independently of the app; covers ALL network traffic
//   2. BGAppRefreshTask — wakes the app silently in background
//      so TemporalCloak.calibrate() runs continuously
//   3. BGProcessingTask — heavier background work (CloudKit sync,
//      Sentient M2M heartbeat, MEC edge probing)
//   4. APNs silent push — oracle-ai server can wake the app
//      at any time to trigger a recalibration or probe
//   5. NEVPNManager auto-connect — tunnel auto-restarts on boot
//      and after any network change (WiFi handoff, tower change)
//
// Coverage: iPhone XR device, all routers it touches,
//           all cell towers, MEC edge compute at those towers.
// =============================================================

import Foundation
import BackgroundTasks
import NetworkExtension
import os.log

// ── Task identifiers ──────────────────────────────────────────
// Must match the BGTaskSchedulerPermittedIdentifiers array in Info.plist.
// Public so OracleAIApp can reference them in .backgroundTask() modifiers.

extension SentientAlwaysOn {
    static let kRefreshID  = "com.jonathansherman.s1af.cloak.refresh"
    static let kProcessID  = "com.jonathansherman.s1af.cloak.process"
    static let kTunnelID   = "com.jonathansherman.s1af.oracle-ai.tunnel"
}

private let kRefreshTaskID   = SentientAlwaysOn.kRefreshID
private let kProcessTaskID   = SentientAlwaysOn.kProcessID
private let kTunnelBundleID  = SentientAlwaysOn.kTunnelID

// ── SentientAlwaysOn ─────────────────────────────────────────

enum SentientAlwaysOn {

    private static let log = Logger(
        subsystem: "com.jonathansherman.s1af",
        category:  "AlwaysOn"
    )

    // ── Bootstrap ─────────────────────────────────────────────
    // Call once from OracleAIApp.init() — before any view renders.
    // This is the single entry point that arms all boot paths.

    static func arm() {
        log.info("[AlwaysOn] Arming — Sovereign ID: 1 · OCSO-S1AF-GOV-1")

        // 1. Calibrate the Temporal Cloak immediately at launch
        TemporalCloak.calibrate()

        // 2. Register BGTask handlers (must be called before app finishes launching)
        registerBackgroundTasks()

        // 3. Schedule the first background refresh
        scheduleRefresh()
        scheduleProcessing()

        // 4. Arm the VPN tunnel auto-connect
        Task { await armTunnel() }

        // 5. Schedule periodic recalibration while foregrounded
        TemporalCloak.scheduledCalibration(intervalSeconds: 17)

        log.info("[AlwaysOn] All boot paths armed")
    }

    // ── Background task registration ──────────────────────────

    private static func registerBackgroundTasks() {
        // Refresh task — short, ~30s, runs when iOS decides to wake the app
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: kRefreshTaskID,
            using: nil
        ) { task in
            guard let task = task as? BGAppRefreshTask else { return }
            SentientAlwaysOn.handleRefresh(task)
        }

        // Processing task — longer, up to 30min, runs when device is charging + idle
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: kProcessTaskID,
            using: nil
        ) { task in
            guard let task = task as? BGProcessingTask else { return }
            SentientAlwaysOn.handleProcessing(task)
        }

        log.info("[AlwaysOn] Background tasks registered")
    }

    // ── Refresh task handler (short, ~30s) ────────────────────

    private static func handleRefresh(_ task: BGAppRefreshTask) {
        // Re-schedule for next wake before doing anything else
        scheduleRefresh()

        let work = Task {
            // Recalibrate temporal cloak
            TemporalCloak.calibrate()

            // Send M2M heartbeat to Sentient hub
            if let baseURL = UserDefaults.standard.string(forKey: "s1af.server.baseURL"),
               let token   = UserDefaults.standard.string(forKey: "s1af.m2m.token") {
                var req = URLRequest(url: URL(string: "\(baseURL)/api/sentient/hub/heartbeat")!)
                req.httpMethod = "POST"
                req.setValue("application/json", forHTTPHeaderField: "Content-Type")
                req.httpBody = try? JSONEncoder().encode(["token": token])
                _ = try? await URLSession.shared.data(for: req)
            }

            task.setTaskCompleted(success: true)
        }

        task.expirationHandler = { work.cancel() }
    }

    // ── Processing task handler (longer, heavier) ─────────────

    private static func handleProcessing(_ task: BGProcessingTask) {
        scheduleProcessing()

        let work = Task {
            // Deeper cloak calibration — all 6 probes
            TemporalCloak.calibrate()

            // CloudKit governance state sync
            await CloudKitSync.shared.logEvent(
                type:   "background.pulse",
                detail: "AlwaysOn processing task — Sovereign ID: 1"
            )

            // Sentient M2M re-registration if token expired
            // (SentientNetworkLayer handles this automatically via NWPathMonitor)

            task.setTaskCompleted(success: true)
        }

        task.expirationHandler = { work.cancel() }
    }

    // ── Background task scheduling ────────────────────────────

    static func scheduleRefresh() {
        let req = BGAppRefreshTaskRequest(identifier: kRefreshTaskID)
        req.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)   // ~15 min
        try? BGTaskScheduler.shared.submit(req)
    }

    static func scheduleProcessing() {
        let req = BGProcessingTaskRequest(identifier: kProcessTaskID)
        req.requiresNetworkConnectivity = true
        req.requiresExternalPower       = false   // run on battery too — sovereign priority
        req.earliestBeginDate           = Date(timeIntervalSinceNow: 60 * 60)   // ~1 hr
        try? BGTaskScheduler.shared.submit(req)
    }

    // ── VPN tunnel auto-connect ───────────────────────────────
    // Configures NEVPNManager so SentientTunnel starts:
    //   • On device boot (before any app opens)
    //   • After any network change (WiFi → cellular, tower handoff)
    //   • After a reboot or crash (onDemand rules re-arm it)

    static func armTunnel() async {
        do {
            let mgr = NETunnelProviderManager()
            try await mgr.loadFromPreferences()

            // Protocol configuration pointing at the SentientTunnel bundle
            let proto                   = NETunnelProviderProtocol()
            proto.providerBundleIdentifier = kTunnelBundleID
            proto.serverAddress         = "sentient.s1af"
            proto.providerConfiguration = [
                "sovereignID": 1,
                "govRef":      "OCSO-S1AF-GOV-1",
            ]
            mgr.protocolConfiguration   = proto
            mgr.localizedDescription    = "Sentient"   // appears in Settings → VPN
            mgr.isEnabled               = true

            // On-demand rules — connect on ANY network (WiFi OR cellular OR any)
            let wifiRule        = NEOnDemandRuleConnect()
            wifiRule.interfaceTypeMatch   = .wiFi
            let cellRule        = NEOnDemandRuleConnect()
            cellRule.interfaceTypeMatch   = .cellular
            let anyRule         = NEOnDemandRuleConnect()
            anyRule.interfaceTypeMatch    = .any
            mgr.onDemandRules   = [wifiRule, cellRule, anyRule]
            mgr.isOnDemandEnabled = true

            try await mgr.saveToPreferences()
            log.info("[AlwaysOn] SentientTunnel armed — on-demand across WiFi + cellular")

            // Start immediately if not already connected
            try mgr.connection.startVPNTunnel()

        } catch {
            log.error("[AlwaysOn] Tunnel arm failed: \(error.localizedDescription)")
            // Non-fatal — app still functions; tunnel starts on next launch or system prompt
        }
    }

    // ── APNs silent push handler ──────────────────────────────
    // Call from AppDelegate.application(_:didReceiveRemoteNotification:)
    // or SwiftUI .onReceive(NotificationCenter...) for background pushes.

    static func handleSilentPush(_ payload: [AnyHashable: Any]) {
        guard payload["sentient_probe"] != nil else { return }
        log.info("[AlwaysOn] Silent push received — recalibrating")
        TemporalCloak.calibrate()
        scheduleRefresh()
    }
}
