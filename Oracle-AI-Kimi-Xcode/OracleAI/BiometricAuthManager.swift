// =============================================================
// BiometricAuthManager.swift
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS
// Sovereign ID: 1 · OCSO-S1AF-GOV-1
// =============================================================
// Face ID gate — blocks all app content until the sovereign
// owner authenticates. No bypass. No guest mode. No skip.
//
// On every successful authentication:
//   • DeviceGuard.sealAccountEmail() is called to lock
//     jonathantsherman@gmail.com to the Keychain.
//   • The permitted email is written to UserDefaults so
//     the JWT issuer can embed it as the `email` claim.
// =============================================================

import LocalAuthentication
import SwiftUI

/// Sovereign biometric authentication manager.
/// Must be instantiated as a singleton at app launch.
/// All views must remain hidden until `isAuthenticated == true`.
@Observable
@MainActor
final class BiometricAuthManager {

    // ── State ──────────────────────────────────────────────────
    private(set) var isAuthenticated: Bool = false
    private(set) var isEvaluating:    Bool = false
    private(set) var lastError:        String? = nil
    private(set) var biometryType:     LABiometryType = .none

    // ── Singleton ──────────────────────────────────────────────
    static let shared = BiometricAuthManager()
    private init() {}

    // ── Biometry probe ─────────────────────────────────────────
    /// Returns true only when the device supports Face ID.
    var isFaceIDAvailable: Bool {
        let ctx = LAContext()
        var error: NSError?
        let capable = ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        return capable && ctx.biometryType == .faceID
    }

    // ── Primary auth entry point ───────────────────────────────
    /// Triggers Face ID. Idempotent — no-op if already authenticated.
    func authenticate() async {
        guard !isAuthenticated, !isEvaluating else { return }

        isEvaluating = true
        lastError    = nil

        let ctx    = LAContext()
        var canErr: NSError?

        guard ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &canErr),
              ctx.biometryType == .faceID
        else {
            lastError    = "Face ID is required. This device is not authorized."
            isEvaluating = false
            return
        }

        biometryType = ctx.biometryType

        do {
            let reason = "Verify you are Jonathan Sherman — OCSO-S1AF-GOV-1"
            let result = try await ctx.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )
            isAuthenticated = result
            if result {
                // ── Account lock — seal jonathantsherman@gmail.com ─────────
                DeviceGuard.sealAccountEmail()
                UserDefaults.standard.set(
                    DeviceGuard.permittedEmail,
                    forKey: "s1af.sovereign.account.email"
                )

                // ── S1AF sovereign stack bootstrap ─────────────────────────
                // Runs once per authenticated session, in priority order.
                Task {
                    // 1. Metal GPU + ANE + Apple Intelligence inference stack
                    //    Loads CelestialShader.metal (compiled → default.metallib)
                    await CelestialCore.shared.warmUp()

                    // 2. Sentient M2M network layer — WiFi + cellular + MEC
                    _ = SentientNetworkLayer.shared   // triggers NWPathMonitor + registration

                    // 3. CloudKit sovereign database
                    await CloudKitSync.shared.bootstrap()

                    // 4. Siri/Shortcuts — donate Sentient intents
                    donateSovereignShortcuts()

                    // 5. Schedule background tasks
                    SentientAlwaysOn.scheduleRefresh()
                    SentientAlwaysOn.scheduleProcessing()
                }
            } else {
                lastError = "Authentication was not confirmed."
            }
        } catch let err as LAError {
            lastError = err.sovereignDescription
        } catch {
            lastError = error.localizedDescription
        }

        isEvaluating = false
    }

    /// Hard-lock: revoke the session (e.g. on background/foreground transition).
    func revoke() {
        isAuthenticated = false
        lastError       = nil
    }
}

// ── LAError — sovereign descriptions ──────────────────────────
private extension LAError {
    var sovereignDescription: String {
        switch code {
        case .authenticationFailed:   return "Face ID did not recognize the sovereign owner."
        case .userCancel:             return "Authentication cancelled."
        case .userFallback:           return "Password fallback is disabled for sovereign access."
        case .biometryNotAvailable:   return "Face ID hardware is not available on this device."
        case .biometryNotEnrolled:    return "Face ID is not enrolled. Enroll in Settings."
        case .biometryLockout:        return "Face ID is locked. Use device passcode to unlock."
        case .passcodeNotSet:         return "A device passcode is required before using Face ID."
        default:                      return localizedDescription
        }
    }
}

// ── View modifier: sovereign gate ─────────────────────────────
struct SovereignGate: ViewModifier {
    @State private var auth = BiometricAuthManager.shared

    func body(content: Content) -> some View {
        Group {
            if auth.isAuthenticated {
                content
            } else {
                SovereignLockView(auth: auth)
            }
        }
        .task { await auth.authenticate() }
    }
}

extension View {
    /// Wraps any view behind the sovereign Face ID gate.
    func sovereignGated() -> some View {
        modifier(SovereignGate())
    }
}

// ── Lock screen (shown while authenticating / on failure) ──────
struct SovereignLockView: View {
    let auth: BiometricAuthManager

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 32) {
                Spacer()

                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 64))
                    .foregroundStyle(.white)
                    .symbolEffect(.pulse, isActive: auth.isEvaluating)

                VStack(spacing: 8) {
                    Text("Oracle-AI")
                        .font(.largeTitle.bold())
                        .foregroundStyle(.white)
                    Text("OCSO-S1AF-GOV-1")
                        .font(.caption.monospaced())
                        .foregroundStyle(.white.opacity(0.5))
                }

                if let error = auth.lastError {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red.opacity(0.85))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)

                    Button {
                        Task { await auth.authenticate() }
                    } label: {
                        Label("Retry Face ID", systemImage: "faceid")
                            .font(.body.bold())
                            .padding(.horizontal, 32)
                            .padding(.vertical, 12)
                            .background(.white.opacity(0.12))
                            .clipShape(Capsule())
                            .foregroundStyle(.white)
                    }
                } else if auth.isEvaluating {
                    ProgressView()
                        .tint(.white)
                        .scaleEffect(1.2)
                }

                Spacer()

                Text("Authorized access only\nJonathan Sherman — Sovereign ID 1\njonathantsherman@gmail.com")
                    .font(.caption2.monospaced())
                    .foregroundStyle(.white.opacity(0.25))
                    .multilineTextAlignment(.center)
                    .padding(.bottom, 40)
            }
        }
    }
}
