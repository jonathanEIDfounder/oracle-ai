// =============================================================
// sentient-mec.ts — Sentient Sovereign Edge Router
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · Celestial Core
// Sovereign ID: 1 · OCSO-S1AF-GOV-1
// =============================================================
// Routes all Sentient traffic exclusively through the sovereign
// oracle-ai server. No external relays. No third-party nodes.
// No bridges. Every connection stays within the owner's own
// infrastructure.
//
// The oracle-ai Replit deployment IS the sovereign edge node.
// =============================================================

import { logger } from "./logger";

// ── Sovereign endpoint ────────────────────────────────────────
// The oracle-ai server itself — the only permitted routing target.
// Resolved at runtime so the production URL is always current.

function sovereignBaseURL(): string {
  // Prefer the deployment domain, fall back to dev domain
  if (process.env.ORACLE_AI_SERVER_URL) return process.env.ORACLE_AI_SERVER_URL;
  if (process.env.REPLIT_DEV_DOMAIN)    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "http://localhost:" + (process.env.PORT ?? "3000");
}

// ── MECRouter ─────────────────────────────────────────────────

export const MECRouter = {

  init(): void {
    logger.info({ endpoint: sovereignBaseURL() },
      "[SovereignEdge] Router initialised — sovereign endpoint only, no external relays");
  },

  // ── Route endpoint ───────────────────────────────────────────
  // Always returns the user's own oracle-ai server.
  // type is always "sovereign" — no MEC third-party nodes.

  routeEndpoint(): { url: string; type: "sovereign"; latencyMs: number } {
    return { url: sovereignBaseURL(), type: "sovereign", latencyMs: 0 };
  },

  // ── Noop: no external discovery ──────────────────────────────

  async discoverFromRegistry(_registryURL: string): Promise<number> {
    logger.warn("[SovereignEdge] External registry discovery disabled — sovereign routing only");
    return 0;
  },

  // ── Status ───────────────────────────────────────────────────

  status() {
    return {
      endpoint:    sovereignBaseURL(),
      type:        "sovereign",
      externalRelays: false,
      externalBridges: false,
      sovereignID: 1,
      govRef:      "OCSO-S1AF-GOV-1",
    };
  },
};

MECRouter.init();
