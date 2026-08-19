// =============================================================
// SentientNetworkLayer.swift
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · Celestial Core
// Sovereign ID: 1 · OCSO-S1AF-GOV-1
// =============================================================
// Sentient network presence layer for iOS.
//
// Spans ALL wireless networks simultaneously:
//   • WiFi (802.11 a/b/g/n/ac/ax) via ISP
//   • Cellular (LTE / 5G) via cell tower
//   • Auto-failover: WiFi → Cellular → WiFi
//   • Background connectivity: Sentient stays alive when app backgrounds
//
// M2M: this layer registers the device with the Sentient Hub as
// an M2M peer and keeps a persistent SSE stream open so the
// sovereign can push commands to the device at any time.
// =============================================================

import Foundation
import Network
import os.log

// ── Network path monitor ──────────────────────────────────────

/// Monitors WiFi and cellular simultaneously, reports the best path.
@Observable
@MainActor
final class SentientNetworkLayer {

    // ── Singleton ──────────────────────────────────────────────
    static let shared = SentientNetworkLayer()
    private init() { startMonitor() }

    private let log = Logger(subsystem: "com.jonathansherman.s1af", category: "SentientNetwork")

    // ── Observed state ─────────────────────────────────────────
    private(set) var isOnline:    Bool = false
    private(set) var hasWiFi:     Bool = false
    private(set) var hasCellular: Bool = false
    private(set) var activeInterface: String = "none"

    // ── M2M peer token (issued by SentientHub on registration) ──
    private(set) var peerToken: String? = nil
    private(set) var peerId:    String? = nil

    // ── Internal ───────────────────────────────────────────────
    private let monitor = NWPathMonitor()
    private let monitorQ = DispatchQueue(label: "sentient.network.monitor", qos: .utility)
    private var sseTask: URLSessionDataTask? = nil
    private var retryCount = 0
    private let maxRetry   = 10

