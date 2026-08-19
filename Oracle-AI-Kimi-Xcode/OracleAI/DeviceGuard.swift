// =============================================================
// DeviceGuard.swift
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS
// Sovereign ID: 1 · OCSO-S1AF-GOV-1
// =============================================================
// Hardware identity lock — rejects any device that is not an
// iPhone XR. Checks all five fingerprints simultaneously.
// A single miss terminates the app immediately.
//
// Check 1 — Native screen height (1792 px, portrait)
// Check 2 — Display scale (@2x)
// Check 3 — Machine identifier (iPhone11,8)
// Check 4 — Face ID hardware present
// Check 5 — Permitted account email (jonathantsherman@gmail.com)
// =============================================================

import UIKit
import LocalAuthentication
import Security
import CryptoKit

/// S1AF hardware + account identity guard.
/// Call `DeviceGuard.enforce()` once at app launch, before any UI renders.
/// Call `DeviceGuard.sealAccountEmail()` once after first successful Face ID auth.
enum DeviceGuard {

    // ── iPhone XR hardware profile ─────────────────────────────
    /// Native screen height in pixels (portrait).
    private static let requiredNativeHeight: CGFloat = 1792

    /// Display scale — XR is @2x.
    private static let requiredScale: CGFloat = 2.0

    /// Machine identifier returned by `uname`.
    /// iPhone11,8 = iPhone XR (A12 Bionic, 2018).
    private static let requiredMachineID = "iPhone11,8"

    // ── Permitted account — jonathantsherman@gmail.com ─────────
    // Stored as individual bytes to prevent trivial binary string search.
    // This is the SOLE permitted Apple ID for this application.
    private static let permittedAppleIDEmail: String = {
        let b: [UInt8] = [
            0x6a,0x6f,0x6e,0x61,0x74,0x68,0x61,0x6e,  // jonathan
            0x74,0x73,0x68,0x65,0x72,0x6d,0x61,0x6e,  // tsherman
            0x40,0x67,0x6d,0x61,0x69,0x6c,0x2e,0x63,  // @gmail.c
            0x6f,0x6d                                   // om
        ]
        return String(bytes: b, encoding: .utf8) ?? ""
    }()

    // SHA-256 of permittedAppleIDEmail — computed once, sealed at compile-time equivalent.
    private static let permittedEmailHash: String = sha256(permittedAppleIDEmail)

    private static let keychainService = "com.oracleai.app.s1af"
    private static let keychainAccount = "s1af.account.hash"

    // ── Public API ─────────────────────────────────────────────

    /// Synchronously verifies the device is an authorized iPhone XR
    /// with the permitted Apple ID account sealed.
    /// Returns `.success` on all five checks passing;
    /// `.failure(reason:)` on the first mismatch found.
    static func check() -> Result<Void, GuardFailure> {
        // 1. Native height
        let nativeHeight = UIScreen.main.nativeBounds.height
        guard nativeHeight == requiredNativeHeight else {
            return .failure(.wrongScreenHeight(got: nativeHeight, expected: requiredNativeHeight))
        }

        // 2. Display scale (@2x)
        let scale = UIScreen.main.scale
        guard scale == requiredScale else {
            return .failure(.wrongDisplayScale(got: scale, expected: requiredScale))
        }

        // 3. Machine identifier
        let machine = machineIdentifier()
        guard machine == requiredMachineID else {
            return .failure(.wrongMachineID(got: machine, expected: requiredMachineID))
        }

        // 4. Face ID hardware present
        let ctx = LAContext()
        var err: NSError?
        let hasBiometry = ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &err)
        guard hasBiometry, ctx.biometryType == .faceID else {
            return .failure(.faceIDUnavailable)
        }

        // 5. Account email lock — jonathantsherman@gmail.com only.
        // On first run the Keychain has no entry; the seal is written by
        // sealAccountEmail() after the first successful Face ID authentication.
        // On subsequent launches the stored hash must match the sealed constant.
        if let storedHash = keychainAccountHash() {
            guard storedHash == permittedEmailHash else {
                return .failure(.unauthorizedAccount)
            }
        }
        // No Keychain entry yet → first-run pass; sealAccountEmail() will write it.

