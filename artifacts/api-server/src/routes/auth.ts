/**
 * © 2026 Jonathan Sherman — S1AF · OCSO-S1AF-GOV-1
 * Sovereign biometric auth routes — WebAuthn (FIDO2 / passkey).
 *
 * POST /api/auth/challenge  — get registration or authentication options
 * POST /api/auth/register   — complete passkey registration
 * POST /api/auth/verify     — complete passkey authentication → JWT
 */

import { Router } from "express";
import jwt from "jsonwebtoken";
import { getBootGeneration } from "../lib/boot-generation";
import { randomUUID } from "crypto";
import {
  isRegistered,
  buildRegistrationOptions,
  completeRegistration,
  buildAuthenticationOptions,
  completeAuthentication,
} from "../lib/webauthn";
import { CONFIG } from "../lib/config";
import { logger } from "../lib/logger";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "../lib/authorship";
void _S1AF_ANCHOR;

const router = Router();

// ── POST /api/auth/challenge ──────────────────────────────────────────────────
// Returns WebAuthn options. mode is derived automatically: if no credential is
// registered yet → registration options; otherwise → authentication options.
// Client includes its session key so we can correlate the challenge.
router.post("/auth/challenge", async (req, res) => {
  const origin     = (req.headers["origin"] as string) || "http://localhost";
  const sessionKey = (req.body?.sessionKey as string) || randomUUID();

  try {
    if (!isRegistered()) {
      const options = await buildRegistrationOptions(origin, sessionKey);
      res.json({ ok: true, mode: "register", options, sessionKey });
    } else {
      const options = await buildAuthenticationOptions(origin, sessionKey);
      res.json({ ok: true, mode: "authenticate", options, sessionKey });
    }
  } catch (e) {
    logger.error({ err: e }, "auth/challenge error");
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ── POST /api/auth/register ───────────────────────────────────────────────────
// Completes the WebAuthn registration ceremony.
router.post("/auth/register", async (req, res) => {
  const { sessionKey, response } = req.body ?? {};
  const origin = (req.headers["origin"] as string) || "http://localhost";

  if (!sessionKey || !response) {
    res.status(400).json({ ok: false, error: "sessionKey and response required" });
    return;
  }

  try {
    await completeRegistration(origin, sessionKey, response);
    res.json({ ok: true, registered: true });
  } catch (e) {
    logger.error({ err: e }, "auth/register error");
    res.status(400).json({ ok: false, error: String(e) });
  }
});

// ── POST /api/auth/verify ─────────────────────────────────────────────────────
// Completes the WebAuthn authentication ceremony. Returns a signed JWT (8 h).
router.post("/auth/verify", async (req, res) => {
  const { sessionKey, response } = req.body ?? {};
  const origin = (req.headers["origin"] as string) || "http://localhost";

  if (!sessionKey || !response) {
    res.status(400).json({ ok: false, error: "sessionKey and response required" });
    return;
  }

  const secret = CONFIG.sessionSecret;
  if (!secret) {
    res.status(503).json({ ok: false, error: "SESSION_SECRET not configured" });
    return;
  }

  try {
    await completeAuthentication(origin, sessionKey, response);

    const token = jwt.sign(
      {
        sovereign: "1",
        gov:       "OCSO-S1AF-GOV-1",
        author:    "Jonathan Sherman",
        gen:       getBootGeneration(),   // boot generation — old tokens auto-rejected
      },
      secret,
      { expiresIn: "8h" },
    );

    logger.info("auth/verify: sovereign session issued");
    res.json({ ok: true, token });
  } catch (e) {
    logger.error({ err: e }, "auth/verify error");
    res.status(401).json({ ok: false, error: String(e) });
  }
});

// ── GET /api/auth/status ──────────────────────────────────────────────────────
// Returns whether a credential is registered (no secret exposure).
router.get("/auth/status", (_req, res) => {
  res.json({ ok: true, registered: isRegistered() });
});

export default router;
