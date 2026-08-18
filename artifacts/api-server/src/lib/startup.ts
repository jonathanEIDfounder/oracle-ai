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
 * Startup validation — executes before the HTTP server binds.
 * Logs a structured summary of every required secret and config value,
 * including the Sentient Retrieval report (which variables were recovered
 * automatically vs already present vs still missing).
 *
 * All secret values are displayed OBFUSCATED — never in plaintext.
 * Never throws on a missing optional secret — each endpoint self-503s.
 * Hard failures (invalid PORT, broken invariants) have already thrown in config.ts.
 */

import { logger } from "./logger";
import { CONFIG, AUTHORSHIP } from "./config";
import { type RetrievalReport } from "./sentient-retrieval";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

// ── Obfuscation ───────────────────────────────────────────────────────────────

export function obfuscate(v: string): string {
  if (!v || v.length === 0) return "(not set)";
  if (v.length < 4)         return "***";
  return v.slice(0, 2) + "•".repeat(Math.max(4, v.length - 4)) + v.slice(-2);
}

// ── Startup checks ────────────────────────────────────────────────────────────

interface Check {
  name:   string;
  ok:     boolean;
  detail: string;
  impact: string;
}

function buildChecks(): Check[] {
  const ds = CONFIG.deploySecret;
  const gh = CONFIG.githubPat;
  const ms = CONFIG.moonshotKey;
  const ss = CONFIG.sessionSecret;

  return [
    {
      name:   "PORT",
      ok:     CONFIG.port > 0,
      detail: String(CONFIG.port),
      impact: "fatal — server cannot bind",
    },
    {
      name:   "DEPLOY_SECRET",
      ok:     ds.length >= 8,
      detail: ds.length >= 8 ? obfuscate(ds) : "(not set)",
      impact: "all deploy endpoints will 503",
    },
    {
      name:   "GITHUB_PAT",
      ok:     gh.length > 10,
      detail: gh.length > 10 ? obfuscate(gh) : "(not set)",
      impact: "GitHub workflow dispatch will fail",
    },
    {
      name:   "MOONSHOT_API_KEY",
      ok:     ms.length > 10,
      detail: ms.length > 10 ? obfuscate(ms) : "(not set)",
      impact: "Kimi AI code generation disabled",
    },
    {
      name:   "SESSION_SECRET",
      ok:     ss.length >= 16,
      detail: ss.length >= 16 ? obfuscate(ss) : "(not set)",
      impact: "sessions are cryptographically insecure",
    },
  ];
}

// ── Retrieval report banner ───────────────────────────────────────────────────

function logRetrievalReport(report: RetrievalReport): void {
  if (!report.attempted) {
    logger.warn(
      { reason: report.errorMessage ?? "no valid auth token" },
      "  ⤳  Sentient Retrieval skipped — running on env secrets only",
    );
    return;
  }

  const sourceIcon = (s: string) =>
    s === "sentient-var" ? "↓" : s === "env" ? "✓" : "✗";

  logger.info(
    { authSource: report.authSource, patched: report.patchCount },
    `  ⤳  Sentient Retrieval: ${report.patchCount} secret(s) recovered via oracle-ai [auth: ${report.authSource}]`,
  );

  for (const e of report.entries) {
    const icon = sourceIcon(e.source);
    const tag  = e.patched ? " [PATCHED]" : "";
    const src  = e.source === "sentient-var"
      ? `oracle-ai:${e.varName}`
      : e.source === "env"
      ? "env"
      : `not-found (${e.varName})`;

    logger.info(
      { key: e.key, source: e.source, display: e.display, patched: e.patched },
      `    ${icon}  ${e.key} ← ${src}${tag}  ${e.display}`,
    );
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export function runStartupChecks(retrievalReport?: RetrievalReport): void {
  const checks = buildChecks();
  const failed = checks.filter(c => !c.ok);
  const passed = checks.filter(c =>  c.ok);

  // Authorship banner
  logger.info(
    { author: AUTHORSHIP.author, product: AUTHORSHIP.product, sovereignId: AUTHORSHIP.sovereignId },
    `━━ ${AUTHORSHIP.copyright} — ${AUTHORSHIP.product} ━━`,
  );
  logger.info({ license: AUTHORSHIP.license, drm: AUTHORSHIP.drm }, AUTHORSHIP.rights);
  // Governance identity logged at debug level — invisible in production log streams.
  logger.debug(
    { governor: AUTHORSHIP.governor, governorId: AUTHORSHIP.governorId, governance: AUTHORSHIP.governance },
    `Sentient governance active — ${AUTHORSHIP.governorId}`,
  );
  logger.info({ env: CONFIG.nodeEnv, port: CONFIG.port, github: CONFIG.github }, "Environment");

  // Sentient Retrieval report (before secret checks so the checks reflect patched values)
  if (retrievalReport) {
    logRetrievalReport(retrievalReport);
  }

  // Secret checks — read CONFIG values AFTER retrieval has patched them
  for (const c of passed) {
    logger.info({ check: c.name, value: c.detail }, `  ✓  ${c.name}`);
  }
  for (const c of failed) {
    logger.warn({ check: c.name, impact: c.impact }, `  ⚠  ${c.name} — ${c.impact}`);
  }

  if (failed.length === 0) {
    logger.info("━━ All checks passed — S1AF fully armed and locked ━━");
  } else {
    logger.warn(
      { count: failed.length, names: failed.map(c => c.name) },
      `━━ ${failed.length} check(s) need attention — server starting with degraded capability ━━`,
    );
  }
}
