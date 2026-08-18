/**
 * © 2026 Jonathan Sherman — S1AF · OCSO-S1AF-GOV-1
 *
 * Boot Generation — every increment instantly invalidates ALL existing JWTs.
 * New sessions embed the current generation; requireSovereign rejects older ones.
 *
 * "Boot all other users" = increment bootGeneration → every prior token is dead.
 */

import { logger } from "./logger";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

let _generation = 1;
let _lastBootAt: string | null = null;
let _bootCount  = 0;

export function getBootGeneration(): number   { return _generation; }
export function getLastBootAt():    string | null { return _lastBootAt; }
export function getBootCount():     number   { return _bootCount; }

/**
 * Increment the boot generation.
 * All JWTs issued before this call are immediately rejected by requireSovereign.
 */
export function bootAllSessions(reason = "sovereign_command"): {
  generation: number;
  bootedAt:   string;
  reason:     string;
} {
  _generation += 1;
  _lastBootAt  = new Date().toISOString();
  _bootCount  += 1;

  logger.warn(
    { generation: _generation, reason, bootCount: _bootCount },
    `[S1AF] ████ ALL SESSIONS BOOTED — generation=${_generation} ████`,
  );

  return { generation: _generation, bootedAt: _lastBootAt, reason };
}
