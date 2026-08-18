// =============================================================
// AppleAIDecisionEngine.swift — AARTE
// Apple AI Runtime & Tactical Engine
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
// =============================================================
//
// Singleton AI decision layer embedded in OracleAICore.
//
// API surface (matches call-site exactly):
//   let engine   = AppleAIDecisionEngine.shared
//   let decision = engine.analyzeBuildLog(buildOutput)       → Decision
//   let deploy   = engine.shouldAutoDeploy(testResults:)     → Bool
//   let backend  = engine.predictOptimalBackend([name:queue]) → String
// =============================================================

import Foundation

// ── Decision type ────────────────────────────────────────────────────────────

/// Action the engine recommends after analysing a build log.
public enum Decision: String, Sendable, CustomStringConvertible {
    /// All signals are green — continue the pipeline.
    case proceed = "proceed"
    /// Transient failure detected — safe to retry.
    case retry   = "retry"
    /// Non-fatal issues found — human review advised.
    case review  = "review"
    /// Hard failure — stop the pipeline immediately.
    case abort   = "abort"

    public var description: String { rawValue }
}

// ── Engine ────────────────────────────────────────────────────────────────────

/// Singleton AI decision engine that classifies build logs, gates auto-deploys,
/// and selects optimal quantum backends.
public final class AppleAIDecisionEngine: @unchecked Sendable {

    // ── Singleton ─────────────────────────────────────────────────────────────
    public static let shared = AppleAIDecisionEngine()
    private init() {}

    // ── Configuration ─────────────────────────────────────────────────────────

    /// Fraction of test suites that must pass before auto-deploy is allowed (0–1).
    public var deployThreshold: Double = 1.0   // 100 % by default (all suites)

    /// Minimum queue depth advantage before switching quantum backends.
    public var quantumQueueMargin: Int = 2

    // =========================================================================
    // MARK: — analyzeBuildLog
    // =========================================================================

    /// Analyses a raw build log and recommends a pipeline action.
    ///
    /// Heuristics (evaluated in priority order):
    ///   1. Explicit errors / compilation failures → `.abort`
    ///   2. Linker / code-signing / provisioning issues → `.abort`
    ///   3. Timeout or connection failure → `.retry`
    ///   4. Warnings or test skips → `.review`
    ///   5. Clean / success markers → `.proceed`
    ///   6. Unknown / empty log → `.review`
    ///
    /// - Parameter buildOutput: Raw string from xcodebuild, swift build, or CI.
    /// - Returns: Recommended `Decision`.
    public func analyzeBuildLog(_ buildOutput: String) -> Decision {
        let log = buildOutput.lowercased()

        // ── Abort signals ──────────────────────────────────────────────────────
        let abortPatterns: [String] = [
            "build failed",
            "compilation failed",
            "error: ",
            "❌",
            "fatal error",
            "linker command failed",
            "code signing failed",
            "provisioning profile",
            "no such module",
            "undefined symbol",
            "test suite.*failed",      // regex-like; checked below
        ]
        for pattern in abortPatterns {
            if log.contains(pattern) { return .abort }
        }
        // Regex: "test suite <name> failed"
        if let _ = log.range(of: #"test suite .+ failed"#,
                              options: .regularExpression) {
            return .abort
        }

        // ── Retry signals ──────────────────────────────────────────────────────
        let retryPatterns: [String] = [
            "timeout",
            "timed out",
            "connection refused",
            "network error",
            "could not connect",
            "temporary failure",
            "exit code 143",    // SIGTERM — typical for CI time-limit kills
        ]
        for pattern in retryPatterns {
            if log.contains(pattern) { return .retry }
        }

        // ── Review signals ─────────────────────────────────────────────────────
        let reviewPatterns: [String] = [
            "warning: ",
            "⚠️",
            "⚠",
            "skipped",
            "deprecated",
            "test skipped",
            "xctskip",
        ]
        for pattern in reviewPatterns {
            if log.contains(pattern) { return .review }
        }

        // ── Proceed signals ────────────────────────────────────────────────────
        let proceedPatterns: [String] = [
            "build succeeded",
            "** build succeeded **",
            "test suite.*passed",
            "all tests passed",
            "✓",
            "✅",
        ]
        for pattern in proceedPatterns {
            if log.contains(pattern) { return .proceed }
        }
        if let _ = log.range(of: #"test suite .+ passed"#,
                              options: .regularExpression) {
            return .proceed
        }

        // ── Fallback ───────────────────────────────────────────────────────────
        return .review
    }

    // =========================================================================
    // MARK: — shouldAutoDeploy
    // =========================================================================

    /// Determines whether automated deployment is safe given a set of test results.
    ///
    /// All entries whose value is `false` are treated as failing suites.
    /// The fraction of passing suites must meet or exceed `deployThreshold`.
    ///
    /// - Parameter testResults: Dictionary mapping suite name → passed (true/false).
    /// - Returns: `true` when the pass-rate meets the threshold and no suite failed.
    public func shouldAutoDeploy(testResults: [String: Bool]) -> Bool {
        guard !testResults.isEmpty else { return false }
        let total   = Double(testResults.count)
        let passing = Double(testResults.values.filter { $0 }.count)
        return (passing / total) >= deployThreshold
    }

    // =========================================================================
    // MARK: — predictOptimalBackend
    // =========================================================================

    /// Picks the IBM Quantum backend with the shortest estimated queue depth.
    ///
    /// When two backends are tied, the one that appears first in the dictionary
    /// (by insertion order, Swift 5.7+) is preferred. If the dictionary is empty
    /// an empty string is returned.
    ///
    /// The `quantumQueueMargin` property (default 2) adds hysteresis: the current
    /// best backend is only replaced when a challenger beats it by at least that
    /// many queue slots, preventing unnecessary backend switches for tiny gains.
    ///
    /// - Parameter backends: Dictionary mapping backend name → current queue depth.
    /// - Returns: Name of the recommended backend.
    public func predictOptimalBackend(_ backends: [String: Int]) -> String {
        guard !backends.isEmpty else { return "" }

        var bestName  = ""
        var bestDepth = Int.max

        for (name, depth) in backends {
            if bestName.isEmpty {
                // Seed with first entry
                bestName  = name
                bestDepth = depth
            } else if depth < (bestDepth - quantumQueueMargin) {
                // Only switch when gain exceeds hysteresis margin
                bestName  = name
                bestDepth = depth
            } else if depth == bestDepth {
                // Tie-break: lexicographic order for determinism
                if name < bestName {
                    bestName = name
                }
            }
        }
        return bestName
    }
}
