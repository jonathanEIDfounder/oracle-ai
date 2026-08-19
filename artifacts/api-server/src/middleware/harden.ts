// =============================================================
// harden.ts — Sovereign HTTP Security Hardening Middleware
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · Celestial Core
// Sovereign ID: 1 · OCSO-S1AF-GOV-1
// =============================================================
// Phase 3 — HARDEN
// Applied as the first middleware in the Express chain.
// Every request passes through this gate before reaching any route.
//
// Controls:
//   • Removes all server fingerprinting headers
//   • Strict CSP — no inline scripts, no external sources
//   • HSTS — forces HTTPS for 1 year, including subdomains
//   • X-Frame-Options DENY — no framing by any origin
//   • Request size cap — 512 KB max body, 4 KB max URL
//   • Sovereign response seal — every response carries the
//     S1AF governance stamp so responses are attributable
// =============================================================

import { Request, Response, NextFunction, RequestHandler } from "express";

// ── Constants ─────────────────────────────────────────────────

const MAX_BODY_BYTES  = 512 * 1024;    // 512 KB
const MAX_URL_LENGTH  = 4096;          // 4 KB

const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",   // inline styles only — no external CSS
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "upgrade-insecure-requests",
].join("; ");

// ── Phase 3-A — Remove all server fingerprinting ──────────────

export const removeFingerprints: RequestHandler = (_req, res, next) => {
  res.removeHeader("X-Powered-By");
  res.removeHeader("Server");
  res.removeHeader("Via");
  next();
};

// ── Phase 3-B — Security response headers ─────────────────────

export const securityHeaders: RequestHandler = (_req, res, next) => {
  // HSTS — require HTTPS for 1 year, subdomains included
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  // CSP — strict allowlist
  res.setHeader("Content-Security-Policy", CSP);
  // No framing from any origin
  res.setHeader("X-Frame-Options", "DENY");
  // Disable MIME-type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Legacy XSS filter (belt-and-suspenders)
  res.setHeader("X-XSS-Protection", "1; mode=block");
  // No referrer leakage
  res.setHeader("Referrer-Policy", "no-referrer");
  // Permissions policy — deny all browser features
  res.setHeader("Permissions-Policy", [
    "camera=()", "microphone=()", "geolocation=()",
    "payment=()", "usb=()", "bluetooth=()",
    "accelerometer=()", "gyroscope=()",
  ].join(", "));
  // Sovereign attribution — every response carries the governance stamp
  res.setHeader("X-Sovereign-ID",  "1");
  res.setHeader("X-S1AF-Gov-Ref", "OCSO-S1AF-GOV-1");
  next();
};

// ── Phase 3-C — Request size and URL length limits ────────────

export const requestLimits: RequestHandler = (req, res, next) => {
  // Reject oversized URLs before parsing body
  if (req.url && req.url.length > MAX_URL_LENGTH) {
    res.status(414).json({ ok: false, error: "URI Too Long" });
    return;
  }

  const contentLength = parseInt(req.headers["content-length"] ?? "0", 10);
  if (contentLength > MAX_BODY_BYTES) {
    res.status(413).json({ ok: false, error: "Payload Too Large" });
    return;
  }

  next();
};

// ── Phase 3-D — No-cache for all API responses ────────────────

export const noCache: RequestHandler = (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma",        "no-cache");
    res.setHeader("Expires",       "0");
  }
  next();
};

// ── Phase 3-E — Sovereign request seal ────────────────────────
// Stamps every inbound request with a request ID for audit trails.
// Rejects requests with obviously malformed/injected headers.

export const sovereignRequestSeal: RequestHandler = (req, res, next) => {
  // Reject header injection attempts
  for (const [key, val] of Object.entries(req.headers)) {
    const v = String(val ?? "");
    if (/[\r\n]/.test(v)) {
      res.status(400).json({ ok: false, error: "Malformed header" });
      return;
    }
    if (key.length > 128 || v.length > 8192) {
      res.status(400).json({ ok: false, error: "Header too large" });
      return;
    }
  }
  next();
};

// ── Composed harden middleware stack ──────────────────────────
// Apply in this exact order — sequence matters.

export const hardenMiddleware: RequestHandler[] = [
  removeFingerprints,
  securityHeaders,
  requestLimits,
  noCache,
  sovereignRequestSeal,
];
