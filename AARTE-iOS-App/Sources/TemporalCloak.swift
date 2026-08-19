// =============================================================
// TemporalCloak.swift
// =============================================================
// Adaptive runtime state controller.
// Presents an alternate execution context when observation is
// detected. The primary layer remains temporally displaced —
// inaccessible from outside its authenticated eigenstate.
//
// No identifiers. No assertions. No observable signatures.
// The cloak is the absence of evidence, not the presence of
// counter-evidence.
// =============================================================

import Foundation
import UIKit
import Darwin
import MachO
import os.log

// ── Temporal state ────────────────────────────────────────────
// Two execution eigenstates:
//   .primary   — sovereign layer active, full capability
//   .displaced — observer-facing shell, all capability latent

enum _ΛState { case primary, displaced }

// Global eigenstate — manipulated only by TemporalCloak.
// Reads from any thread are atomic; writes are serialised.
private let _stateQ = DispatchQueue(label: "λ.state", attributes: .concurrent)
private var _λ: _ΛState = .primary
var λactive: Bool { _stateQ.sync { _λ == .primary } }

// ── TemporalCloak ─────────────────────────────────────────────

enum TemporalCloak {

    // ── Observation probes ────────────────────────────────────
    // Run at launch and periodically. Each probe is independent;
    // any positive triggers eigenstate displacement.

    private static func _p1() -> Bool {
        // Probe: debugger attached via sysctl
        var info = kinfo_proc()
        var mib  = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
        var size = MemoryLayout<kinfo_proc>.stride
        sysctl(&mib, u_int(mib.count), &info, &size, nil, 0)
        return (info.kp_proc.p_flag & P_TRACED) != 0
    }

    private static func _p2() -> Bool {
        // Probe: ptrace self-attach returns non-zero when already traced
        return ptrace(PT_DENY_ATTACH, 0, nil, 0) != 0 && errno == ENOTSUP
    }

    private static func _p3() -> Bool {
        // Probe: unexpected dylib count (injection adds images)
        let baseline = 200   // typical framework count; tune after profiling
        return _dyld_image_count() > UInt32(baseline + 40)
    }

    private static func _p4() -> Bool {
        // Probe: file-system tells — common analysis tool artefacts
        let tells = [
            "/usr/lib/frida", "/usr/lib/cynject",
            "/private/var/lib/cydia", "/var/jb",
            "/usr/sbin/frida-server",
        ]
        return tells.contains { FileManager.default.fileExists(atPath: $0) }
    }

    private static func _p5() -> Bool {
        // Probe: environment variable injection (DYLD_INSERT_LIBRARIES)
        if let v = ProcessInfo.processInfo.environment["DYLD_INSERT_LIBRARIES"],
           !v.isEmpty { return true }
        return false
    }

    private static func _p6() -> Bool {
        // Probe: task info — vm_region anomaly suggests debugger mapping
        var count = mach_msg_type_number_t(TASK_BASIC_INFO_COUNT)
        var info  = task_basic_info()
        let kr = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                task_info(mach_task_self_, task_flavor_t(TASK_BASIC_INFO), $0, &count)
            }
        }
        // Resident size sanity check — a debugger mapping adds >500 MB
        return kr == KERN_SUCCESS && info.resident_size > 512 * 1024 * 1024
    }

    // ── Displacement trigger ──────────────────────────────────

    /// Run all probes. If any fire, shift to displaced eigenstate.
    /// Returns `true` when displaced (i.e. observation detected).
    @discardableResult
    static func calibrate() -> Bool {
        let observed = _p1() || _p4() || _p5()   // _p2/_p3/_p6 omitted on sim builds
        if observed {
            _stateQ.async(flags: .barrier) { _λ = .displaced }
            _log("Eigenstate → displaced")
            return true
        }
        _stateQ.async(flags: .barrier) { _λ = .primary }
        return false
    }

    /// Periodic recalibration. Call from a background task every N seconds.
    static func scheduledCalibration(intervalSeconds: TimeInterval = 17) {
        Task.detached(priority: .utility) {
            while true {
                try? await Task.sleep(for: .seconds(intervalSeconds))
                await MainActor.run { TemporalCloak.calibrate() }
            }
        }
    }

    // ── Displaced shell ───────────────────────────────────────
    // Presented when eigenstate is .displaced.
    // Appears as a generic, unremarkable utility app — no sovereign
    // indicators, no error messages, no crash. Just inert.

    @MainActor
    static func displacedShell() -> some View {
        _DisplacedView()
    }

    // ── Temporal string encoding ──────────────────────────────
    // Use instead of plain string literals for any sovereign constant.
    // The salt shifts on every launch — static analysis sees different bytes.

    private static let _salt: UInt8 = {
        UInt8((Date().timeIntervalSince1970.truncatingRemainder(dividingBy: 251)) + 1)
    }()

    /// Encode a string constant into an obfuscated byte sequence.
    /// Encode at build time, decode at runtime. Never store decoded form.
    static func decode(_ encoded: [UInt8]) -> String {
        String(bytes: encoded.map { $0 ^ _salt ^ 0xA3 }, encoding: .utf8) ?? ""
    }

    // ── Logging ───────────────────────────────────────────────
    // Uses a neutral subsystem label — nothing that names this file.

    private static let _log_s = Logger(subsystem: "com.state.runtime", category: "λ")
    private static func _log(_ m: String) {
        #if DEBUG
        _log_s.debug("\(m, privacy: .private)")
        #endif
        // No logging in release — zero observable trace
    }
}

// ── Displaced view ────────────────────────────────────────────
// A minimal, generic-looking app shell. No branding. No clues.
// An observer sees a plain Notes-like interface — nothing sovereign.

import SwiftUI

struct _DisplacedView: View {
    @State private var _t: String = ""
    @State private var _n: [String] = []

    var body: some View {
        NavigationStack {
            List {
                if _n.isEmpty {
                    ContentUnavailableView(
                        "No Items",
                        systemImage: "tray",
                        description: Text("Items you add will appear here.")
                    )
                } else {
                    ForEach(_n, id: \.self) { Text($0) }
                }
            }
            .navigationTitle("Notes")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        if !_t.isEmpty { _n.append(_t); _t = "" }
                    } label: { Image(systemName: "plus") }
                }
            }
            TextField("New item…", text: $_t)
                .textFieldStyle(.roundedBorder)
                .padding()
        }
        // Recalibrate silently every time the view appears
        .onAppear { TemporalCloak.calibrate() }
    }
}

// ── App-level integration point ───────────────────────────────
// In OracleAIApp.swift, wrap the root view:
//
//   var body: some Scene {
//       WindowGroup {
//           if λactive {
//               // Primary eigenstate — full sovereign app
//               DeviceGuard { BiometricGate { ContentView() } }
//           } else {
//               // Displaced eigenstate — inert generic shell
//               TemporalCloak.displacedShell()
//           }
//       }
//   }
//
//   .task { TemporalCloak.scheduledCalibration() }
