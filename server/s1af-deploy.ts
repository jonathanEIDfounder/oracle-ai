/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ORACLE AI - Q++RS ULTIMATE 5.0
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * S1AF DEPLOY MODULE
 * Sentient iOS One-Step App Framework — Deploy Bridge
 * Author: Jonathan Sherman | Sovereign ID: 1
 * Copyright (c) 2024-2026 Jonathan Sherman. All Rights Reserved.
 * Protected under OWP (Ownership Watermark Protocol)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * Exposes two endpoints on the Oracle AI server so the iOS
 * deploy PWA can trigger and monitor GitHub Actions builds
 * even when the Replit API server is offline.
 *
 * POST /api/deploy/trigger  — dispatch self-trigger.yml
 * GET  /api/deploy/status   — last 5 workflow runs
 *
 * Auth: X-Deploy-Token: <DEPLOY_SECRET>  (constant-time compare)
 */

import { Router, type Request, type Response } from "express";

const router = Router();

const OWNER  = "jonathanEIDfounder";
const REPO   = process.env.GITHUB_REPO?.split("/")[1] || "oracle-ai";
const WF     = "self-trigger.yml";
const BRANCH = "main";
const GH_API = "https://api.github.com";

// ── helpers ──────────────────────────────────────────────────

/** Constant-time comparison — prevents timing oracle on the token. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function ghHeaders(pat: string) {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// ── auth middleware ──────────────────────────────────────────

function requireDeployToken(req: Request, res: Response, next: Function) {
  const secret = process.env.DEPLOY_SECRET;
  if (!secret || secret.length < 8) {
    res.status(503).json({
      error: "S1AF deploy endpoint not configured",
      server: "oracle-ai",
    });
    return;
  }

  const provided =
    (req.headers["x-deploy-token"] as string | undefined) ??
    (req.headers["authorization"] ?? "").toString().replace(/^Bearer\s+/i, "");

  if (!provided || !safeEqual(provided, secret)) {
    res.status(401).json({ error: "Invalid deploy token", server: "oracle-ai" });
    return;
  }

  next();
}

function resolvePAT(): string | null {
  // Oracle AI uses GITHUB_PERSONAL_ACCESS_TOKEN; fall back to GITHUB_PAT
  const t = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || process.env.GITHUB_PAT || "";
  return t.length > 10 ? t : null;
}

// ── POST /api/deploy/trigger ─────────────────────────────────

router.post("/trigger", requireDeployToken, async (req: Request, res: Response) => {
  const pat = resolvePAT();
  if (!pat) {
    res.status(503).json({
      error: "GitHub PAT not configured on oracle-ai server",
      hint: "Set GITHUB_PERSONAL_ACCESS_TOKEN or GITHUB_PAT env var",
      server: "oracle-ai",
    });
    return;
  }

  const source: string = (req.body?.source as string) || "oracle-ai-deploy";

  try {
    const ghRes = await fetch(
      `${GH_API}/repos/${OWNER}/${REPO}/actions/workflows/${WF}/dispatches`,
      {
        method: "POST",
        headers: ghHeaders(pat),
        body: JSON.stringify({ ref: BRANCH, inputs: { source } }),
      }
    );

    if (ghRes.status === 204) {
      res.json({
        ok: true,
        message: "Workflow dispatched via oracle-ai",
        source,
        actionsUrl: `https://github.com/${OWNER}/${REPO}/actions`,
        server: "oracle-ai",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const body = await ghRes.text();
    res.status(ghRes.status).json({
      ok: false,
      error: body,
      server: "oracle-ai",
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message, server: "oracle-ai" });
  }
});

// ── GET /api/deploy/status ───────────────────────────────────

router.get("/status", requireDeployToken, async (_req: Request, res: Response) => {
  const pat = resolvePAT();
  if (!pat) {
    res.status(503).json({
      error: "GitHub PAT not configured on oracle-ai server",
      server: "oracle-ai",
    });
    return;
  }

  try {
    const ghRes = await fetch(
      `${GH_API}/repos/${OWNER}/${REPO}/actions/runs?per_page=5`,
      { headers: ghHeaders(pat) }
    );

    const data = (await ghRes.json()) as any;
    const runs = (data.workflow_runs ?? []).map((r: any) => ({
      id:         r.id,
      name:       r.name,
      status:     r.status,
      conclusion: r.conclusion,
      created_at: r.created_at,
      updated_at: r.updated_at,
      url:        r.html_url,
    }));

    res.json({ ok: true, runs, server: "oracle-ai" });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message, server: "oracle-ai" });
  }
});

// ── GET /api/deploy/health ───────────────────────────────────

router.get("/health", (_req: Request, res: Response) => {
  const hasPAT    = !!resolvePAT();
  const hasSecret = !!(process.env.DEPLOY_SECRET?.length);
  res.json({
    ok:        hasPAT && hasSecret,
    server:    "oracle-ai",
    pat:       hasPAT    ? "configured" : "missing",
    secret:    hasSecret ? "configured" : "missing",
    timestamp: new Date().toISOString(),
  });
});

export default router;
