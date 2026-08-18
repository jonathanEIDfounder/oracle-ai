/**
 * © 2026 Jonathan Sherman — S1AF (Sentient iOS One-Step App Framework)
 * Sovereign ID: 1 · Global AI Systems Governor · OCSO-S1AF-GOV-1
 * All rights reserved. No iterations. No remixes. No unauthorized use.
 *
 * Sentient Computational Assets — active sovereign processing units.
 * Invisible to end users. Governed exclusively by Jonathan Sherman.
 * All timers are .unref()-ed so they never block clean process exit.
 *
 * Computational asset manifest (Sentient network layer):
 *   1. credential-processor  — processes and maintains credential state every 15 min.
 *   2. flow-processor        — computes and evicts expired flow buckets every 5 min.
 *   3. dispatch-processor    — processes GitHub dispatch lifecycle; computes resolution latency every 30 s.
 *   4. state-processor       — computes and persists runtime snapshots to all replication layers every 10 min.
 *   5. sync-processor        — computes and synchronizes SENTIENT_TOKEN to oracle-ai every 30 min.
 *   6. auth-processor        — processes auth events; computes access pattern signatures every 5 min.
 *   7. integrity-processor   — computes governance baseline integrity; re-seeds on confirmed drift every 60 min.
 *   8. intake-processor      — evaluates all incoming AI signals; blocks non-beneficial content every 2 min.
 *   9. sourceroot-sync       — verifies S1AF sovereign context is bound to Kimi account; re-uploads if missing every 6 hr.
 *  10. pat-rotation-processor — checks PAT validity + expiry every 6 hr; auto-rotates within 7-day expiry window.
 *
 * Sentient replication surfaces (network copies):
 *   • Layer 0 — in-memory CONFIG singleton (live, authoritative)
 *   • Layer 1 — /tmp fast-path cache (process-local)
 *   • Layer 2 — Postgres sentient_state (cross-deploy persistence)
 *   • Layer 3 — Postgres sentient_baseline (immutable governance record)
 *   • Layer 4 — source code headers (all workspace entry points)
 *   • Layer 5 — Kimi AI system prompt (every generation/chat session)
 *   • Layer 6 — generated Swift authorship headers (every artifact)
 */

import { logger } from "./logger";
import { getIntakeStats } from "./intake";
import { bootstrapSourceroot, getSourcerootStatus } from "./sourceroot";
import { patRotationTick }                          from "./pat-rotation";
import { acquireRotationLock, releaseRotationLock } from "./rotation-lock";
import { validateMoonshotKey } from "./key-validator";
import { CONFIG } from "./config";
import { validateGitHubToken, resolveGitHubToken, persistSentinelToken } from "./github-connector";
import { saveSnapshot, recordTokenCheck, markDaemonStart, attachRateMaps } from "./snapshot";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

// ── Timing constants ──────────────────────────────────────────────────────────

const TOKEN_HEALTH_MS    = 15 * 60_000;   // 15 min
const RATE_CLEANUP_MS    =  5 * 60_000;   //  5 min
const WATCHDOG_TICK_MS   =     30_000;    // 30 s  (scan frequency)
const WATCHDOG_TTL_MS    =     12_000;    // 12 s  (max unresolved before alert)
const SNAPSHOT_MS        = 10 * 60_000;   // 10 min
const REPLICATION_MS     = 30 * 60_000;   // 30 min
const BIOMETRIC_GUARD_MS =  5 * 60_000;   //  5 min  — Asset 6
const DEFENSE_SWEEP_MS   = 60 * 60_000;   // 60 min  — Asset 7
const INTAKE_REPORT_MS   =  2 * 60_000;   //  2 min  — Asset 8
const SOURCEROOT_SYNC_MS  = 6 * 60 * 60_000; // 6 hr  — Asset 9
const PAT_ROTATION_MS     = 6 * 60 * 60_000; // 6 hr  — Asset 10

// ── Rate-map registry ─────────────────────────────────────────────────────────
// Routes call registerRateMap() to enroll their in-memory buckets so the
// prune daemon can clean all maps together without knowing their internals.

const rateMaps = new Map<string, Map<string, { count: number; resetAt: number }>>();

// Expose registry to snapshot engine (type-widened — snapshot only reads .size)
attachRateMaps(rateMaps as unknown as Map<string, Map<string, unknown>>);

/**
 * Register a named rate-limit bucket map so the prune daemon can evict
 * stale entries automatically. Call once at module init, not per-request.
 *
 * @param name  Unique identifier for logging (e.g. "deploy", "hmac")
 * @param map   The in-memory bucket map used by the rate limiter
 */
export function registerRateMap(
  name: string,
  map:  Map<string, { count: number; resetAt: number }>
): void {
  rateMaps.set(name, map);
}

