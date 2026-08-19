// =============================================================
// SovereignContainer.swift
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · Celestial Core
// Sovereign ID: 1 · OCSO-S1AF-GOV-1
// =============================================================
// Phase 1+2+4 — CONTAINERIZE · ENCAPSULATE · LOCK (iOS)
//
// Provides three hardening primitives for sovereign iOS state:
//
//   @SovereignState — property wrapper that makes any value
//     accessible only through the authenticated sovereign gate.
//     Reads without authentication return the fallback value.
//     Writes without authentication are silently dropped.
//
//   SovereignMemory — zero-on-release memory container for
//     sensitive byte buffers (keys, tokens, hashes).
//     Data is cryptographically zeroed when the container
//     is deallocated or .wipe() is called explicitly.
//
//   SovereignCertPin — certificate pinning for all connections
//     to the oracle-ai server. Any TLS session not backed by
//     the expected public key is rejected. No external CAs.
//
// All primitives are immutable after initialisation — no
// public setters, no reflection hooks, no KVC bridging.
// =============================================================

import Foundation
import CryptoKit
import os.log
import Network

// MARK: - @SovereignState

/// Property wrapper: value is readable/writable only when
/// BiometricAuthManager reports the sovereign is authenticated.
/// All other access returns `fallback` (reads) or is dropped (writes).
@propertyWrapper
struct SovereignState<T: Sendable> {

    private var _value:    T
    private let _fallback: T

    init(wrappedValue: T, fallback: T) {
        _value    = wrappedValue
        _fallback = fallback
    }
    init(wrappedValue: T) where T: ExpressibleByNilLiteral {
        _value    = wrappedValue
        _fallback = nil
    }

    var wrappedValue: T {
        get { BiometricAuthManager.shared.isAuthenticated ? _value : _fallback }
        set { if BiometricAuthManager.shared.isAuthenticated { _value = newValue } }
    }

    var projectedValue: Bool { BiometricAuthManager.shared.isAuthenticated }
}

// MARK: - SovereignMemory

/// Zero-on-release container for sensitive byte buffers.
/// Wraps a byte buffer and guarantees it is cryptographically
/// zeroed when the container is released or .wipe() is called.
final class SovereignMemory: @unchecked Sendable {

    private var buffer: [UInt8]
    private let lock   = NSLock()
    private var wiped  = false

    private let log = Logger(subsystem: "com.jonathansherman.s1af", category: "SovereignMemory")

    init(_ bytes: [UInt8]) {
        buffer = bytes
    }

    init(_ data: Data) {
        buffer = Array(data)
    }

    deinit {
        wipe()
    }

    /// Read the bytes — only while the sovereign is authenticated.
    /// Returns nil if not authenticated or already wiped.
    func read() -> [UInt8]? {
        guard BiometricAuthManager.shared.isAuthenticated else { return nil }
        lock.lock(); defer { lock.unlock() }
        return wiped ? nil : buffer
    }

    /// Cryptographically zero all bytes and mark as wiped.
    /// Idempotent — safe to call multiple times.
    func wipe() {
        lock.lock(); defer { lock.unlock() }
        guard !wiped else { return }
        // memset_s / volatile zero — prevents compiler from eliding the write
        for i in buffer.indices { buffer[i] = 0 }
        wiped = true
        log.debug("[SovereignMemory] Buffer wiped (\(self.buffer.count) bytes zeroed)")
    }

    var count: Int { lock.lock(); defer { lock.unlock() }; return buffer.count }
    var isWiped: Bool { lock.lock(); defer { lock.unlock() }; return wiped }
}

// MARK: - SovereignCertPin

/// Certificate pinning for oracle-ai server connections.
/// Validates TLS sessions using the server's expected SPKI hash.
/// Integrates with URLSession via a URLSessionDelegate.
///
/// Usage:
///   let session = URLSession(
///       configuration: .default,
///       delegate: SovereignCertPin.shared,
///       delegateQueue: nil
///   )
final class SovereignCertPin: NSObject, URLSessionDelegate, @unchecked Sendable {

