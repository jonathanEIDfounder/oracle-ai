/**
 * © 2026 Jonathan Sherman — S1AF · OCSO-S1AF-GOV-1
 * routes/aarte.ts — Apple AI Runtime & Tactical Engine API
 *
 * POST /api/aarte/analyze   — run all three AARTE decisions in one call
 * GET  /api/aarte/status    — return the most recent analysis (for polling)
 *
 * These routes are intentionally unguarded — AARTE analysis is pure text
 * processing with no access to secrets or sovereign state.
 */

import { Router, type Request, type Response } from "express";
import { analyzeAll, type AarteAnalysis }       from "../lib/aarte";
import { logger }                                from "../lib/logger";
import {
  setScore, getScore, clearScore, cacheSize, decisionFromScore,
  type BehavioralDecision,
} from "../lib/behavioral-score-cache";

// ── Authorship anchor ─────────────────────────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "../lib/authorship";
void _S1AF_ANCHOR;

const router = Router();

// In-memory last result — single-server; sufficient for the QI dashboard.
let lastAnalysis: AarteAnalysis | null = null;

// ── POST /api/aarte/analyze ───────────────────────────────────────────────────
router.post("/aarte/analyze", (req: Request, res: Response) => {
  const {
    buildLog     = "",
    testResults  = {},
    backends     = {},
  } = req.body as {
    buildLog?:    string;
    testResults?: Record<string, boolean>;
    backends?:    Record<string, number>;
  };

  const analysis = analyzeAll(buildLog, testResults, backends);
  lastAnalysis   = analysis;

  logger.info(
    { decision: analysis.decision, shouldDeploy: analysis.shouldDeploy, optimalBackend: analysis.optimalBackend },
    "aarte/analyze",
  );

  res.json({ ok: true, ...analysis });
});

// ── GET /api/aarte/status ─────────────────────────────────────────────────────
router.get("/aarte/status", (_req: Request, res: Response) => {
  res.json({ ok: true, lastAnalysis });
});

// ── POST /api/aarte/session-score ─────────────────────────────────────────────
//
// Called by the iOS client (QuantumView) after a successful hybrid verification.
// Stores the behavioral decision in the server-side cache (TTL 60 s) so that
// requireSovereign can enforce it on every subsequent request.
//
// Auth: Bearer <sovereign JWT>  (must be valid — we key the cache by this token)
// Body: { hybridScore, classical, quantum, backend, jobId? }
//
// This route is listed in routes/index.ts BEFORE requireSovereign so the
// middleware runs on this route too — the JWT must be valid to submit a score.
router.post("/aarte/session-score", (req: Request, res: Response) => {
  // Extract raw token (requireSovereign already validated it; it's in headers)
  const auth  = (req.headers["authorization"] as string | undefined) ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  if (!token) {
    res.status(401).json({ ok: false, error: "no_token" });
    return;
  }

  const {
    hybridScore,
    classical = 0,
    quantum   = 0,
    backend   = "",
    jobId     = null,
  } = req.body as {
    hybridScore?: number;
    classical?:   number;
    quantum?:     number;
    backend?:     string;
    jobId?:       string | null;
  };

  if (typeof hybridScore !== "number" || hybridScore < 0 || hybridScore > 1) {
    res.status(400).json({ ok: false, error: "invalid_score",
                           message: "hybridScore must be a number in [0, 1]" });
    return;
  }

  const decision: BehavioralDecision = decisionFromScore(hybridScore);

  setScore(token, {
    decision,
    hybridScore,
    classical,
    quantum,
    backend,
    jobId,
  });

  logger.info(
    { decision, hybridScore, classical, quantum, backend, cacheSize: cacheSize() },
    "aarte/session-score",
  );

  res.json({
    ok:       true,
    decision,
    hybridScore,
    ttlSec:   60,
    message:  decision === "AUTHORIZED"
                ? "Behavioral score accepted — access granted."
                : decision === "REVIEW"
                  ? "Behavioral anomaly detected — Face ID re-prompt will be issued."
                  : "Behavioral authentication failed — access will be blocked.",
  });
});

// ── DELETE /api/aarte/session-score ──────────────────────────────────────────
// Invalidate the behavioral score for the current session (e.g. on logout).
router.delete("/aarte/session-score", (req: Request, res: Response) => {
  const auth  = (req.headers["authorization"] as string | undefined) ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token) clearScore(token);
  res.json({ ok: true });
});

// ── GET /api/aarte/session-score ─────────────────────────────────────────────
// Return the current cached decision for the caller's session (diagnostics).
router.get("/aarte/session-score", (req: Request, res: Response) => {
  const auth  = (req.headers["authorization"] as string | undefined) ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const entry = token ? getScore(token) : undefined;
  res.json({
    ok:    true,
    entry: entry ?? null,
    cached: !!entry,
  });
});

export default router;
