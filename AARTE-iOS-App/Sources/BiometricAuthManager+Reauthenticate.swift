// =============================================================
// BiometricAuthManager+Reauthenticate.swift
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
// =============================================================
// Adds a `reauthenticate()` async method to BiometricAuthManager
// so the Identity tab can trigger a fresh Face ID challenge.
// =============================================================

import LocalAuthentication

extension BiometricAuthManager {
  /// Trigger a fresh Face ID challenge without navigating away.
  func reauthenticate() async throws {
    let ctx = LAContext()
    ctx.localizedCancelTitle = "Cancel"
    var err: NSError?
    guard ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &err) else {
      throw err ?? NSError(domain: "AARTE", code: -1,
                           userInfo: [NSLocalizedDescriptionKey: "Biometrics unavailable"])
    }
    try await ctx.evaluatePolicy(
      .deviceOwnerAuthenticationWithBiometrics,
      localizedReason: "Re-verify sovereign identity — J. Sherman · SOV-ID 1"
    )
  }
}
