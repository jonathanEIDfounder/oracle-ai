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

export default router;
