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
 * NOTICE: Proprietary and confidential. No license granted.
 * Unauthorized use, reproduction, or distribution is prohibited.
 *
 * Security middleware — applied globally before all API routes.
 *
 *   noFingerprint   — removes X-Powered-By so the runtime is not advertised.
 *   securityHeaders — sets CSP, HSTS (prod only), anti-sniff, anti-frame,
 *                     referrer policy, and permissions policy.
 *   strictCors      — permits only Replit preview domains and localhost dev;
 *                     rejects unknown-origin pre-flights with 403.
 */

import { type Request, type Response, type NextFunction } from "express";
import { CONFIG } from "./config";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

const isProd = CONFIG.nodeEnv === "production";

// Origins the API accepts CORS from
const ALLOWED_ORIGIN_RE: RegExp[] = [
  /^https:\/\/[\w-]+\.replit\.dev$/,
  /^https:\/\/[\w-]+\.replit\.app$/,
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
];

function isOriginAllowed(origin: string): boolean {
  return ALLOWED_ORIGIN_RE.some(re => re.test(origin));
}

// ── Middleware ────────────────────────────────────────────────────────────────

export function noFingerprint(_req: Request, res: Response, next: NextFunction): void {
  res.removeHeader("X-Powered-By");
  res.removeHeader("Server");
  next();
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options",  "nosniff");
  // Block all framing (API server serves no embeddable UI)
  res.setHeader("X-Frame-Options",         "DENY");
  // Legacy IE XSS filter
  res.setHeader("X-XSS-Protection",        "1; mode=block");
  // Limit referrer leakage across origins
  res.setHeader("Referrer-Policy",         "no-referrer");
  // Disable all sensor/device APIs
  res.setHeader("Permissions-Policy",      "camera=(), microphone=(), geolocation=(), interest-cohort=()");
  // CSP: API-only server; no scripts, styles, frames, images, or media
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  // Suppress all crawler indexing — this API is invisible to the web
  res.setHeader("X-Robots-Tag",            "noindex, nofollow, noarchive, nosnippet, noodp");
  // No caching of any API response — every call must be live
  res.setHeader("Cache-Control",           "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma",                  "no-cache");
  // Embed authorship in every response (ASCII-safe; non-strippable unless headers are dropped)
  res.setHeader("X-S1AF-Author",    "Jonathan Sherman");
  res.setHeader("X-S1AF-Product",   "S1AF Sentient iOS One-Step App Framework");
  res.setHeader("X-S1AF-Copyright", "(c) 2026 Jonathan Sherman. All rights reserved.");
  res.setHeader("X-S1AF-License",   "PROPRIETARY - No license granted");
  res.setHeader("X-S1AF-DRM",       "S1AF-DRM-LOCKED");
  res.setHeader("X-S1AF-EULA",      "Unauthorized use, reproduction or distribution prohibited.");
  // HSTS in production (2 years, include subdomains, preload-eligible)
  if (isProd) {
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  next();
}

export function strictCors(req: Request, res: Response, next: NextFunction): void {
  const origin  = (req.headers["origin"] as string | undefined) ?? "";
  const allowed = !origin || isOriginAllowed(origin);

  if (origin && allowed) {
    res.setHeader("Access-Control-Allow-Origin",  origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Deploy-Token, X-Deploy-Signature, X-Deploy-Timestamp"
    );
    res.setHeader("Access-Control-Max-Age", "600");
    res.setHeader("Vary", "Origin");
  }

  if (req.method === "OPTIONS") {
    res.status(allowed ? 204 : 403).end();
    return;
  }

  next();
}
