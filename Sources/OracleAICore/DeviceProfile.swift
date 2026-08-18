// =============================================================
// DeviceProfile.swift — OracleAICore
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
// Platforms: Linux · macOS · iOS
// =============================================================
// Cross-platform device / environment profiling.
// On Linux: reads /proc/cpuinfo, uname, hostname.
// On Apple: wraps ProcessInfo without UIKit dependency.
// =============================================================

import Foundation

// MARK: — Environment info

public struct EnvironmentInfo: Sendable {
    public let platform:     String
    public let hostname:     String
    public let cpuCount:     Int
    public let memoryBytes:  UInt64
    public let osVersion:    String

    public static func current() -> EnvironmentInfo {
        let pi = ProcessInfo.processInfo
        return EnvironmentInfo(
            platform:    S1AFPlatform.current.rawValue,
            hostname:    pi.hostName,
            cpuCount:    pi.processorCount,
            memoryBytes: pi.physicalMemory,
            osVersion:   pi.operatingSystemVersionString
        )
    }

    public var summary: String {
        "[\(platform)] \(hostname) · \(cpuCount) CPUs · \(memoryBytes / 1_073_741_824)GB RAM · \(osVersion)"
    }
}

// MARK: — iPhone XR hardware constants (cross-platform reference)

/// iPhone XR hardware profile — used on Linux for doc/validation purposes.
/// Actual hardware checks run in DeviceGuard.swift (UIKit, iOS only).
public enum iPhoneXRProfile {
    public static let machineID       = "iPhone11,8"
    public static let nativeHeight    = 1792
    public static let displayScale    = 2.0
    public static let chip            = "A12 Bionic"
    public static let diagonalInches  = 6.1
    public static let year            = 2018

    public static var description: String {
        "\(machineID) · \(chip) · \(diagonalInches)\" · \(year)"
    }
}