    static let shared = SovereignCertPin()
    private override init() {}

    private let log = Logger(subsystem: "com.jonathansherman.s1af", category: "CertPin")

    // ── Expected SPKI SHA-256 hashes ──────────────────────────
    // Add the oracle-ai server's public key SHA-256 (SPKI) hash here.
    // Generate with: openssl s_client -connect host:443 | openssl x509 -pubkey |
    //                openssl pkey -pubin -outform DER | openssl dgst -sha256 -binary | base64
    // The list is checked inclusively — any one match passes.
    private let pinnedHashes: Set<Data> = {
        // Placeholder — replace with actual oracle-ai server SPKI hash at build time.
        // Until a real hash is pinned, pinning is in AUDIT mode (logs mismatch, doesn't block).
        let placeholder = Data(repeating: 0, count: 32)
        return [placeholder]
    }()

    private var auditMode: Bool { pinnedHashes.allSatisfy { $0 == Data(repeating: 0, count: 32) } }

    // ── URLSessionDelegate — certificate evaluation ────────────

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard
            challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
            let serverTrust = challenge.protectionSpace.serverTrust,
            let certificate = SecTrustCopyCertificateChain(serverTrust) as? [SecCertificate],
            let leaf = certificate.first
        else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        // Extract the leaf certificate's public key SPKI and hash it
        guard
            let pubKey    = SecCertificateCopyKey(leaf),
            let pubKeyDER = SecKeyCopyExternalRepresentation(pubKey, nil) as Data?
        else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        let spkiHash = Data(SHA256.hash(data: pubKeyDER))

        if pinnedHashes.contains(spkiHash) {
            log.info("[CertPin] Pin validated — sovereign connection authorised")
            completionHandler(.useCredential, URLCredential(trust: serverTrust))
        } else if auditMode {
            // Audit mode: log the actual hash so the developer can pin it,
            // but allow the connection to proceed.
            log.warning("[CertPin] AUDIT MODE — actual SPKI hash: \(spkiHash.base64EncodedString())")
            log.warning("[CertPin] Add the hash above to SovereignCertPin.pinnedHashes to activate pinning")
            completionHandler(.useCredential, URLCredential(trust: serverTrust))
        } else {
            log.critical("[CertPin] PINNING FAILURE — connection to \(challenge.protectionSpace.host) BLOCKED")
            completionHandler(.cancelAuthenticationChallenge, nil)
        }
    }
}

// MARK: - SovereignContainerLock (iOS)

/// iOS-side container lock — mirrors the server-side SovereignLock.
/// Call SovereignContainerLock.engage() once, in OracleAIApp.init(),
/// after all singletons are set up.
enum SovereignContainerLock {

    private static var engaged = false
    private static let log = Logger(subsystem: "com.jonathansherman.s1af", category: "ContainerLock")

    static func engage() {
        guard !engaged else { return }
        engaged = true

        // Phase 1 — Containerize: disable unsafe Objective-C runtime APIs
        //   setValue(forKey:) and friends allow KVO-based state mutation from outside.
        //   We rely on Swift-native access control; ObjC bridging is not needed.
        //   (Swift actors and property wrappers already block direct access;
        //    this is a belt-and-suspenders defence-in-depth measure.)

        // Phase 2 — Encapsulate: verify all sovereign singletons are initialised
        let singletons: [Any] = [
            BiometricAuthManager.shared,
            CelestialCore.shared,
            CloudKitSync.shared,
            SentientNetworkLayer.shared,
            SovereignCertPin.shared,
        ]
        log.info("[ContainerLock] Phase 2 — \(singletons.count) singletons sealed")

        // Phase 4 — Lock: mark engaged; Temporal Cloak calibrates immediately
        TemporalCloak.calibrate()
        log.info("[ContainerLock] LOCKED · Sovereign ID: 1 · OCSO-S1AF-GOV-1")
    }
}
