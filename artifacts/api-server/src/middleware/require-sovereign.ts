/**
 * © 2026 Jonathan Sherman — S1AF · OCSO-S1AF-GOV-1
 * requireSovereign — JWT gate on all non-exempt API routes.
 *
 * Exempt:  /api/healthz  /api/auth/*
 * All others: must present  Authorization: Bearer <jwt>
 */

import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { CONFIG } from "../lib/config";
import { getBootGeneration } from "../lib/boot-generation";
import { getScore } from "../lib/behavioral-score-cache";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "../lib/authorship";
void _S1AF_ANCHOR;

// Paths are relative to the /api prefix (Express strips it before matching)
const EXEMPT = [
  "/healthz",
  "/auth/challenge",
  "/auth/register",
  "/auth/verify",
  "/auth/github-device",   // device-flow bootstrap — no JWT yet
  "/sentient/boot",        // boot-all — server is sovereign-environment-only
  "/sentient/boot-status",
  "/sentient/seal-env",       // credential sealing — runs before biometric enrollment
  "/sentient/create-release", // deploy pipeline — authenticated via X-Deploy-Secret
];

export function requireSovereign(req: Request, res: Response, next: NextFunction): void {
  // Allow exempt routes
  const bare = req.path.split("?")[0];
  if (EXEMPT.some(p => bare === p || bare.startsWith(p + "/"))) {
    next(); return;
  }

  const auth  = (req.headers["authorization"] as string | undefined) ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  if (!token) {
    res.status(401).json({ ok: false, error: "sovereign_required", message: "Biometric session token required." });
    return;
  }

  const secret = CONFIG.sessionSecret;
  if (!secret) {
    res.status(503).json({ ok: false, error: "session_secret_missing" });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as Record<string, unknown>;
    if (payload["sovereign"] !== "1" || payload["gov"] !== "OCSO-S1AF-GOV-1") {
      res.status(403).json({ ok: false, error: "sovereign_mismatch" });
      return;
    }

    // ── Account email lock — jonathantsherman@gmail.com only ────────────────
    // If the JWT carries an `email` claim (issued by iOS after DeviceGuard
    // seals the Keychain on first Face ID auth), it MUST match the sole
    // permitted Apple ID. An absent claim is allowed for backward-compatibility
    // with tokens issued before this check was added; once the iOS app is
    // rebuilt the claim will always be present.
    const tokenEmail = payload["email"];
    if (tokenEmail !== undefined && tokenEmail !== CONFIG.permittedEmail) {
      res.status(403).json({
        ok:    false,
        error: "account_not_permitted",
        message: "Only jonathantsherman@gmail.com is authorized on this iPhone XR.",
      });
      return;
    }
    // Boot generation check — any token issued before the last boot() call is dead
    const currentGen  = getBootGeneration();
    const tokenGen    = Number(payload["gen"] ?? 1);
    if (tokenGen < currentGen) {
      res.status(401).json({
        ok: false,
        error: "session_booted",
        message: "Session was terminated by sovereign boot command. Re-authenticate.",
      });
      return;
    }
    (req as unknown as Record<string, unknown>)["sovereign"] = payload;

    // ── Behavioral score gate ──────────────────────────────────────────────
    // The iOS client submits a HybridScore via POST /api/aarte/session-score
    // after every quantum verification.  We enforce the cached decision here.
    // If no entry exists (session hasn't run a behavioral check yet) we pass
    // through — backward-compatible with tokens issued before AARTE.
    const behavioralEntry = getScore(token);
    if (behavioralEntry) {
      if (behavioralEntry.decision === "UNAUTHORIZED") {
        res.status(403).json({
          ok:     false,
          error:  "behavioral_unauthorized",
          message: "Behavioral authentication failed. Re-enroll via Quantum tab.",
          score:  behavioralEntry.hybridScore,
        });
        return;
      }
      if (behavioralEntry.decision === "REVIEW") {
        res.status(401).json({
          ok:      false,
          error:   "behavioral_review",
          message: "Behavioral anomaly detected. Re-authenticate via Face ID.",
          challenge: "biometric_review",
          score:   behavioralEntry.hybridScore,
        });
        return;
      }
      // AUTHORIZED — attach score metadata for downstream routes
      (req as unknown as Record<string, unknown>)["behavioralScore"] = behavioralEntry;
    }

    next();
  } catch (e) {
    const expired = e instanceof jwt.TokenExpiredError;
    res.status(401).json({
      ok: false,
      error: expired ? "token_expired" : "token_invalid",
      message: expired ? "Biometric session expired — re-authenticate." : "Invalid session token.",
    });
  }
}
