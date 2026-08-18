/**
 * © 2026 Jonathan Sherman — S1AF · OCSO-S1AF-GOV-1
 *
 * GitHub Device Flow routes — no auth required (bootstrap endpoint).
 *
 *   POST /auth/github-device/start   → request device code + start poller
 *   GET  /auth/github-device/status  → poll until state=approved|expired|denied
 */

import { Router } from "express";
import { startDeviceFlow, getDeviceFlowStatus } from "../lib/github-device-flow";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "../lib/authorship";
void _S1AF_ANCHOR;

const router = Router();

// ── POST /auth/github-device/start ─────────────────────────────────────────
router.post("/github-device/start", async (_req, res) => {
  try {
    const status = await startDeviceFlow();
    res.json({
      ok:              status.state === "pending",
      state:           status.state,
      userCode:        status.userCode,
      verificationUri: status.verificationUri,
      expiresAt:       status.expiresAt,
      instructions: status.userCode
        ? `Visit ${status.verificationUri} and enter code: ${status.userCode}`
        : undefined,
      error: status.error,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ── GET /auth/github-device/status ─────────────────────────────────────────
router.get("/github-device/status", (_req, res) => {
  const status = getDeviceFlowStatus();
  res.json({
    ok:          status.state === "approved",
    state:       status.state,
    userCode:    status.userCode,
    pollCount:   status.pollCount,
    approvedAt:  status.approvedAt,
    tokenMask:   status.tokenMask,
    expiresAt:   status.expiresAt,
    error:       status.error,
  });
});

export default router;
