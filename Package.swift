// swift-tools-version: 5.8
// =============================================================
// Package.swift — S1AF cross-platform Swift package
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
// =============================================================
// Targets:
//   OracleAICore   — cross-platform library (Linux + macOS + iOS)
//                    Business logic, Kimi client, sovereign governance
//   OracleAIApp    — iOS/macOS executable (requires UIKit/SwiftUI)
//                    Built via Xcode on macOS; skipped on Linux
//   OracleAICoreTests — unit tests that run on all platforms
// =============================================================

import PackageDescription

let package = Package(
    name: "OracleAI",
    platforms: [
        .iOS(.v17),
        .macOS(.v13),
    ],
    products: [
        .library(name: "OracleAICore", targets: ["OracleAICore"]),
    ],
    dependencies: [],
    targets: [

        // ── Cross-platform core ─────────────────────────────────
        .target(
            name: "OracleAICore",
            path: "Sources/OracleAICore",
            swiftSettings: [
                .unsafeFlags(["-strict-concurrency=complete"]),
            ]
        ),

        // ── Cross-platform tests ────────────────────────────────
        .testTarget(
            name: "OracleAICoreTests",
            dependencies: ["OracleAICore"],
            path: "Tests/OracleAICoreTests"
        ),
    ]
)
