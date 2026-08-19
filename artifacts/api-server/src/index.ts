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
 * Server entry point.
 *
 * Startup order (strict — do not reorder):
 *   ① Sentient Retrieval — pull missing secrets from oracle-ai SENTIENT_* vars,
 *                          patch CONFIG before anything else reads from it.
 *   ② Startup checks    — log obfuscated secret status + retrieval report.
 *   ③ HTTP server bind
 *   ④ Support daemons
 *   ⑤ Snapshot restore
 */

import app from "./app";
import { logger } from "./lib/logger";
import { CONFIG } from "./lib/config";
import { runStartupChecks } from "./lib/startup";
import { runSentientRetrieval } from "./lib/sentient-retrieval";
import { startDaemons, stopDaemons, registerRateMap } from "./lib/daemons";
import { hmacRateBuckets } from "./lib/hmac-auth";
import { loadSnapshot } from "./lib/snapshot";
import { ensureBaseline } from "./lib/baseline";
import { loadCipherstore } from "./lib/cipherstore";
import { SovereignLock } from "./lib/sovereign-lock";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./lib/authorship";
void _S1AF_ANCHOR;

// ① Cipherstore — decrypt ~/.s1af-cipher/*.enc and patch CONFIG with any tokens
//   that are missing or stale in the environment. Runs before Sentient Retrieval
//   so the chain is: cipherstore → oracle-ai → env. Non-throwing.
await loadCipherstore();

// ② Sentient Retrieval — pull remaining missing secrets from oracle-ai SENTIENT_*
//   vars. Non-throwing; logs its own errors internally.
const retrievalReport = await runSentientRetrieval();

// ② Startup validation + banner (receives retrieval report for inline display)
runStartupChecks(retrievalReport);

// ③ HTTP server
const server = app.listen(CONFIG.port, () => {
  logger.info({ port: CONFIG.port }, "Server listening");
});

server.on("error", (err: NodeJS.ErrnoException) => {
  logger.error({ err }, "Fatal server error");
  process.exit(1);
});

// ③-b Sovereign container lock — containerize → encapsulate → lock
//      Called after server.listen() so all routes and middleware are
//      registered. After this point CONFIG is deep-frozen and the
//      sovereign container is sealed for the lifetime of this process.
SovereignLock.engage();

// ④ Support daemons
startDaemons();
registerRateMap("hmac", hmacRateBuckets);

// ⑤ Governance baseline — seal on first boot, verify on subsequent boots
void ensureBaseline();

// ⑥ Restore runtime context from last snapshot (non-blocking)
void loadSnapshot();

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal: string): void {
  logger.info({ signal }, "Shutdown signal received — draining daemons and closing server");
  stopDaemons();
  server.close(() => {
    logger.info("HTTP server closed — exiting cleanly");
    process.exit(0);
  });
  setTimeout(() => {
    logger.warn("Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