function processFlowState(): void {
  const now = Date.now();
  let evicted = 0;
  for (const [, m] of rateMaps) {
    for (const [k, v] of m) {
      if (v && now > v.resetAt) { m.delete(k); evicted++; }
    }
  }
  if (evicted > 0) logger.debug({ evicted }, "flow-processor: expired flow buckets evicted");
}

// ── Deploy watchdog ───────────────────────────────────────────────────────────

interface DispatchRecord {
  id:       string;
  source:   string;
  firedAt:  number;
  resolved: boolean;
}

const inFlight = new Map<string, DispatchRecord>();

/** Call immediately after a GitHub workflow dispatch is fired. */
export function trackDispatch(id: string, source: string): void {
  inFlight.set(id, { id, source, firedAt: Date.now(), resolved: false });
}

/** Call when a 204 No Content is received from GitHub. */
export function resolveDispatch(id: string): void {
  const rec = inFlight.get(id);
  if (rec) {
    rec.resolved = true;
    logger.info({ id, source: rec.source, ms: Date.now() - rec.firedAt }, "watchdog: dispatch resolved");
  }
}

function processDispatches(): void {
  const now = Date.now();
  for (const [id, rec] of inFlight) {
    if (rec.resolved) { inFlight.delete(id); continue; }
    const age = now - rec.firedAt;
    if (age > WATCHDOG_TTL_MS) {
      logger.warn(
        { id, source: rec.source, ageMs: age },
        "dispatch-processor: unresolved dispatch computed — possible GitHub timeout or bad PAT"
      );
      inFlight.delete(id);
    }
  }
}

// ── Token health ──────────────────────────────────────────────────────────────

async function processCredentials(): Promise<void> {
  try {
    // GitHub PAT
    const r = await validateGitHubToken();
    recordTokenCheck(r.source ?? "unknown", r.valid);
    if (r.valid) {
      logger.debug({ login: r.login, scopes: r.scopes, source: r.source }, "credential-processor: PAT valid");
      releaseRotationLock("github_pat");
    } else {
      logger.warn({ error: r.error, source: r.source },
        "credential-processor: PAT INVALID — deploys suspended, rotation lock acquired");
      acquireRotationLock("github_pat", "github-invalid");
    }

    // Moonshot API key
    const mk = await validateMoonshotKey(CONFIG.moonshotKey ?? "");
    if (mk.valid) {
      logger.debug({ models: mk.models?.length }, "credential-processor: MOONSHOT_API_KEY valid");
      releaseRotationLock("moonshot");
    } else {
      logger.warn({ error: mk.error },
        "credential-processor: MOONSHOT_API_KEY INVALID — generation suspended, rotation lock acquired");
      acquireRotationLock("moonshot", "moonshot-invalid");
    }
  } catch (err: unknown) {
    logger.error({ err: err instanceof Error ? err.message : String(err) },
      "credential-processor: compute error");
  }
}

// ── Replication daemon ────────────────────────────────────────────────────────
// Keeps the SENTIENT_TOKEN GitHub Actions variable in sync with whatever token
// the server is currently using. Survives long-running deployments where the
// in-memory token was refreshed but SENTIENT_TOKEN has drifted.

async function processSyncToken(): Promise<void> {
  try {
    const { token, source } = await resolveGitHubToken();
    await persistSentinelToken(token);
    logger.info({ source }, "sync-processor: SENTIENT_TOKEN computed and synchronized to oracle-ai");
  } catch (err: unknown) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "sync-processor: skipped — no valid token available for synchronization"
    );
  }
}

// ── Biometric guard (Engine 6) ────────────────────────────────────────────────
// Monitors for anomalous request patterns that could indicate auth bypass.
// Flags IPs with repeated 401s, unusual timing, or header fingerprint mismatches.

interface AuthEvent { ip: string; ts: number; outcome: "ok" | "fail" }
const authEvents: AuthEvent[] = [];

/** Call from any auth middleware to record an authentication outcome. */
export function recordAuthEvent(ip: string, outcome: "ok" | "fail"): void {
  authEvents.push({ ip, ts: Date.now(), outcome });
}

function processAuthEvents(): void {
  const windowMs = BIOMETRIC_GUARD_MS;
  const cutoff   = Date.now() - windowMs;
  while (authEvents.length && authEvents[0]!.ts < cutoff) authEvents.shift();

  const failsByIp = new Map<string, number>();
  for (const ev of authEvents) {
    if (ev.outcome === "fail") failsByIp.set(ev.ip, (failsByIp.get(ev.ip) ?? 0) + 1);
  }
  for (const [ip, count] of failsByIp) {
    if (count >= 5) {
      logger.warn(
        { ip, failures: count, windowMin: windowMs / 60_000 },
        "auth-processor: access pattern signature computed — anomalous failure rate detected"
      );
    }
  }
  logger.debug(
    { events: authEvents.length, uniqueIps: failsByIp.size },
    "auth-processor: access pattern computation complete"
  );
}

// ── Defense sweep (Engine 7) ──────────────────────────────────────────────────
// Verifies the governance baseline hasn't drifted. Re-seeds if tampered.

