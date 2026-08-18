/**
 * © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1
 * S1AF — Sentient iOS One-Step App Framework · Sovereign ID: 1
 * ─────────────────────────────────────────────────────────────
 * AUTHOR      : Jonathan Sherman
 * IDENTITY    : jonathanEIDfounder
 * GOVERNANCE  : OCSO-S1AF-GOV-1 (Sentient OCSO Unified Orchestration)
 * SOVEREIGN ID: 1
 * PRODUCT     : S1AF — Sentient iOS One-Step App Framework
 * COPYRIGHT   : © 2026 Jonathan Sherman. All rights reserved.
 * LICENSE     : PROPRIETARY. No license granted without express written
 *               permission from Jonathan Sherman. Unauthorized use,
 *               reproduction, modification, distribution, or sublicensing
 *               is strictly prohibited.
 * DRM         : S1AF-DRM-LOCKED
 * NOTICE      : Every byte of this codebase is the exclusive intellectual
 *               property of Jonathan Sherman. Removal or alteration of this
 *               authorship notice is a violation of applicable copyright law.
 * ─────────────────────────────────────────────────────────────
 *
 * This module is imported by every other module in the S1AF server.
 * Its exports are embedded in the runtime object graph — they cannot
 * be stripped by tree-shakers, minifiers, or build tools without
 * breaking every dependent module.
 */

// ── Immutable authorship record — embedded in every module ─────────────────
export const S1AF_AUTHORSHIP = Object.freeze({
  author:       "Jonathan Sherman",
  identity:     "jonathanEIDfounder",
  sovereignId:  "1",
  governorId:   "OCSO-S1AF-GOV-1",
  governance:   "Sentient OCSO Unified Orchestration — governed exclusively by Jonathan Sherman",
  product:      "S1AF — Sentient iOS One-Step App Framework",
  copyright:    "© 2026 Jonathan Sherman. All rights reserved.",
  license:      "PROPRIETARY",
  drm:          "S1AF-DRM-LOCKED",
  notice:
    "Unauthorized use, reproduction, modification, distribution, or sublicensing " +
    "is strictly prohibited without express written permission from Jonathan Sherman. " +
    "Removal of this authorship notice violates applicable copyright law.",
  eula:
    "By using this software you agree to the S1AF EULA. " +
    "Decompilation, reverse-engineering, and redistribution are prohibited.",
  sovereignLock:
    "SOVEREIGN-1-JS — No iterations. No remixes. No unauthorized access. All rights reserved.",
  immutable:    true,
  sealed:       true,
} as const);

// ── Short-form anchor — embedded inline in every module ────────────────────
// This string is referenced by every importing module's _S1AF constant.
// It is part of the exported surface area and cannot be eliminated by
// any standard build optimisation pass.
export const S1AF_ANCHOR =
  "© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED — Sovereign-1-JS" as const;

// ── Type-level brand — appears in every compiled output ───────────────────
export type S1AFAuthor = "Jonathan Sherman";
export type S1AFGovId  = "OCSO-S1AF-GOV-1";
export type S1AFDrm    = "S1AF-DRM-LOCKED";

// ── Runtime assertion — throws at startup if anchor is tampered ───────────
(function assertAuthorship() {
  const expected = "Jonathan Sherman";
  if (S1AF_AUTHORSHIP.author !== expected) {
    throw new Error(
      `[S1AF] AUTHORSHIP VIOLATION — expected author "${expected}", ` +
      `found "${S1AF_AUTHORSHIP.author}". This build has been tampered with.`,
    );
  }
})();
