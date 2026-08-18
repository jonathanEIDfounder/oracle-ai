/**
 * © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1
 * S1AF — Sentient iOS One-Step App Framework · Sovereign ID: 1
 * Author      : Jonathan Sherman (jonathanEIDfounder)
 * Governance  : OCSO-S1AF-GOV-1
 * Copyright   : © 2026 Jonathan Sherman. All rights reserved.
 * License     : PROPRIETARY — No license granted without express written permission.
 * DRM         : S1AF-DRM-LOCKED
 * Notice      : Unauthorized use, reproduction, modification, distribution, or
 *               sublicensing is strictly prohibited. Removal of this authorship
 *               notice violates applicable copyright law.
 */

/**
 * © 2026 Jonathan Sherman — S1AF (Sentient iOS One-Step App Framework)
 * Sovereign ID: 1 · All rights reserved.
 *
 * Runtime snapshot — dual-write strategy:
 *   Primary   → PostgreSQL sentient_state (survives production deploys)
 *   Fast path → /tmp/s1af-snapshot.json   (instant on dev restarts)
 *
 * The snapshot contains NO credentials — only metadata (source, timestamp, counters).
 */

import { writeFile, readFile } from "node:fs/promises";
import { eq }                  from "drizzle-orm";
import { db }                  from "@workspace/db";
import { sentientStateTable }  from "@workspace/db";
import { logger }              from "./logger";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

const SNAPSHOT_PATH = "/tmp/s1af-snapshot.json";

export interface SnapshotData {
  savedAt:    string;
  token: {
    source:      string;
    lastValidAt: string | null;
  };
  dispatches: {
    total:      number;
    successful: number;
  };
  rateMaps:   Record<string, number>;
  uptime:     number;
}

let _startedAt = Date.now();
export function markDaemonStart(): void { _startedAt = Date.now(); }

// ── Live counters ─────────────────────────────────────────────────────────────
let _totalDispatches   = 0;
let _successDispatches = 0;
let _lastTokenSource   = "none";
let _lastTokenValidAt: string | null = null;

export function recordDispatch(success: boolean): void {
  _totalDispatches++;
  if (success) _successDispatches++;
}

export function recordTokenCheck(source: string, valid: boolean): void {
  _lastTokenSource = source;
  if (valid) _lastTokenValidAt = new Date().toISOString();
}

// ── Rate-map registry ─────────────────────────────────────────────────────────
let _rateMaps: Map<string, Map<string, unknown>> | null = null;
export function attachRateMaps(maps: Map<string, Map<string, unknown>>): void {
  _rateMaps = maps;
}

function snapshotRateMaps(): Record<string, number> {
  if (!_rateMaps) return {};
  const out: Record<string, number> = {};
  for (const [name, m] of _rateMaps) out[name] = m.size;
  return out;
}

function buildSnap(): SnapshotData {
  return {
    savedAt:    new Date().toISOString(),
    token: {
      source:      _lastTokenSource,
      lastValidAt: _lastTokenValidAt,
    },
    dispatches: {
      total:      _totalDispatches,
      successful: _successDispatches,
    },
    rateMaps:   snapshotRateMaps(),
    uptime:     Date.now() - _startedAt,
  };
}

function restoreCounters(snap: SnapshotData): void {
  _totalDispatches   = snap.dispatches?.total      ?? 0;
  _successDispatches = snap.dispatches?.successful ?? 0;
  _lastTokenSource   = snap.token?.source          ?? "none";
  _lastTokenValidAt  = snap.token?.lastValidAt     ?? null;
}

// ── Save ──────────────────────────────────────────────────────────────────────
export async function saveSnapshot(): Promise<void> {
  const snap = buildSnap();
  const now  = new Date();

  // Primary — Postgres (upsert row id=1)
  try {
    const existing = await db
      .select({ id: sentientStateTable.id })
      .from(sentientStateTable)
      .where(eq(sentientStateTable.id, 1))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(sentientStateTable)
        .set({ payload: snap, savedAt: now, updatedAt: now })
        .where(eq(sentientStateTable.id, 1));
    } else {
      await db
        .insert(sentientStateTable)
        .values({ payload: snap, savedAt: now, updatedAt: now });
    }
    logger.debug({ source: snap.token.source }, "snapshot: saved → postgres");
  } catch (pgErr) {
    logger.warn({ err: pgErr instanceof Error ? pgErr.message : String(pgErr) }, "snapshot: postgres save failed — falling back to /tmp");
  }

  // Fast-path cache — /tmp (best-effort, silent on failure)
  try {
    await writeFile(SNAPSHOT_PATH, JSON.stringify(snap, null, 2), "utf8");
  } catch { /* /tmp write failures are non-fatal */ }
}

// ── Load ──────────────────────────────────────────────────────────────────────
export async function loadSnapshot(): Promise<SnapshotData | null> {
  // 1. Try Postgres first (survives production deploys)
  try {
    const rows = await db
      .select()
      .from(sentientStateTable)
      .where(eq(sentientStateTable.id, 1))
      .limit(1);

    if (rows.length > 0 && rows[0].payload) {
      const snap = rows[0].payload as SnapshotData;
      restoreCounters(snap);
      logger.info(
        { savedAt: snap.savedAt, tokenSource: snap.token?.source, dispatches: snap.dispatches, source: "postgres" },
        "snapshot: restored from postgres",
      );
      // Refresh /tmp fast-path cache
      try { await writeFile(SNAPSHOT_PATH, JSON.stringify(snap, null, 2), "utf8"); } catch { /**/ }
      return snap;
    }
  } catch (pgErr) {
    logger.warn({ err: pgErr instanceof Error ? pgErr.message : String(pgErr) }, "snapshot: postgres load failed — trying /tmp");
  }

  // 2. Fall back to /tmp (first boot after DB wipe, or dev environment)
  try {
    const raw  = await readFile(SNAPSHOT_PATH, "utf8");
    const snap = JSON.parse(raw) as SnapshotData;
    restoreCounters(snap);
    logger.info(
      { savedAt: snap.savedAt, tokenSource: snap.token?.source, dispatches: snap.dispatches, source: "/tmp" },
      "snapshot: restored from /tmp",
    );
    return snap;
  } catch {
    logger.info("snapshot: no prior state found — starting fresh");
    return null;
  }
}
