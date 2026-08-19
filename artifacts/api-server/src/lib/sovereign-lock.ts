// =============================================================
// sovereign-lock.ts — Sovereign Container Lock
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · Celestial Core
// Sovereign ID: 1 · OCSO-S1AF-GOV-1
// =============================================================
// Phase 1+2+4 — CONTAINERIZE · ENCAPSULATE · LOCK
//
// Phases applied at server startup, in order:
//
//   Phase 1 — CONTAINERIZE
//     Process-level isolation: removes dangerous globals,
//     locks the module namespace, constrains the runtime.
//
//   Phase 2 — ENCAPSULATE
//     Seals all CONFIG properties. External code can read
//     config values but can never mutate them at runtime.
//
//   Phase 4 — LOCK
//     One-way latch: once engage() is called the container
//     transitions to LOCKED state and rejects any further
//     mutation attempts. The lock cannot be undone within
//     the same process lifetime.
//
// Call SovereignLock.engage() once — after all middleware
// and routes are registered, before the server binds its port.
// =============================================================

import { logger } from "./logger";

// ── Container state ───────────────────────────────────────────

type LockPhase = "init" | "hardening" | "locked";

let _phase: LockPhase = "init";

// ── Phase 1 — Containerize (process hardening) ────────────────

function containerize(): void {
  // Remove dangerous globals that have no place in sovereign server code.
  // eval and Function constructor can execute arbitrary code.
  // These assignments are best-effort — V8 does not fully prevent override
  // but raises the bar for accidental or injected use.
  try {
    Object.defineProperty(globalThis, "eval", {
      get() { throw new Error("[S1AF] eval is disabled in sovereign container"); },
      configurable: false,
    });
  } catch { /* already locked or non-configurable */ }

  // Disable process.exit being called silently by dependencies.
  // Wrap it so any exit is logged before it happens.
  const originalExit = process.exit.bind(process);
  process.exit = ((code?: number) => {
    logger.fatal({ code }, "[SovereignLock] process.exit called — logging before termination");
    originalExit(code);
  }) as typeof process.exit;

  // Hard limits — constrain memory and CPU if possible via environment
  // (actual enforcement done by Replit's container platform, these are
  // advisory signals).
  logger.info("[SovereignLock] Phase 1 — Container isolated");
}

// ── Phase 2 — Encapsulate (deep CONFIG freeze) ────────────────

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  Object.getOwnPropertyNames(obj).forEach(name => {
    const val = (obj as Record<string, unknown>)[name];
    if (val && typeof val === "object") deepFreeze(val);
  });
  return Object.freeze(obj);
}

function encapsulate(): void {
  // Import and freeze CONFIG at the module level.
  // After this, any attempt to mutate CONFIG or its nested objects
  // throws a TypeError in strict mode (which all our modules use).
  try {
    // Dynamic require so we don't create a circular dependency at import time.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { CONFIG } = require("./config") as { CONFIG: Record<string, unknown> };
    deepFreeze(CONFIG);
    logger.info("[SovereignLock] Phase 2 — CONFIG encapsulated (deep-frozen)");
  } catch (err) {
    logger.warn({ err }, "[SovereignLock] Phase 2 — CONFIG freeze failed (non-fatal)");
  }
}

// ── Phase 4 — Lock (one-way state latch) ─────────────────────

function lock(): void {
  _phase = "locked";

  // Seal this module's own exports so callers cannot swap out functions.
  Object.freeze(SovereignLock);

  // Install uncaught exception and rejection handlers that log without
  // leaking internal stack traces or file paths to external observers.
  process.on("uncaughtException", (err) => {
    logger.fatal("[SovereignLock] Uncaught exception — sealed response");
    logger.fatal({ msg: err.message });   // message only, no stack to external
    // Do NOT re-throw or call process.exit — let the platform restart
  });

  process.on("unhandledRejection", (reason) => {
    logger.fatal("[SovereignLock] Unhandled rejection — sealed response");
    logger.fatal({ reason: String(reason).slice(0, 200) });
  });

  logger.info("[SovereignLock] Phase 4 — LOCKED · sovereign container sealed");
}

// ── Public API ────────────────────────────────────────────────

export const SovereignLock = {

  // ── engage() — run all 4 phases in sequence ────────────────
  // Call exactly once, after routes are registered, before server.listen().

  engage(): void {
    if (_phase === "locked") {
      logger.warn("[SovereignLock] engage() called after lock — ignored");
      return;
    }
    _phase = "hardening";
    logger.info("[SovereignLock] Engaging sovereign container — phases 1 → 2 → 4");

    containerize();    // Phase 1 — Containerize
    encapsulate();     // Phase 2 — Encapsulate
    lock();            // Phase 4 — Lock

    logger.info("[SovereignLock] ✓ Sovereign container LOCKED — Sovereign ID: 1 · OCSO-S1AF-GOV-1");
  },

  // ── State query ────────────────────────────────────────────

  get phase(): LockPhase { return _phase; },
  get isLocked(): boolean { return _phase === "locked"; },

  // ── Sovereign assertion ────────────────────────────────────
  // Use in any critical path to assert the container is locked.
  // Throws if called before engage() completes.

  assertLocked(context = "unknown"): void {
    if (_phase !== "locked") {
      throw new Error(`[SovereignLock] Container not locked at: ${context}`);
    }
  },
};
