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
 * Raw-body capture middleware.
 *
 * Buffers the full request body into req.rawBody (UTF-8 string) BEFORE
 * express.json() or any manual JSON.parse so HMAC verification can sign
 * exactly the bytes that arrived on the wire.
 *
 * Security properties:
 *   • Hard body-size cap — rejects requests larger than BODY_SIZE_LIMIT
 *     with 413 before any parsing, preventing unbounded memory growth.
 *   • Stream error propagation — socket errors call next(err) so the
 *     global error handler can close the response cleanly.
 *   • Abort guard — sets rawBody to "" on aborted connections so
 *     downstream code never sees undefined.
 */

import { type Request, type Response, type NextFunction } from "express";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "../lib/authorship";
void _S1AF_ANCHOR;

/** Maximum accepted request body size (256 KiB). Tune in config if needed. */
export const BODY_SIZE_LIMIT = 256 * 1024; // 256 KB

export function captureRawBody(req: Request, res: Response, next: NextFunction): void {
  // Multipart requests are handled by multer on specific routes — skip raw capture
  // so multer can read the stream directly.
  const ct = req.headers["content-type"] ?? "";
  if (ct.startsWith("multipart/form-data")) {
    (req as unknown as Record<string, unknown>).rawBody = "";
    next();
    return;
  }

  const chunks: Buffer[] = [];
  let   bytesReceived    = 0;

  req.on("data", (chunk: Buffer) => {
    bytesReceived += chunk.length;
    if (bytesReceived > BODY_SIZE_LIMIT) {
      res.status(413).json({ ok: false, error: `Request body too large (limit: ${BODY_SIZE_LIMIT} bytes)` });
      req.destroy(); // stop reading from socket
      return;
    }
    chunks.push(chunk);
  });

  req.on("end", () => {
    (req as unknown as Record<string, unknown>).rawBody = Buffer.concat(chunks).toString("utf8");
    next();
  });

  req.on("error", next);

  req.on("close", () => {
    // Ensure rawBody is always a string even on aborted connections
    if ((req as unknown as Record<string, unknown>).rawBody === undefined) {
      (req as unknown as Record<string, unknown>).rawBody = "";
    }
  });
}