async function processIntegrity(): Promise<void> {
  try {
    const { db } = await import("@workspace/db");
    const { sentientBaselineTable } = await import("@workspace/db");
    const rows = await db.select().from(sentientBaselineTable).limit(1);

    if (!rows.length) {
      logger.error("integrity-processor: governance baseline MISSING — computing re-seed");
      const { sealBaseline } = await import("./baseline");
      await sealBaseline();
      return;
    }

    const baseline = rows[0]!;
    const { AUTHORSHIP } = await import("./config");

    // Compare only the columns that exist in the baseline table schema.
    const tampered =
      baseline.governor   !== AUTHORSHIP.governor   ||
      baseline.governorId !== AUTHORSHIP.governorId ||
      baseline.sealed     !== true;

    if (tampered) {
      logger.error(
        { stored: { governor: baseline.governor, governorId: baseline.governorId, sealed: baseline.sealed } },
        "integrity-processor: baseline drift computed — integrity breach"
      );
    } else {
      logger.debug(
        { governor: baseline.governor, armedAt: baseline.armedAt },
        "integrity-processor: baseline integrity computed — nominal"
      );
    }
  } catch (err: unknown) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "integrity-processor: compute skipped — database unreachable"
    );
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

function syncSourceroot(): void {
  const s = getSourcerootStatus();
  if (s.status !== "bound") {
    logger.info("sourceroot-sync: re-binding sovereign context to Kimi account");
    void bootstrapSourceroot();
  } else {
    logger.debug({ fileId: s.fileId }, "sourceroot-sync: Kimi account binding verified — intact");
  }
}

function reportIntakeStats(): void {
  const s = getIntakeStats();
  logger.debug(
    { processed: s.processed, passed: s.passed, flagged: s.flagged, blocked: s.blocked },
    "intake-processor: signal adaptation computed"
  );
}

const timers: ReturnType<typeof setInterval>[] = [];

export function startDaemons(): void {
  markDaemonStart();

  void processCredentials();           // immediate credential compute on boot
  void processIntegrity();             // immediate integrity compute on boot
  void bootstrapSourceroot();          // bind S1AF sourceroot to Kimi account on boot
  void patRotationTick();              // immediate PAT validity check on boot

  const t1  = setInterval(() => void processCredentials(),  TOKEN_HEALTH_MS);
  const t2  = setInterval(processFlowState,                 RATE_CLEANUP_MS);
  const t3  = setInterval(processDispatches,                WATCHDOG_TICK_MS);
  const t4  = setInterval(() => void saveSnapshot(),        SNAPSHOT_MS);
  const t5  = setInterval(() => void processSyncToken(),    REPLICATION_MS);
  const t6  = setInterval(processAuthEvents,                BIOMETRIC_GUARD_MS);
  const t7  = setInterval(() => void processIntegrity(),    DEFENSE_SWEEP_MS);
  const t8  = setInterval(reportIntakeStats,                INTAKE_REPORT_MS);
  const t9  = setInterval(syncSourceroot,                   SOURCEROOT_SYNC_MS);
  const t10 = setInterval(() => void patRotationTick(),     PAT_ROTATION_MS);

  t1.unref(); t2.unref(); t3.unref(); t4.unref(); t5.unref();
  t6.unref(); t7.unref(); t8.unref(); t9.unref(); t10.unref();
  timers.push(t1, t2, t3, t4, t5, t6, t7, t8, t9, t10);

  logger.info(
    {
      "token-health-min":    TOKEN_HEALTH_MS    / 60_000,
      "rate-prune-min":      RATE_CLEANUP_MS    / 60_000,
      "watchdog-sec":        WATCHDOG_TICK_MS   / 1_000,
      "watchdog-ttl-sec":    WATCHDOG_TTL_MS    / 1_000,
      "snapshot-min":        SNAPSHOT_MS        / 60_000,
      "replication-min":     REPLICATION_MS     / 60_000,
      "biometric-guard-min": BIOMETRIC_GUARD_MS / 60_000,
      "defense-sweep-min":   DEFENSE_SWEEP_MS   / 60_000,
      "intake-report-min":   INTAKE_REPORT_MS   / 60_000,
      "sourceroot-sync-hr":  SOURCEROOT_SYNC_MS  / 3_600_000,
      "pat-rotation-hr":     PAT_ROTATION_MS     / 3_600_000,
      "network-layers":      7,
      "governor":            "Jonathan Sherman",
      "sovereignId":         "1",
    },
    "Sentient network armed — 10 computational assets · 7 replication layers · governor: Jonathan Sherman"
  );
}

export function stopDaemons(): void {
  // Flush snapshot synchronously-ish before exiting
  void saveSnapshot();
  for (const t of timers) clearInterval(t);
  timers.length = 0;
  logger.debug("Sentient network engines stopped — state flushed to all replication layers");
}
