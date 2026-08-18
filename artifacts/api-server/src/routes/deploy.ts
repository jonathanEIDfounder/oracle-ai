import { Router, type Request, type Response } from "express";
import { resolveGitHubToken, probeGitHubToken } from "../lib/github-connector";

const router = Router();

const OWNER  = "jonathanEIDfounder";
const REPO   = "oracle-ai";
const WF     = "self-trigger.yml";
const BRANCH = "main";

// ── Auth ─────────────────────────────────────────────────────

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function requireDeployToken(req: Request, res: Response, next: Function) {
  const secret = process.env.DEPLOY_SECRET;
  if (!secret || secret.length < 8) {
    res.status(503).json({ ok: false, error: "Deploy endpoint not configured", field: "DEPLOY_SECRET" });
    return;
  }
  const provided =
    (req.headers["x-deploy-token"] as string | undefined) ??
    (req.headers["authorization"] ?? "").toString().replace(/^Bearer\s+/i, "");
  if (!provided || !safeEqual(provided, secret)) {
    res.status(401).json({ ok: false, error: "Invalid deploy token" });
    return;
  }
  next();
}

function ghHeaders(token: string) {
  return {
    Authorization:       `token ${token}`,
    Accept:              "application/vnd.github+json",
    "Content-Type":      "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// ── GET /deploy/config  (no auth — safe to probe on page load) ──
// Returns which fields are configured vs missing, never values.

router.get("/config", async (_req: Request, res: Response) => {
  const deploySecret = process.env.DEPLOY_SECRET;
  const ghProbe      = await probeGitHubToken();

  const fields: Record<string, { ok: boolean; source?: string; obfuscated?: string }> = {
    DEPLOY_SECRET: {
      ok: !!(deploySecret && deploySecret.length >= 8),
      obfuscated: deploySecret
        ? deploySecret.slice(0, 2) + "•".repeat(Math.max(4, deploySecret.length - 4)) + deploySecret.slice(-2)
        : undefined,
    },
    GITHUB_TOKEN: {
      ok: ghProbe.available,
      source: ghProbe.source,
    },
  };

  const allOk = Object.values(fields).every(f => f.ok);
  res.json({
    ok:     allOk,
    server: "kimi-api",
    fields,
    actionsUrl: `https://github.com/${OWNER}/${REPO}/actions`,
  });
});

// ── GET /deploy/health ──────────────────────────────────────

router.get("/health", async (_req: Request, res: Response) => {
  const ghProbe = await probeGitHubToken();
  const hasSecret = !!(process.env.DEPLOY_SECRET?.length);
  res.json({
    ok:        ghProbe.available && hasSecret,
    server:    "kimi-api",
    github:    ghProbe.available ? "configured" : "missing",
    githubSrc: ghProbe.source,
    secret:    hasSecret ? "configured" : "missing",
    timestamp: new Date().toISOString(),
  });
});

// ── POST /deploy/trigger ────────────────────────────────────

router.post("/trigger", requireDeployToken, async (req: Request, res: Response) => {
  let token: string;
  let tokenSource: string;
  try {
    const resolved = await resolveGitHubToken();
    token = resolved.token;
    tokenSource = resolved.source;
  } catch (err: any) {
    res.status(503).json({ ok: false, error: err.message, field: "GITHUB_TOKEN" });
    return;
  }

  const source = (req.body?.source as string) || "replit-deploy";

  try {
    const ghRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WF}/dispatches`,
      {
        method:  "POST",
        headers: ghHeaders(token),
        body:    JSON.stringify({ ref: BRANCH, inputs: { source } }),
      }
    );

    if (ghRes.status === 204) {
      res.json({
        ok:         true,
        message:    "Workflow dispatched",
        source,
        tokenSource,
        actionsUrl: `https://github.com/${OWNER}/${REPO}/actions`,
        server:     "kimi-api",
      });
      return;
    }

    const body = await ghRes.text();
    res.status(ghRes.status).json({ ok: false, error: body, server: "kimi-api" });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message, server: "kimi-api" });
  }
});

// ── GET /deploy/status ──────────────────────────────────────

router.get("/status", requireDeployToken, async (_req: Request, res: Response) => {
  let token: string;
  try {
    ({ token } = await resolveGitHubToken());
  } catch (err: any) {
    res.status(503).json({ ok: false, error: err.message, field: "GITHUB_TOKEN" });
    return;
  }

  try {
    const ghRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs?per_page=5`,
      { headers: ghHeaders(token) }
    );
    const data  = await ghRes.json() as any;
    const runs  = (data.workflow_runs ?? []).map((r: any) => ({
      id:         r.id,
      name:       r.name,
      status:     r.status,
      conclusion: r.conclusion,
      created_at: r.created_at,
      updated_at: r.updated_at,
      url:        r.html_url,
    }));
    res.json({ ok: true, runs, server: "kimi-api" });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message, server: "kimi-api" });
  }
});

export default router;
