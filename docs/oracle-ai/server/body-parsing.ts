/**
 * Oracle-AI body-parsing middleware factory.
 *
 * Used by BOTH the production server (index.ts) and the HMAC regression tests
 * (s1af-deploy.test.ts).  Any change to the middleware order here is
 * immediately reflected in — and caught by — the whitespace-divergent body
 * test, because the test calls `applyOracleAiBodyParsing` directly.
 *
 * Order is intentional and MUST NOT be swapped:
 *   ① rawBodyCapture   — streams wire bytes into req.rawBody before any parse
 *   ② jsonFromRawBody  — parses req.body from rawBody, never from the stream
 *
 * If ① and ② are swapped, the stream is already consumed when ① runs, so
 * rawBody is set to "".  HMAC verification then computes sha256("") which does
 * not match the client's sha256(wireBytes) — every signed deploy returns 401.
 */

import express from "express";

/** Maximum accepted request body size (256 KiB — matches api-server limit). */
export const RAW_BODY_LIMIT = 256 * 1024;

/**
 * ① Raw-body capture middleware.
 * Buffers all wire bytes into req.rawBody BEFORE any JSON parsing so that
 * HMAC verification in s1af-deploy can sign exactly what arrived on the wire.
 */
export function rawBodyCapture(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const ct = (req.headers["content-type"] as string) ?? "";
  if (ct.startsWith("multipart/form-data")) {
    (req as any).rawBody = "";
    next();
    return;
  }
  const chunks: Buffer[] = [];
  let total = 0;
  req.on("data", (chunk: Buffer) => {
    total += chunk.length;
    if (total > RAW_BODY_LIMIT) {
      res.status(413).json({ ok: false, error: "Request body too large" });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on("end",   () => { (req as any).rawBody = Buffer.concat(chunks).toString("utf8"); next(); });
  req.on("error", next);
  req.on("close", () => { if ((req as any).rawBody === undefined) (req as any).rawBody = ""; });
}

/**
 * ② JSON parse from rawBody — must run AFTER rawBodyCapture.
 * Returns 400 on malformed JSON so the global handler is not invoked.
 */
export function jsonFromRawBody(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const raw: string = (req as any).rawBody ?? "";
  if (raw && (req.headers["content-type"] ?? "").includes("application/json")) {
    try {
      req.body = JSON.parse(raw);
    } catch {
      res.status(400).json({ ok: false, error: "Malformed JSON" });
      return;
    }
  }
  next();
}

/**
 * Install the canonical two-step body-parsing stack onto `app`.
 *
 * Called by index.ts (production) and imported directly by s1af-deploy.test.ts
 * (tests), so any reordering inside this function is caught by the test suite.
 */
export function applyOracleAiBodyParsing(app: express.Express): void {
  app.use(rawBodyCapture);
  app.use(jsonFromRawBody);
}
