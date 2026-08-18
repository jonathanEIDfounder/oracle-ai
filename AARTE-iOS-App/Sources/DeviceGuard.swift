// =============================================================
// DeviceGuard.swift
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS
// Sovereign ID: 1 · OCSO-S1AF-GOV-1
// =============================================================
// Hardware identity lock — rejects any device that is not an
// iPhone XR. Checks all four hardware fingerprints simultaneously.
// A single miss terminates the app.
// =============================================================

import UIKit
import LocalAuthentication

/// S1AF hardware identity guard.
/// Call `DeviceGuard.enforce()` once at app launch, before any UI renders.
enum DeviceGuard {

    // ── iPhone XR hardware profile ─────────────────────────────
    /// Native screen height in pixels (portrait).
    private static let requiredNativeHeight: CGFloat = 1792

    /// Display scale — XR is @2x (828 pt × 2 = 1656 px wide; 414 pt × 2 = 828 pt)
    private static let requiredScale: CGFloat = 2.0

    /// Machine identifier returned by `uname`.
    /// iPhone11,8 = iPhone XR (A12 Bionic, 2018).
    private static let requiredMachineID = "iPhone11,8"

    // ── Public API ─────────────────────────────────────────────

    /// Synchronously verifies the device is an iPhone XR.
    /// Returns `.authorised` on match; `.rejected(reason:)` on any mismatch.
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

        return .success(())
    }

    /// Enforce hardware identity. Terminates the process on failure.
    /// Call once at `application(_:didFinishLaunchingWithOptions:)` or
    /// at the top of the `@main` App's `init()`.
    @MainActor
    static func enforce() {
        switch check() {
        case .success:
            break   // Authorised — continue
        case .failure(let reason):
            terminate(reason: reason)
        }
    }

    // ── Private helpers ────────────────────────────────────────

    private static func machineIdentifier() -> String {
        var info = utsname()
        uname(&info)
        return withUnsafeBytes(of: &info.machine) { raw in
            let ptr = raw.baseAddress!.assumingMemoryBound(to: CChar.self)
            return String(cString: ptr)
        }
    }

    @MainActor
    private static func terminate(reason: GuardFailure) {
        let alert = UIAlertController(
            title: "Unauthorized Device",
            message: "This application is authorized exclusively for use on an iPhone XR.\n\n\(reason.userMessage)",
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
            }
        }

        var fatalMessage: String {
            switch self {
            case .wrongScreenHeight(let g, let e):  return "Screen height \(g) ≠ \(e)"
            case .wrongDisplayScale(let g, let e):  return "Scale \(g)x ≠ \(e)x"
            case .wrongMachineID(let g, let e):     return "Machine \(g) ≠ \(e)"
            case .faceIDUnavailable:                return "Face ID unavailable"
            }
        }
    }
}
