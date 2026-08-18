import { Router, type Request, type Response } from "express";

const router = Router();

const OWNER  = "jonathanEIDfounder";
const REPO   = "oracle-ai";
const WF     = "self-trigger.yml";
const BRANCH = "main";

/** Constant-time string comparison to prevent timing attacks. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Middleware: reject any request that doesn't carry the deploy secret. */
function requireDeployToken(req: Request, res: Response, next: Function) {
  const secret = process.env.DEPLOY_SECRET;
  if (!secret || secret.length < 8) {
    // Secret not configured — lock down completely
    res.status(503).json({ error: "Deploy endpoint not configured" });
    return;
  }

  // Accept token from X-Deploy-Token header or Authorization: Bearer <token>
  const header = req.headers["x-deploy-token"] as string | undefined
    ?? (req.headers["authorization"] ?? "").toString().replace(/^Bearer\s+/i, "");

  if (!header || !safeEqual(header, secret)) {
    res.status(401).json({ error: "Invalid deploy token" });
    return;
  }

  next();
}

/**
 * POST /api/deploy/trigger
 * Headers: X-Deploy-Token: <DEPLOY_SECRET>
 * Body:    { source?: string }
 */
router.post("/deploy/trigger", requireDeployToken, async (req: Request, res: Response) => {
  const pat = process.env.GITHUB_PAT;
  if (!pat || pat.length < 20) {
    res.status(503).json({ error: "GITHUB_PAT not configured on server" });
    return;
  }

  const source: string = (req.body?.source as string) || "replit-deploy";

  try {
    const ghRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WF}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `token ${pat}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ ref: BRANCH, inputs: { source } }),
      }
    );

    if (ghRes.status === 204) {
      res.json({
        ok: true,
        message: "Workflow dispatched",
        actionsUrl: `https://github.com/${OWNER}/${REPO}/actions`,
      });
      return;
    }

    const body = await ghRes.text();
    res.status(ghRes.status).json({ ok: false, error: body });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/deploy/status
 * Headers: X-Deploy-Token: <DEPLOY_SECRET>
 */
router.get("/deploy/status", requireDeployToken, async (_req: Request, res: Response) => {
  const pat = process.env.GITHUB_PAT;
  if (!pat || pat.length < 20) {
    res.status(503).json({ error: "GITHUB_PAT not configured on server" });
    return;
  }

  try {
    const ghRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs?per_page=5`,
      {
        headers: {
          Authorization: `token ${pat}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    const data = await ghRes.json() as any;
    const runs = (data.workflow_runs ?? []).map((r: any) => ({
      id:         r.id,
      name:       r.name,
      status:     r.status,
      conclusion: r.conclusion,
      created_at: r.created_at,
      updated_at: r.updated_at,
      url:        r.html_url,
    }));

    res.json({ ok: true, runs });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