    // URLSession configured for both WiFi and cellular — no restriction
    private lazy var session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.allowsCellularAccess        = true   // always use cellular if available
        cfg.allowsConstrainedNetworkAccess = true // low-data mode: still connect
        cfg.allowsExpensiveNetworkAccess   = true // cellular counts as "expensive" — allow anyway
        cfg.timeoutIntervalForRequest   = 30
        cfg.timeoutIntervalForResource  = 300
        cfg.waitsForConnectivity        = true   // queue requests until network available
        return URLSession(configuration: cfg)
    }()

    // Background URLSession — keeps SSE alive when app is backgrounded
    private lazy var backgroundSession: URLSession = {
        let cfg = URLSessionConfiguration.background(
            withIdentifier: "com.jonathansherman.s1af.sentient.background"
        )
        cfg.allowsCellularAccess           = true
        cfg.allowsConstrainedNetworkAccess = true
        cfg.allowsExpensiveNetworkAccess   = true
        cfg.sessionSendsLaunchEvents       = true  // wake app on push
        cfg.isDiscretionary                = false  // never defer — sovereign priority
        return URLSession(configuration: cfg)
    }()

    // ── Network monitor ────────────────────────────────────────

    private func startMonitor() {
        monitor.pathUpdateHandler = { [weak self] path in
            guard let self else { return }
            Task { @MainActor in
                self.isOnline        = path.status == .satisfied
                self.hasWiFi         = path.usesInterfaceType(.wifi)
                self.hasCellular     = path.usesInterfaceType(.cellular)
                self.activeInterface = self.describeInterface(path)

                self.log.info("[SentientNetwork] Path update — online=\(self.isOnline) " +
                    "wifi=\(self.hasWiFi) cellular=\(self.hasCellular) if=\(self.activeInterface)")

                if self.isOnline {
                    await self.ensureRegistered()
                }
            }
        }
        monitor.start(queue: monitorQ)
        log.info("[SentientNetwork] Path monitor started — WiFi + cellular both enabled")
    }

    private func describeInterface(_ path: NWPath) -> String {
        if path.usesInterfaceType(.wifi)     { return "wifi" }
        if path.usesInterfaceType(.cellular) { return "cellular" }
        if path.usesInterfaceType(.wiredEthernet) { return "ethernet" }
        if path.usesInterfaceType(.loopback) { return "loopback" }
        return "unknown"
    }

    // ── M2M peer registration ──────────────────────────────────

    /// Register this device as a Sentient M2M peer.
    /// Called automatically when network becomes available.
    private func ensureRegistered() async {
        guard peerToken == nil else { return }   // already registered
        guard let baseURL = serverBaseURL else {
            log.warning("[SentientNetwork] No server URL configured — cannot register")
            return
        }

        var req = URLRequest(url: URL(string: "\(baseURL)/api/sentient/hub/register")!)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONEncoder().encode([
            "name":     "iPhone XR · Sovereign ID: 1",
            "platform": "ios",
            "arch":     "arm64",
            "network":  activeInterface,
        ])

        do {
            let (data, resp) = try await session.data(for: req)
            guard (resp as? HTTPURLResponse)?.statusCode == 200 else { return }
            let json = try JSONDecoder().decode([String: String].self, from: data)
            peerToken = json["token"]
            peerId    = json["id"]
            log.info("[SentientNetwork] Registered as M2M peer — id=\(json["id"] ?? "?")")
            // Open SSE stream
            await openSSEStream(baseURL: baseURL)
        } catch {
            log.error("[SentientNetwork] Registration failed: \(error.localizedDescription)")
        }
    }

    // ── SSE stream (sovereign push commands) ───────────────────

    private func openSSEStream(baseURL: String) async {
        guard let token = peerToken,
              let url   = URL(string: "\(baseURL)/api/sentient/hub/stream?token=\(token)")
        else { return }

        var req           = URLRequest(url: url)
        req.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        req.allowsCellularAccess = true

        sseTask = session.dataTask(with: req) { [weak self] data, resp, err in
            guard let self else { return }
            if let err {
                self.log.error("[SentientNetwork] SSE disconnected: \(err.localizedDescription)")
                Task { await self.scheduleReconnect() }
                return
            }
            if let data, let text = String(data: data, encoding: .utf8) {
                self.handleSSEData(text)
            }
        }
        sseTask?.resume()
        log.info("[SentientNetwork] SSE stream opened — sovereign push enabled")
    }

    private func handleSSEData(_ text: String) {
        // Parse SSE events (format: "event: X\ndata: Y\n\n")
        for chunk in text.components(separatedBy: "\n\n") {
            guard !chunk.isEmpty else { continue }
            var event = "message", dataStr = ""
            for line in chunk.components(separatedBy: "\n") {
                if line.hasPrefix("event: ") { event   = String(line.dropFirst(7)) }
                if line.hasPrefix("data: ")  { dataStr = String(line.dropFirst(6)) }
            }
            log.debug("[SentientNetwork] SSE event=\(event) data=\(dataStr.prefix(80))")
            // Broadcast to the app via NotificationCenter so any view can respond
            NotificationCenter.default.post(
                name:   .sentientHubEvent,
                object: nil,
                userInfo: ["event": event, "data": dataStr]
            )
        }
    }

    private func scheduleReconnect() async {
        guard retryCount < maxRetry else {
            log.error("[SentientNetwork] Max reconnect attempts reached")
            return
        }
        let delay = min(pow(2.0, Double(retryCount)), 60)  // exp backoff, max 60s
        retryCount += 1
        log.info("[SentientNetwork] Reconnecting in \(delay)s (attempt \(retryCount))")
        try? await Task.sleep(for: .seconds(delay))
        peerToken = nil   // force re-registration
        peerId    = nil
        if isOnline { await ensureRegistered() }
    }

    // ── M2M query (any network, any time) ─────────────────────

    /// Send a query to Sentient via the M2M hub.
    /// Works over WiFi or cellular. Queues if offline and retries.
    func query(_ prompt: String, maxTokens: Int = 512) async throws -> String {
        guard let baseURL = serverBaseURL, let token = peerToken else {
            throw SentientNetworkError.notRegistered
        }
        var req = URLRequest(url: URL(string: "\(baseURL)/api/sentient/hub/query")!)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode([
            "token":     token,
            "prompt":    prompt,
            "maxTokens": String(maxTokens),
        ])
        req.allowsCellularAccess = true

        let (data, resp) = try await session.data(for: req)
        guard (resp as? HTTPURLResponse)?.statusCode == 200 else {
            throw SentientNetworkError.hubError("HTTP \((resp as? HTTPURLResponse)?.statusCode ?? 0)")
        }
        let json = try JSONDecoder().decode([String: String].self, from: data)
        return json["response"] ?? ""
    }

    // ── Helpers ────────────────────────────────────────────────

    private var serverBaseURL: String? {
        UserDefaults.standard.string(forKey: "s1af.server.baseURL")
    }
}

// ── Notification name ─────────────────────────────────────────

extension Notification.Name {
    /// Posted when the Sentient Hub sends an SSE event to this device.
    static let sentientHubEvent = Notification.Name("SentientHubEvent")
}

// ── Errors ────────────────────────────────────────────────────

enum SentientNetworkError: Error, LocalizedError {
    case notRegistered
    case hubError(String)

    var errorDescription: String? {
        switch self {
        case .notRegistered:    return "Sentient M2M peer not yet registered — awaiting network"
        case .hubError(let m):  return "Sentient Hub error: \(m)"
        }
    }
}
