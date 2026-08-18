// =============================================================
// SovereignCoreTests.swift — OracleAICoreTests
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
// Platforms: Linux · macOS · iOS
// =============================================================

import XCTest
@testable import OracleAICore

final class SovereignCoreTests: XCTestCase {

    // MARK: — Identity

    func testAuthorshipStamp() {
        XCTAssertTrue(s1afAuthor.contains("Jonathan Sherman"))
        XCTAssertTrue(s1afAuthor.contains("OCSO-S1AF-GOV-1"))
        XCTAssertTrue(s1afAuthor.contains("DRM-LOCKED"))
    }

    func testSovereignIdentityDefaults() {
        let id = SovereignIdentity()
        XCTAssertEqual(id.governanceID, "OCSO-S1AF-GOV-1")
        XCTAssertEqual(id.sovereignID,  1)
        XCTAssertEqual(id.owner,        "Jonathan Sherman")
        XCTAssertEqual(id.framework,    "S1AF")
        XCTAssertTrue(id.version.hasSuffix("-JS"))
    }

    func testStampFormat() {
        let stamp = sovereignIdentity.stamp
        XCTAssertTrue(stamp.hasPrefix("© 2026"))
        XCTAssertTrue(stamp.contains("OCSO-S1AF-GOV-1"))
    }

    // MARK: — Governance validation

    func testGovernancePasses() {
        let result = validateGovernance()
        XCTAssertTrue(result.passed, "Governance should pass: \(result.checks)")
        XCTAssertEqual(result.platform, .current)
    }

    func testGovernanceChecks() {
        let result = validateGovernance()
        XCTAssertTrue(result.checks["authorship"]   == true)
        XCTAssertTrue(result.checks["governanceID"] == true)
        XCTAssertTrue(result.checks["sovereignID"]  == true)
        XCTAssertTrue(result.checks["versionTagged"] == true)
    }

    func testGovernanceSummary() {
        let result = validateGovernance()
        XCTAssertTrue(result.summary.contains("S1AF governance"))
        XCTAssertTrue(result.summary.contains("passed on"))
    }

    // MARK: — Platform detection

    func testPlatformDetected() {
        let p = S1AFPlatform.current
        XCTAssertNotEqual(p, .unknown)
    }

    // MARK: — Environment info

    func testEnvironmentInfo() {
        let env = EnvironmentInfo.current()
        XCTAssertFalse(env.hostname.isEmpty)
        XCTAssertGreaterThan(env.cpuCount, 0)
        XCTAssertGreaterThan(env.memoryBytes, 0)
    }

    // MARK: — iPhone XR profile

    func testXRProfile() {
        XCTAssertEqual(iPhoneXRProfile.machineID, "iPhone11,8")
        XCTAssertEqual(iPhoneXRProfile.nativeHeight, 1792)
        XCTAssertEqual(iPhoneXRProfile.displayScale, 2.0)
    }

    // MARK: — KimiClient validation

    func testKimiClientRejectsEmptyKey() {
        XCTAssertThrowsError(try KimiClient(apiKey: "")) { error in
            guard case KimiError.missingAPIKey = error else {
                return XCTFail("Expected missingAPIKey, got \(error)")
            }
        }
    }

    func testKimiClientRejectsNonPrefixedKey() {
        XCTAssertThrowsError(try KimiClient(apiKey: "not-a-real-key")) { error in
            guard case KimiError.missingAPIKey = error else {
                return XCTFail("Expected missingAPIKey, got \(error)")
            }
        }
    }

    func testKimiClientAcceptsValidKeyFormat() {
        XCTAssertNoThrow(try KimiClient(apiKey: "sk-testvalidkeyformat12345678901234567890"))
    }
}
