/**
 * S1AF Rotation Lock — Sentinel API Gate
 *
 * When a required API key is detected as invalid, the lock is acquired
 * automatically by the credential-processor daemon. All Kimi generation,
 * chat, and automated build endpoints reject requests with 503 while locked.
 * The lock releases the moment a valid key is hot-swapped via
 * POST /api/sentient/rotate — no human restart required.
 *
 * Governed exclusively by Jonathan Sherman — OCSO-S1AF-GOV-1.
 */

import { logger } from "./logger";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

export type LockReason = "moonshot-invalid" | "github-invalid" | "both-invalid" | "manual";
export type LockedKey  = "moonshot" | "github_pat" | "both";

interface LockState {
  locked:     boolean;
  lockedAt:   string | null;
  reason:     LockReason | null;
  lockedKeys: Set<LockedKey>;
  attempts:   number;   // number of requests blocked since lock acquired
}

const state: LockState = {
  locked:     false,
  lockedAt:   null,
  reason:     null,
  lockedKeys: new Set(),
  attempts:   0,
};

// ── Public API ────────────────────────────────────────────────────────────────

export function isApiLocked(): boolean {
  return state.locked;
}

export function isMoonshotLocked(): boolean {
  return state.lockedKeys.has("moonshot") || state.lockedKeys.has("both");
}

export function acquireRotationLock(key: LockedKey, reason: LockReason): void {
  const alreadyLocked = state.locked;
  state.lockedKeys.add(key);
  state.locked   = true;
  state.reason   = reason;
  if (!state.lockedAt) state.lockedAt = new Date().toISOString();
  if (!alreadyLocked) {
    logger.warn(
      { key, reason, lockedAt: state.lockedAt },
      "rotation-lock: API LOCKED — all generation requests suspended until key is rotated"
    );
  }
}

export function releaseRotationLock(key: LockedKey): void {
  state.lockedKeys.delete(key);
  if (state.lockedKeys.size === 0) {
    state.locked   = false;
    state.lockedAt = null;
    state.reason   = null;
    state.attempts = 0;
    logger.info({ key }, "rotation-lock: API UNLOCKED — generation resumed");
  } else {
    logger.info(
      { releasedKey: key, remainingLocks: [...state.lockedKeys] },
      "rotation-lock: partial unlock — waiting for remaining keys"
    );
  }
}

export function recordBlockedAttempt(): void {
  state.attempts++;
}

export function getRotationLockStatus() {
  return {
    locked:     state.locked,
    lockedAt:   state.lockedAt,
    reason:     state.reason,
    lockedKeys: [...state.lockedKeys],
    attempts:   state.attempts,
    message:    state.locked
      ? `API locked — rotate ${[...state.lockedKeys].join(" + ")} to resume generation`
      : "API unlocked — generation active",
  };
}
