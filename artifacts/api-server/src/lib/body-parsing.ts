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
 * Shared body-parsing middleware factory.
 *
 * Both the production server (app.ts) and the HMAC regression tests import
 * `applyCoreBodyParsing` from this module, so any change to the middleware
 * order here is immediately reflected in — and caught by — the test suite.
 *
 * Order is intentional and MUST NOT be swapped:
 *   ① captureRawBody   — streams wire bytes into req.rawBody before any parse
 *   ② jsonFromRawBody  — parses req.body from rawBody, never from the stream
 *
 * If ① and ② are swapped, req.rawBody is empty when HMAC verification runs,
 * causing every signed request to return 401 permanently.
 */

import { type Express, type Request, type Response, type NextFunction } from "express";
import { captureRawBody } from "../middleware/raw-body";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

export { captureRawBody };

/**
 * Parses `req.body` from `req.rawBody` — must run AFTER `captureRawBody`.
 * Returns 400 on malformed JSON so the global error handler is not invoked.
 */
export function jsonFromRawBody(req: Request, res: Response, next: NextFunction): void {
  const raw = (req as unknown as Record<string, unknown>).rawBody as string ?? "";
  if (raw && req.headers["content-type"]?.includes("application/json")) {
    try {
      req.body = JSON.parse(raw);
    } catch {
      res.status(400).json({ ok: false, error: "Malformed JSON body" });
      return;
    }
  }
  next();
}

/**
 * Install the canonical two-step body-parsing stack onto `app`.
 *
 * Used by both the production Express app (`app.ts`) and the HMAC regression
 * tests (`deploy.test.ts`). Any reordering in this function is immediately
 * detected by the HMAC tests — the whitespace-divergent body test will return
 * 401 (instead of 200) if `captureRawBody` is moved below `jsonFromRawBody`.
 */
export function applyCoreBodyParsing(app: Express): void {
  app.use(captureRawBody);
  app.use(jsonFromRawBody);
}
