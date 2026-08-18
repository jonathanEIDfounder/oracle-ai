/**
 * HMAC-SHA256 request authentication.
 *
 * The client signs: HMAC-SHA256(canonical, secret)
 *   canonical = `${timestamp}\n${method}\n${path}\n${bodyHash}`
 *   bodyHash  = hex(SHA-256(rawBody))  — empty string for no body
 *
 * Headers sent by client:
 *   X-Deploy-Timestamp: <unix seconds>
 *   X-Deploy-Signature: <hex HMAC>
 *
 * Legacy fallback (X-Deploy-Token header) still accepted for
 * backwards compatibility with existing curl scripts.
 *
 * Replay window: ±300 seconds (5 minutes).
 * Rate limit:    MAX_REQUESTS per WINDOW_MS per remote IP.
 */

import crypto from "node:crypto";
import { type Request, type Response, type NextFunction } from "express";

const REPLAY_WINDOW_S = 300;
const MAX_REQUESTS    = 10;
const WINDOW_MS       = 60_000; // 1 minute

// ── In-memory rate limiter ────────────────────────────────────
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now    = Date.now();
  let   bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    rateBuckets.set(ip, bucket);
  }
  bucket.count++;
  return bucket.count <= MAX_REQUESTS;
}

// Prune old buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBuckets) if (v.resetAt < now) rateBuckets.delete(k);
}, 5 * 60_000);

// ── HMAC helpers ──────────────────────────────────────────────
function hmac(secret: string, data: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

function sha256hex(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/** Constant-time string comparison */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── Canonical string ──────────────────────────────────────────
function canonical(ts: number, method: string, path: string, body: string): string {
  const bodyHash = sha256hex(body || "");
  return `${ts}\n${method.toUpperCase()}\n${path}\n${bodyHash}`;
}

// ── Middleware factory ─────────────────────────────────────────
export function requireAuth(options?: { allowLegacy?: boolean }) {
  const { allowLegacy = true } = options ?? {};

  return (req: Request, res: Response, next: NextFunction): void => {
    const secret = process.env.DEPLOY_SECRET;
    if (!secret || secret.length < 8) {
      res.status(503).json({ ok: false, error: "Deploy endpoint not configured", field: "DEPLOY_SECRET" });
      return;
    }

    // ── Rate limit ────────────────────────────────────────────
    const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown").split(",")[0].trim();
    if (!checkRateLimit(ip)) {
      res.status(429).json({ ok: false, error: "Rate limit exceeded — try again in a minute" });
      return;
    }

    // ── HMAC path (preferred) ─────────────────────────────────
    const tsHeader  = req.headers["x-deploy-timestamp"] as string | undefined;
    const sigHeader = req.headers["x-deploy-signature"] as string | undefined;

    if (tsHeader && sigHeader) {
      const ts  = parseInt(tsHeader, 10);
      const now = Math.floor(Date.now() / 1000);
      if (isNaN(ts) || Math.abs(now - ts) > REPLAY_WINDOW_S) {
        res.status(401).json({ ok: false, error: "Request expired or clock skew too large (±5 min allowed)" });
        return;
      }
      const rawBody = (req as any).rawBody ?? JSON.stringify(req.body ?? "");
      const canon   = canonical(ts, req.method, req.originalUrl.split("?")[0], rawBody);
      const expected = hmac(secret, canon);
      if (!safeEqual(sigHeader.toLowerCase(), expected)) {
        res.status(401).json({ ok: false, error: "Invalid HMAC signature" });
        return;
      }
      next();
      return;
    }

    // ── Legacy static-token path ──────────────────────────────
    if (allowLegacy) {
      const provided =
        (req.headers["x-deploy-token"] as string | undefined) ??
        (req.headers["authorization"] ?? "").toString().replace(/^Bearer\s+/i, "");
      if (provided && safeEqual(provided, secret)) {
        next();
        return;
      }
    }

    res.status(401).json({
      ok: false,
      error: "Auth required — include X-Deploy-Timestamp + X-Deploy-Signature headers",
      hint: allowLegacy ? "Legacy X-Deploy-Token header also accepted" : undefined,
    });
  };
}

// ── Client-side signing helper (for Node.js scripts / oracle-ai) ──
export function signRequest(secret: string, method: string, path: string, body: string = ""): {
  "X-Deploy-Timestamp": string;
  "X-Deploy-Signature": string;
} {
  const ts     = Math.floor(Date.now() / 1000);
  const canon  = canonical(ts, method, path, body);
  const sig    = hmac(secret, canon);
  return { "X-Deploy-Timestamp": String(ts), "X-Deploy-Signature": sig };
}