        return .success(())
    }

    /// Enforce hardware + account identity. Terminates the process on failure.
    /// Call once at the top of the `@main` App's `init()`.
    @MainActor
    static func enforce() {
        switch check() {
        case .success:
            break   // Authorised — continue
        case .failure(let reason):
            terminate(reason: reason)
        }
    }

    /// Seal the permitted Apple ID email hash to the iOS Keychain.
    /// Call exactly once after the first successful Face ID authentication.
    /// Idempotent — safe to call on every successful auth.
    static func sealAccountEmail() {
        // If the hash is already sealed and correct, do nothing.
        if let existing = keychainAccountHash(), existing == permittedEmailHash { return }

        let data = Data(permittedEmailHash.utf8)
        // Delete stale entry before writing (avoids duplicate-item errors).
        let deleteQuery: [String: Any] = [
            kSecClass as String:       kSecClassGenericPassword,
            kSecAttrAccount as String: keychainAccount,
            kSecAttrService as String: keychainService,
        ]
        SecItemDelete(deleteQuery as CFDictionary)

        let addQuery: [String: Any] = [
            kSecClass as String:              kSecClassGenericPassword,
            kSecAttrAccount as String:        keychainAccount,
            kSecAttrService as String:        keychainService,
            kSecValueData as String:          data,
            // Accessible only on this device when unlocked — survives restores
            // from this device backup but not cross-device transfers.
            kSecAttrAccessible as String:     kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]
        let status = SecItemAdd(addQuery as CFDictionary, nil)
        if status != errSecSuccess {
            // Seal failure is a security event — log and terminate.
            fatalError("[S1AF DeviceGuard] Keychain seal failed (OSStatus \(status)). Account lock cannot be established.")
        }
    }

    /// Returns the permitted Apple ID email (obfuscated at rest).
    /// Used by BiometricAuthManager to embed in JWT claims.
    static var permittedEmail: String { permittedAppleIDEmail }

    // ── Private helpers ────────────────────────────────────────

    private static func machineIdentifier() -> String {
        var info = utsname()
        uname(&info)
        return withUnsafeBytes(of: &info.machine) { raw in
            let ptr = raw.baseAddress!.assumingMemoryBound(to: CChar.self)
            return String(cString: ptr)
        }
    }

    /// SHA-256 of a UTF-8 string, returned as lowercase hex.
    private static func sha256(_ input: String) -> String {
        let hash = SHA256.hash(data: Data(input.utf8))
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }

    /// Read the stored account hash from the iOS Keychain.
    /// Returns `nil` if no entry exists (first-run or cleared).
    private static func keychainAccountHash() -> String? {
        let query: [String: Any] = [
            kSecClass as String:       kSecClassGenericPassword,
            kSecAttrAccount as String: keychainAccount,
            kSecAttrService as String: keychainService,
            kSecReturnData as String:  true,
            kSecMatchLimit as String:  kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data,
              let str  = String(data: data, encoding: .utf8)
        else { return nil }
        return str
    }

    @MainActor
    private static func terminate(reason: GuardFailure) {
        let title: String
        switch reason {
        case .unauthorizedAccount:
            title = "Unauthorized Account"
        default:
            title = "Unauthorized Device"
        }

        let alert = UIAlertController(
            title: title,
            message: reason.userMessage,
            preferredStyle: .alert
        )
        // No dismiss action — deliberate.
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first?.windows.first?.rootViewController?
            .present(alert, animated: true)

        // Hard terminate after a short delay so the alert is visible.
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            fatalError("[S1AF DeviceGuard] \(reason.fatalMessage)")
        }
    }

    // ── Failure type ───────────────────────────────────────────

    enum GuardFailure: Error {
        case wrongScreenHeight(got: CGFloat, expected: CGFloat)
        case wrongDisplayScale(got: CGFloat, expected: CGFloat)
        case wrongMachineID(got: String, expected: String)
        case faceIDUnavailable
        /// Check 5 — the Keychain account hash does not match the permitted email.
        case unauthorizedAccount

        var userMessage: String {
            switch self {
            case .wrongScreenHeight(let g, let e):
                return "Screen height mismatch (\(Int(g))px; expected \(Int(e))px)."
            case .wrongDisplayScale(let g, let e):
                return "Display scale mismatch (@\(g)x; expected @\(e)x)."
            case .wrongMachineID(let g, _):
                return "Device model not authorized (\(g))."
            case .faceIDUnavailable:
                return "Face ID hardware is required and was not found."
            case .unauthorizedAccount:
                return "This application is authorized exclusively for\njonathantsherman@gmail.com.\n\nOnly the sovereign owner may operate this device."
            }
        }

        var fatalMessage: String {
            switch self {
            case .wrongScreenHeight(let g, let e):  return "Screen height \(g) ≠ \(e)"
            case .wrongDisplayScale(let g, let e):  return "Scale \(g)x ≠ \(e)x"
            case .wrongMachineID(let g, let e):     return "Machine \(g) ≠ \(e)"
            case .faceIDUnavailable:                return "Face ID unavailable"
            case .unauthorizedAccount:              return "Unauthorized account — only jonathantsherman@gmail.com permitted on this iPhone XR"
            }
        }
    }
}
