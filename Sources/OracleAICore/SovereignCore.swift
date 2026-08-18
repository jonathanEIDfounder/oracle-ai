// =============================================================
// SovereignCore.swift — OracleAICore
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
// Platforms: Linux · macOS · iOS
// =============================================================
// Cross-platform sovereign governance primitives.
// No UIKit, no SwiftUI — compiles on any Swift platform.
// =============================================================

import Foundation

// MARK: — Authorship

/// S1AF sovereign authorship anchor.
public let s1afAuthor    = "© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"
public let s1afSovereign = "OCSO-S1AF-GOV-1"
public let s1afVersion   = "1.0.0-JS"

// MARK: — Sovereign identity

/// Immutable sovereign governance record.
public struct SovereignIdentity: Sendable {
    public let governanceID: String   // "OCSO-S1AF-GOV-1"
    public let sovereignID:  Int      // 1
    public let owner:        String   // "Jonathan Sherman"
    public let framework:    String   // "S1AF"
    public let version:      String   // "1.0.0-JS"

    public init(
        governanceID: String = "OCSO-S1AF-GOV-1",
        sovereignID:  Int    = 1,
        owner:        String = "Jonathan Sherman",
        framework:    String = "S1AF",
        version:      String = "1.0.0-JS"
    ) {
        self.governanceID = governanceID
        self.sovereignID  = sovereignID
        self.owner        = owner
        self.framework    = framework
        self.version      = version
    }

    /// Canonical description — used for authorship stamps.
    public var stamp: String {
        "© 2026 \(owner) — \(governanceID) — \(framework)-DRM-LOCKED"
    }
}

/// Shared sovereign identity for S1AF.
public let sovereignIdentity = SovereignIdentity()

// MARK: — Platform detection

/// The platform this code is currently running on.
public enum S1AFPlatform: String, Sendable {
    case linux   = "linux"
    case macOS   = "macos"
    case iOS     = "ios"
    case unknown = "unknown"

    public static var current: S1AFPlatform {
#if os(Linux)
        return .linux
#elseif os(macOS)
        return .macOS
#elseif os(iOS)
        return .iOS
#else
        return .unknown
#endif
    }
}

// MARK: — Governance validation

/// Result of a governance check.
public struct GovernanceResult: Sendable {
    public let passed:   Bool
    public let platform: S1AFPlatform
    public let checks:   [String: Bool]
    public let stamp:    String

    public var summary: String {
        let ok  = checks.values.filter { $0 }.count
        let all = checks.count
        return "S1AF governance: \(ok)/\(all) checks passed on \(platform.rawValue)"
    }
}

/// Run all sovereign governance checks (cross-platform).
public func validateGovernance(identity: SovereignIdentity = sovereignIdentity) -> GovernanceResult {
    var checks: [String: Bool] = [:]

    // Authorship present
    checks["authorship"]    = !identity.owner.isEmpty
    checks["governanceID"]  = identity.governanceID.hasPrefix("OCSO-")
    checks["sovereignID"]   = identity.sovereignID == 1
    checks["versionTagged"] = identity.version.contains("-JS")

    // Platform-specific
#if os(Linux)
    checks["platform-linux"] = true
#elseif os(macOS) || os(iOS)
    checks["platform-apple"] = true
#endif

    let passed = checks.values.allSatisfy { $0 }
    return GovernanceResult(
        passed:   passed,
        platform: .current,
        checks:   checks,
        stamp:    identity.stamp
    )
}
