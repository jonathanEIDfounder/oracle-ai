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
 * HMAC-SHA256 request authentication.
 *
 * The client signs: HMAC-SHA256(canonical, DEPLOY_SECRET)
 *   canonical = `${timestamp}\n${METHOD}\n${path}\n${SHA256(rawBody)}`
 *   bodyHash  = hex(SHA-256(rawBody))  — empty string when no body
 *
 * Headers sent by client:
 *   X-Deploy-Timestamp: <unix seconds>
 *   X-Deploy-Signature: <lowercase hex HMAC>
 *
 * Security properties:
 *   • Clock skew guard    — ±REPLAY_WINDOW_S (5 min); requests outside window → 401
 *   • Replay prevention   — every accepted signature is stored in replayCache until
 *                           its window expires; re-submitting the same sig → 401
 *   • Timing-safe compare — crypto.timingSafeEqual, no early exit
 *   • No secret on wire   — raw DEPLOY_SECRET never transmitted
 *   • HMAC mandatory      — legacy token fallback is opt-in (allowLegacy: true),
 *                           disabled by default
 *
 * Rate limit: CONFIG.rateLimit.hmacPerMin requests per minute per IP.
 * Export hmacRateBuckets so the daemon prune loop can clean it up.
 */

import crypto from "node:crypto";
import { type Request, type Response, type NextFunction } from "express";
import { CONFIG } from "./config";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

const REPLAY_WINDOW_S = CONFIG.hmacReplayWindowSec; // 300
const MAX_REQUESTS    = CONFIG.rateLimit.hmacPerMin; // 10
const WINDOW_MS       = 60_000;

// ── Rate limiter — exported for daemon registration and test isolation ────────
export const hmacRateBuckets = new Map<string, { count: number; resetAt: number }>();

/**
 * Clear all in-memory HMAC state (rate buckets + replay cache).
 * EXPORTED FOR TEST ISOLATION ONLY — never call in production code.
 */
export function _clearHmacStateForTesting(): void {
  hmacRateBuckets.clear();
  replayCache.clear();
}

function checkRateLimit(ip: string): boolean {
  const now   = Date.now();
  let bucket  = hmacRateBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    hmacRateBuckets.set(ip, bucket);
  }
  bucket.count++;
  return bucket.count <= MAX_REQUESTS;
}

// ── Replay cache ──────────────────────────────────────────────────────────────
// Maps lowercase hex signature → unix expiry. Prevents a valid signed request
// from being replayed within its 5-min window. Lazy-pruned at >10 k entries.
const replayCache = new Map<string, number>();

function checkAndStoreReplay(sig: string, ts: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  if (replayCache.size > 10_000) {
    for (const [k, exp] of replayCache) if (exp < now) replayCache.delete(k);
  }
  if (replayCache.has(sig)) return false; // already seen — replay!
  replayCache.set(sig, ts + REPLAY_WINDOW_S + 5); // small buffer past window
  return true;
}

// ── HMAC helpers ──────────────────────────────────────────────────────────────
function hmacHex(secret: string, data: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

function sha256hex(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/** Timing-safe string comparison — uses Node's native crypto.timingSafeEqual. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

// ── Canonical string ──────────────────────────────────────────────────────────
function canonical(ts: number, method: string, path: string, body: string): string {
  return `${ts}\n${method.toUpperCase()}\n${path}\n${sha256hex(body || "")}`;
}

// ── Middleware factory ─────────────────────────────────────────────────────────
/**
 * requireAuth() — HMAC authentication middleware.
 *
 * @param options.allowLegacy  Accept X-Deploy-Token header for back-compat.
 *                             Default: false — HMAC is mandatory.
 */
export function requireAuth(options?: { allowLegacy?: boolean }) {
  const { allowLegacy = false } = options ?? {};

  return (req: Request, res: Response, next: NextFunction): void => {
    const secret = CONFIG.deploySecret;
    if (!secret || secret.length < 8) {
      res.status(503).json({ ok: false, error: "Deploy endpoint not configured", field: "DEPLOY_SECRET" });
      return;
    }

    // ── Rate limit (by first non-proxy IP) ────────────────────────────────────
    const ip = ((req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown")
      .split(",")[0].trim();
    if (!checkRateLimit(ip)) {
      res.status(429).json({ ok: false, error: "Rate limit exceeded — try again in a minute" });
      return;
    }

    // ── HMAC path ─────────────────────────────────────────────────────────────
    const tsHeader  = req.headers["x-deploy-timestamp"] as string | undefined;
    const sigHeader = req.headers["x-deploy-signature"]  as string | undefined;

    if (tsHeader && sigHeader) {
      const ts  = parseInt(tsHeader, 10);
      const now = Math.floor(Date.now() / 1000);
      if (isNaN(ts) || Math.abs(now - ts) > REPLAY_WINDOW_S) {
        res.status(401).json({ ok: false, error: "Request expired or clock skew too large (±5 min allowed)" });
        return;
      }

      // rawBody MUST be set by captureRawBody middleware (app.ts) before express.json().
      // If it is missing the server is misconfigured — fail clearly rather than silently
      // computing an HMAC over re-serialised JSON bytes that never match the wire signature.
      const rawBody = (req as unknown as Record<string, unknown>).rawBody as string | undefined;
      if (rawBody === undefined) {
        res.status(500).json({ ok: false, error: "Server misconfigured — raw body not captured. Ensure captureRawBody runs before express.json()." });
        return;
      }
      const canon   = canonical(ts, req.method, req.originalUrl.split("?")[0], rawBody);
      const expected = hmacHex(secret, canon);
      const sig      = sigHeader.toLowerCase();

      if (!safeEqual(sig, expected)) {
        res.status(401).json({ ok: false, error: "Invalid HMAC signature" });
        return;
      }

      // Replay check AFTER signature validation (avoid poisoning cache with bad sigs)
      if (!checkAndStoreReplay(sig, ts)) {
        res.status(401).json({ ok: false, error: "Replayed request — generate a fresh signature" });
        return;
      }

      next();
      return;
    }

    // ── Legacy static-token fallback (opt-in only) ────────────────────────────
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
      ...(allowLegacy ? { hint: "Legacy X-Deploy-Token header also accepted" } : {}),
    });
  };
}

// ── Client-side signing helper (Node.js scripts, oracle-ai, shell) ────────────
export function signRequest(
  secret: string,
  method: string,
  path:   string,
  body:   string = "",
): { "X-Deploy-Timestamp": string; "X-Deploy-Signature": string } {
  const ts    = Math.floor(Date.now() / 1000);
  const canon = canonical(ts, method, path, body);
  const sig   = hmacHex(secret, canon);
  return { "X-Deploy-Timestamp": String(ts), "X-Deploy-Signature": sig };
}
