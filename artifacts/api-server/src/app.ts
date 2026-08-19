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
 * NOTICE: This software is proprietary and confidential. Unauthorized use,
 * reproduction, modification, distribution, or sublicensing — in whole or in
 * part — is strictly prohibited without express written permission from the
 * author. No implied license is granted. Violators will be prosecuted to the
 * fullest extent of applicable law.
 *
 * S1AF API Server — Express application factory.
 * Middleware order is strict; do not reorder without understanding side-effects.
 *
 * Stack (in order):
 *   ① Remove server fingerprint
 *   ② Security + authorship headers
 *   ③ Strict CORS
 *   ④ Structured request logging
 *   ⑤ Raw-body capture (256 KB limit) — MUST precede JSON parse
 *   ⑥ JSON parse from raw buffer
 *   ⑦ URL-encoded form bodies
 *   ⑧ API routes
 *   ⑨ Global error handler
 */

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { CONFIG } from "./lib/config";
import { noFingerprint, securityHeaders, strictCors } from "./lib/security";
import { applyCoreBodyParsing } from "./lib/body-parsing";
import { requestLimits, sovereignRequestSeal } from "./middleware/harden";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./lib/authorship";
void _S1AF_ANCHOR;

const app: Express = express();

// ① Remove server fingerprint — never advertise runtime details
app.disable("x-powered-by");
app.use(noFingerprint);

// ② Security headers — CSP, HSTS (prod), anti-sniff, anti-frame, referrer + authorship chain
app.use(securityHeaders);

// ③ Strict CORS — Replit preview domains + localhost dev only
app.use(strictCors);

// ③-b Harden — request size cap (512 KB body / 4 KB URL) + header injection guard
//      Applied after CORS so pre-flight OPTIONS are not rejected, before logging
//      so malformed requests never pollute the log stream.
app.use(requestLimits);
app.use(sovereignRequestSeal);

// ④ Structured request logging (after CORS so pre-flights are not logged as errors)
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ⑤⑥ Raw-body capture then JSON parse — order enforced by shared factory.
//     applyCoreBodyParsing is also imported by HMAC regression tests so any
//     reordering here is immediately caught (whitespace-divergent body test fails).
applyCoreBodyParsing(app);

// ⑦ URL-encoded form bodies (for legacy tooling compatibility)
app.use(express.urlencoded({ extended: true }));

// ⑧ API routes
app.use("/api", router);

// ⑨ Global error handler — full detail in development, opaque in production
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const isDev   = CONFIG.nodeEnv !== "production";
  const message = err instanceof Error ? err.message : "Internal server error";
  const stack   = isDev && err instanceof Error ? err.stack : undefined;
  logger.error({ err }, "Unhandled error");
  if (!res.headersSent) {
    res.status(500).json({ ok: false, error: message, ...(stack ? { stack } : {}) });
  }
});

export default app;
