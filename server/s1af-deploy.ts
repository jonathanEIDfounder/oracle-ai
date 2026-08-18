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

// ── POST /api/deploy/setup-workflow ─────────────────────────
// One-time setup: pushes self-trigger.yml to the repo using the
// server's own GITHUB_PERSONAL_ACCESS_TOKEN (which has workflow scope).
// Call this once from Mac while oracle-ai is running locally.
// Replit's connector cannot do this (no workflow OAuth scope).

const WORKFLOW_YAML = `# =============================================================
# self-trigger.yml
# Author: Jonathan Sherman
# Copyright: (c) 2026 Jonathan Sherman. All Rights Reserved.
# Framework: S1AF v1.0.0-JS
# Sovereign ID: 1
# =============================================================

name: S1AF Sandbox Bridge

on:
  workflow_dispatch:
    inputs:
      source:
        description: 'Trigger source'
        required: true
        default: 'sandbox-bridge'
      payload:
        description: 'Optional payload JSON'
        required: false
        default: '{}'

jobs:
  bridge:
    name: Bridge from Sandbox
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: \${{ secrets.GITHUB_TOKEN }}

      - name: Verify AARTE Lock
        run: |
          echo "[S1AF] Jonathan Sherman: Verifying AARTE lock..."
          if ! grep -q "AARTE-LOCK:097162266cf833debbad30cedd5189ac:SOVEREIGN:1" Sources/App/AARTEApp.swift; then
            echo "⚠️  AARTE lock file not present — skipping (may be a non-Swift repo)"
          else
            echo "✅ AARTE lock verified — Sovereign ID: 1"
          fi

      - name: Sync with Sandbox
        run: |
          echo "[S1AF] Bridge activated from \${{ github.event.inputs.source }}"
          echo "Timestamp: \$(date -u +%Y-%m-%dT%H:%M:%SZ)"
          echo "Trigger: \${{ github.event.inputs.source }}"
          echo "Actor: \${{ github.actor }}"

      - name: Tag Release if Needed
        if: github.event.inputs.source == 'sandbox-release'
        run: |
          git config user.name "Jonathan Sherman"
          git config user.email "jonathan@sentient.dev"
          git tag "v\$(date +%Y.%m.%d-%H%M)"
          git push origin --tags

      - name: Notify
        run: |
          echo "✅ S1AF Bridge complete"
          echo "Run URL: \${{ github.server_url }}/\${{ github.repository }}/actions/runs/\${{ github.run_id }}"
`;

router.post("/setup-workflow", requireDeployToken, async (_req: Request, res: Response) => {
  const pat = resolvePAT();
  if (!pat) {
    res.status(503).json({
      error: "GitHub PAT not configured — set GITHUB_PERSONAL_ACCESS_TOKEN on oracle-ai server",
      server: "oracle-ai",
    });
    return;
  }

  const fp      = `.github/workflows/${WF}`;
  const b64     = Buffer.from(WORKFLOW_YAML, "utf8").toString("base64");
  const headers = ghHeaders(pat);

  try {
    // Check if the file already exists (need sha to update)
    const checkRes  = await fetch(`${GH_API}/repos/${OWNER}/${REPO}/contents/${fp}?ref=${BRANCH}`, { headers });
    const checkData = checkRes.ok ? await checkRes.json() as any : null;
    const sha       = checkData?.sha;

    const body: Record<string, string> = {
      message: "[S1AF] setup: add self-trigger workflow — Jonathan Sherman",
      content: b64,
      branch:  BRANCH,
    };
    if (sha) body.sha = sha;

    const putRes = await fetch(`${GH_API}/repos/${OWNER}/${REPO}/contents/${fp}`, {
      method:  "PUT",
      headers,
      body:    JSON.stringify(body),
    });

    if (putRes.status === 200 || putRes.status === 201) {
      const data = await putRes.json() as any;
      res.json({
        ok:        true,
        action:    sha ? "updated" : "created",
        sha:       data.content?.sha,
        path:      fp,
        viewUrl:   `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/${fp}`,
        actionsUrl:`https://github.com/${OWNER}/${REPO}/actions`,
        server:    "oracle-ai",
      });
      return;
    }

    const errText = await putRes.text();
    res.status(putRes.status).json({
      ok: false, error: errText,
      hint: putRes.status === 403
        ? "PAT needs 'workflow' scope — update GITHUB_PERSONAL_ACCESS_TOKEN"
        : undefined,
      server: "oracle-ai",
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message, server: "oracle-ai" });
  }
});

export default router;
