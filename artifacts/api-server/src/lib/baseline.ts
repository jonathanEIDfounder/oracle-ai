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
 * Sentient Governance Baseline
 * ─────────────────────────────
 * Writes an immutable governance record to the sentient_baseline table on
 * first boot.  Subsequent boots verify the stored record matches the live
 * config and log a warning if tampering is detected.
 *
 * The baseline contains NO credentials — only governance metadata.
 */

import { createHash }            from "node:crypto";
import { db }                    from "@workspace/db";
import { sentientBaselineTable } from "@workspace/db";
import { logger }                from "./logger";
import { AUTHORSHIP }            from "./config";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

const S1AF_VERSION = "S1AF v1.0.0-JS";

/** SHA-256 of the AUTHORSHIP governance block — used as tamper indicator. */
function governanceHash(): string {
  const src = JSON.stringify({
    governor:   AUTHORSHIP.governor,
    governorId: AUTHORSHIP.governorId,
    governance: AUTHORSHIP.governance,
    product:    AUTHORSHIP.product,
    version:    S1AF_VERSION,
  });
  return createHash("sha256").update(src).digest("hex");
}

export async function ensureBaseline(): Promise<void> {
  try {
    const rows = await db.select().from(sentientBaselineTable).limit(1);

    if (rows.length === 0) {
      // First boot — write the governance baseline
      await db.insert(sentientBaselineTable).values({
        governor:   AUTHORSHIP.governor,
        governorId: AUTHORSHIP.governorId,
        governance: AUTHORSHIP.governance,
        version:    S1AF_VERSION,
        product:    AUTHORSHIP.product,
        promptHash: governanceHash(),
        sealed:     true,
      });
      logger.info(
        {
          governor:   AUTHORSHIP.governor,
          governorId: AUTHORSHIP.governorId,
          version:    S1AF_VERSION,
        },
        "  ⚑  Governance baseline sealed — first boot record written",
      );
      return;
    }

    // Subsequent boots — verify governance integrity
    const base    = rows[0];
    const current = governanceHash();
    const match   = base.promptHash === current;

    if (match) {
      logger.info(
        { governor: base.governor, governorId: base.governorId, armedAt: base.armedAt },
        "  ✓  Governance baseline verified — integrity intact",
      );
    } else {
      logger.warn(
        {
          stored:  base.promptHash,
          current,
          armedAt: base.armedAt,
        },
        "  ⚠  Governance baseline MISMATCH — config changed since first boot",
      );
    }
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "  ⚠  Governance baseline check skipped (DB unavailable)",
    );
  }
}
