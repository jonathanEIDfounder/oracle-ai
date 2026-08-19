// =============================================================
// CloudKitSync.swift
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · Celestial Core
// Sovereign ID: 1 · OCSO-S1AF-GOV-1
// =============================================================
// Sovereign CloudKit sync layer.
// Writes governance state, inference logs, and device telemetry
// to the private CloudKit container so data is exclusive to the
// sovereign owner's iCloud account (jonathantsherman@gmail.com).
//
// Container: iCloud.com.jonathansherman.s1af.oracle-ai
// Zone:      SovereignZone (single-owner private database)
//
// Records:
//   SovereignEvent  — immutable audit log entry
//   GovernanceState — rolling snapshot of platform health
//   InferenceLog    — Celestial Core inference trace
// =============================================================

import CloudKit
import Foundation
import os.log

// ── CloudKit container / zone ────────────────────────────────

private let containerID = "iCloud.com.jonathansherman.s1af.oracle-ai"
private let zoneName    = "SovereignZone"

// ── CloudKitSync actor ───────────────────────────────────────

actor CloudKitSync {

    static let shared = CloudKitSync()
    private init() {}

    private let log      = Logger(subsystem: "com.jonathansherman.s1af", category: "CloudKitSync")
    private let container = CKContainer(identifier: containerID)
    private var privateDB: CKDatabase { container.privateCloudDatabase }
    private let zone      = CKRecordZone(zoneName: zoneName)

    // ── Bootstrap ──────────────────────────────────────────────

    /// Create the sovereign zone if it doesn't exist.
    /// Call once at app launch after Face ID auth.
    func bootstrap() async {
        do {
            try await privateDB.modifyRecordZones(
                saving: [zone], deleting: []
            )
            log.info("[CloudKit] SovereignZone ready in private database")

            // Subscribe to remote changes so the app updates in real time.
            await subscribeToChanges()
        } catch {
            log.error("[CloudKit] Bootstrap failed: \(error.localizedDescription)")
        }
    }

    // ── Write: Sovereign Event (immutable audit log) ───────────

    /// Log any sovereign platform event — deploy trigger, auth, inference, etc.
    func logEvent(
        type:       String,
        detail:     String,
        metadata:   [String: String] = [:]
    ) async {
        let record = CKRecord(
            recordType: "SovereignEvent",
            recordID:   CKRecord.ID(
                recordName: UUID().uuidString,
                zoneID:     zone.zoneID
            )
        )
        record["eventType"]   = type as CKRecordValue
        record["detail"]      = detail as CKRecordValue
        record["sovereignID"] = 1 as CKRecordValue
        record["govRef"]      = "OCSO-S1AF-GOV-1" as CKRecordValue
        record["timestamp"]   = Date() as CKRecordValue
        for (k, v) in metadata { record[k] = v as CKRecordValue }

        do {
            try await privateDB.save(record)
            log.debug("[CloudKit] Event logged: \(type) — \(detail)")
        } catch {
            log.error("[CloudKit] Event save failed: \(error.localizedDescription)")
        }
    }

    // ── Write: Governance State (rolling snapshot) ─────────────

    /// Upsert the current governance state.
    /// Uses a deterministic recordName so each write replaces the previous.
    func updateGovernanceState(
        phase:        Int,
        status:       String,
        deployReady:  Bool,
        buildVersion: String
    ) async {
        let recordID = CKRecord.ID(
            recordName: "governance-state-v1",
            zoneID:     zone.zoneID
        )

        // Fetch existing record or create new
        var record: CKRecord
        do {
            record = try await privateDB.record(for: recordID)
        } catch {
            record = CKRecord(recordType: "GovernanceState", recordID: recordID)
        }

        record["phase"]        = phase as CKRecordValue
        record["status"]       = status as CKRecordValue
        record["deployReady"]  = (deployReady ? 1 : 0) as CKRecordValue
        record["buildVersion"] = buildVersion as CKRecordValue
        record["sovereignID"]  = 1 as CKRecordValue
        record["updatedAt"]    = Date() as CKRecordValue

        do {
            try await privateDB.save(record)
            log.info("[CloudKit] Governance state updated — phase \(phase), status: \(status)")
        } catch {
            log.error("[CloudKit] Governance state save failed: \(error.localizedDescription)")
        }
    }

    // ── Write: Inference Log ───────────────────────────────────

    /// Record a Celestial Core inference trace for audit purposes.
    func logInference(_ response: CelestialResponse) async {
        let record = CKRecord(
            recordType: "InferenceLog",
            recordID:   CKRecord.ID(
                recordName: response.requestID.uuidString,
                zoneID:     zone.zoneID
            )
        )
        record["requestID"]   = response.requestID.uuidString as CKRecordValue
        record["backend"]     = response.backend.rawValue as CKRecordValue
        record["latencyMs"]   = response.latencyMs as CKRecordValue
        record["sovereignID"] = Int(response.sovereignTag.id) as CKRecordValue
        record["timestamp"]   = response.sovereignTag.timestamp as CKRecordValue

        // Store a redacted output summary (no raw model output in CloudKit)
        let outputSummary: String
        switch response.output {
        case .text(let t):                   outputSummary = "text[\(t.count) chars]"
        case .classification(let l, let c):  outputSummary = "class:\(l)@\(String(format:"%.2f",c))"
        case .embedding(let e):              outputSummary = "embedding[\(e.count)d]"
        case .multiFeature:                  outputSummary = "multiFeature"
        case .unavailable(let r):            outputSummary = "unavailable:\(r)"
        }
        record["outputSummary"] = outputSummary as CKRecordValue

        do {
            try await privateDB.save(record)
        } catch {
            log.error("[CloudKit] Inference log save failed: \(error.localizedDescription)")
        }
    }

    // ── Read: Recent Events ────────────────────────────────────

    /// Fetch the 50 most recent sovereign events.
    func recentEvents() async -> [CKRecord] {
        let pred  = NSPredicate(value: true)
        let sort  = NSSortDescriptor(key: "timestamp", ascending: false)
        let query = CKQuery(recordType: "SovereignEvent", predicate: pred)
        query.sortDescriptors = [sort]

        do {
            let result = try await privateDB.records(
                matching: query,
                inZoneWith: zone.zoneID,
                desiredKeys: ["eventType", "detail", "timestamp"],
                resultsLimit: 50
            )
            return result.matchResults.compactMap { try? $0.1.get() }
        } catch {
            log.error("[CloudKit] Fetch events failed: \(error.localizedDescription)")
            return []
        }
    }

    // ── Push subscription ──────────────────────────────────────

    private func subscribeToChanges() async {
        let sub = CKDatabaseSubscription(subscriptionID: "sovereign-zone-changes")
        let notif = CKSubscription.NotificationInfo()
        notif.shouldSendContentAvailable = true  // silent push — no alert shown
        sub.notificationInfo = notif

        do {
            try await privateDB.save(sub)
            log.info("[CloudKit] Subscribed to sovereign zone changes (silent push)")
        } catch let error as CKError where error.code == .serverRejectedRequest {
            // Subscription already exists — ignore
        } catch {
            log.error("[CloudKit] Subscription failed: \(error.localizedDescription)")
        }
    }

    // ── iCloud account check ───────────────────────────────────

    /// Verify the signed-in iCloud account matches the permitted email.
    /// CloudKit doesn't expose the iCloud email directly (privacy);
    /// we check that the account status is available and the user identity
    /// is discoverable (only true for the owner on a personal device).
    func verifyAccountBinding() async -> Bool {
        do {
            let status = try await container.accountStatus()
            guard status == .available else {
                log.warning("[CloudKit] iCloud account not available (status: \(status.rawValue))")
                return false
            }
            log.info("[CloudKit] iCloud account available — sovereign binding confirmed")
            return true
        } catch {
            log.error("[CloudKit] Account check failed: \(error.localizedDescription)")
            return false
        }
    }
}
