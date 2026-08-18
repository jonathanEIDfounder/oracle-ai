/**
 * © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1
 * S1AF — Sentient iOS One-Step App Framework · Sovereign ID: 1
 * Author      : Jonathan Sherman (jonathanEIDfounder)
 * Governance  : OCSO-S1AF-GOV-1
 * Copyright   : © 2026 Jonathan Sherman. All rights reserved.
 * License     : PROPRIETARY — No license granted without express written permission.
 * DRM         : S1AF-DRM-LOCKED
 * Notice      : Unauthorized use, reproduction, modification, distribution, or
 *               sublicensing is strictly prohibited. Removal of this authorship
 *               notice violates applicable copyright law.
 */

/**
 * © 2026 Jonathan Sherman — S1AF (Sentient iOS One-Step App Framework)
 * Sovereign ID: 1 · All rights reserved.
 *
 * NOTICE: Proprietary and confidential. No license granted.
 * Unauthorized use, reproduction, or distribution is prohibited.
 *
 * Deploy routes — authenticated GitHub Actions workflow dispatch.
 * All secrets are read from the locked CONFIG singleton; none are
 * hardcoded here. All POST bodies are validated before reaching handlers.
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import { resolveGitHubToken, validateGitHubToken, validateTokenDirect, clearTokenCache, persistSentinelToken } from "../lib/github-connector";
import { requireAuth, safeEqual } from "../lib/hmac-auth";
import { logger } from "../lib/logger";
import { CONFIG } from "../lib/config";
import { validateBody, deployTriggerSchema } from "../lib/validate";
import { registerRateMap, trackDispatch, resolveDispatch } from "../lib/daemons";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "../lib/authorship";
void _S1AF_ANCHOR;
const router = Router();

// Locked deploy targets from sealed config — never read from env directly
const { owner: OWNER, repo: REPO, workflow: WF, branch: BRANCH } = CONFIG.github;

// ── GitHub API helper ─────────────────────────────────────────────────────────

function ghHeaders(token: string) {
  return {
    Authorization:          `token ${token}`,
    Accept:                 "application/vnd.github+json",
    "Content-Type":         "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// ── DEPLOY_SECRET auth ────────────────────────────────────────────────────────
// iOS device authenticates with DEPLOY_SECRET — never needs the raw GitHub PAT.

const ALLOWED_SOURCES = CONFIG.allowedSources;

// ── In-memory rate limiters ───────────────────────────────────────────────────
// Rate limiting runs AFTER authentication so unauthenticated requests
// cannot consume the bucket. Keyed by client IP.
const rateMap = new Map<string, { count: number; resetAt: number }>();
const refreshRateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
registerRateMap("deploy", rateMap);

/** Clear all rate-limit buckets. Exported for test isolation only. */
export function _resetRateLimitForTesting(): void {
  rateMap.clear();
  refreshRateMap.clear();
}

function deployIp(req: Request): string {
  return ((req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown")
    .split(",")[0].trim().slice(0, 40);
}

function isRateLimited(ip: string, limit: number): boolean {
  const now   = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > limit;
}

/**
 * Call after requireAuth. Enforces a per-IP request rate limit.
 * @param limit max requests per RATE_WINDOW_MS
 */
function rateCheck(req: Request, res: Response, limit: number): boolean {
  if (isRateLimited(deployIp(req), limit)) {
    res.status(429).json({ ok: false, error: "Too many requests — wait a minute and try again" });
    return true;
  }
  return false;
}

// ── Siri / Shortcuts helpers ──────────────────────────────────────────────────

/**
 * Derive a stable Siri token from DEPLOY_SECRET.
 * The raw DEPLOY_SECRET never leaves the server; only this derived token is
 * embedded in the downloaded Shortcut file.
 */
function deriveSiriToken(secret: string): string {
  return crypto.createHmac("sha256", secret).update("siri-shortcut-v1").digest("hex").slice(0, 32);
}

/**
 * Build an XML plist representing an iOS Shortcut that:
 * 1. GETs the Siri endpoint (token pre-embedded in URL)
 * 2. Speaks the plain-text response aloud — works from the lock screen.
 */
function buildShortcutPlist(siriUrl: string): string {
  const escaped = siriUrl
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>WFWorkflowClientVersion</key>
  <string>1300.0.1</string>
  <key>WFWorkflowMinimumClientVersion</key>
  <integer>900</integer>
  <key>WFWorkflowMinimumClientVersionString</key>
  <string>900</string>
  <key>WFWorkflowHasOutputFallback</key>
  <false/>
  <key>WFWorkflowIcon</key>
  <dict>
    <key>WFWorkflowIconStartColor</key>
    <integer>946986751</integer>
    <key>WFWorkflowIconGlyphNumber</key>
    <integer>59499</integer>
  </dict>
  <key>WFWorkflowImportQuestions</key>
  <array/>
  <key>WFWorkflowInputContentItemClasses</key>
  <array/>
  <key>WFWorkflowOutputContentItemClasses</key>
  <array/>
  <key>WFWorkflowTypes</key>
  <array>
    <string>WatchKit</string>
    <string>ActionExtension</string>
    <string>NCWidget</string>
  </array>
  <key>WFWorkflowActions</key>
  <array>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.downloadurl</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFHTTPMethod</key>
        <string>GET</string>
        <key>WFURL</key>
        <string>${escaped}</string>
        <key>WFHTTPBodyType</key>
        <string>JSON</string>
        <key>ShowHeaders</key>
        <false/>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.speaktext</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFSpeakTextWait</key>
        <true/>
        <key>WFSpeakTextLanguage</key>
        <string>en-US</string>
        <key>WFSpeakTextRate</key>
        <real>0.5</real>
        <key>WFSpeakTextPitch</key>
        <real>1</real>
      </dict>
    </dict>
  </array>
</dict>
</plist>`;
}

// ── Siri rate limiter (per IP, 5 deploys per 30 min) ─────────────────────────
const siriRateMap = new Map<string, { count: number; resetAt: number }>();
const SIRI_WINDOW_MS = 30 * 60_000;
const SIRI_MAX = 5;
registerRateMap("deploy-siri", siriRateMap);

function isSiriRateLimited(ip: string): boolean {
  const now = Date.now();
  const key = (ip || "unknown").slice(0, 40);
  const entry = siriRateMap.get(key);
  if (!entry || now > entry.resetAt) {
    siriRateMap.set(key, { count: 1, resetAt: now + SIRI_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > SIRI_MAX;
}

// ── GET /deploy/config  (no auth — safe to probe on page load) ────────────────
// Returns which fields are configured vs missing, never values.

router.get("/config", async (_req: Request, res: Response) => {
  const deploySecret = CONFIG.deploySecret;
  const ghCheck   = await validateGitHubToken();

  const ds = deploySecret ?? "";
  const fields: Record<string, { ok: boolean; source?: string; obfuscated?: string; login?: string; scopes?: string[]; error?: string }> = {
    DEPLOY_SECRET: {
      ok: !!(ds && ds.length >= 8),
      obfuscated: ds
        ? ds.slice(0, 2) + "•".repeat(Math.max(4, ds.length - 4)) + ds.slice(-2)
        : undefined,
    },
    GITHUB_TOKEN: {
      ok:     ghCheck.valid,
      source: ghCheck.source,
      login:  ghCheck.login,
      scopes: ghCheck.scopes,
      error:  ghCheck.error,
    },
    SIRI_TOKEN: {
      ok: !!(ds && ds.length >= 8),
      // The siri token is derived — it's safe to tell clients whether it exists.
      obfuscated: ds ? "(derived from DEPLOY_SECRET)" : undefined,
    },
  };

  const allOk = Object.values(fields).every(f => f.ok);
  res.json({
    ok:     allOk,
    server: "kimi-api",
    fields,
    actionsUrl:           `https://github.com/${OWNER}/${REPO}/actions`,
    shortcutDownloadPath: "/api/deploy/shortcut.shortcut",
  });
});

// ── GET /deploy/health ────────────────────────────────────────────────────────

router.get("/health", async (_req: Request, res: Response) => {
  const ghCheck   = await validateGitHubToken();
  const hasSecret = !!(CONFIG.deploySecret?.length);
  res.json({
    ok:        ghCheck.valid && hasSecret,
    server:    "kimi-api",
    github:    ghCheck.valid ? "valid" : "invalid",
    githubSrc: ghCheck.source,
    githubErr: ghCheck.error,
    secret:    hasSecret ? "configured" : "missing",
    timestamp: new Date().toISOString(),
  });
});

// ── GET /deploy/page ──────────────────────────────────────────────────────────
// Serves the iOS deploy page with DEPLOY_SECRET embedded in its JS.
//
// The page is NOT public — supply the secret as a query param:
//   https://{your-replit-domain}/api/deploy/page?token=<DEPLOY_SECRET>
//
// Bookmark that full URL on iPhone — Safari keeps the query param in bookmarks,
// so every subsequent tap loads the authenticated page with zero extra input.
// The secret is never logged; Cache-Control: no-store prevents browser caching.

router.get("/page", (req, res) => {
  const secret = CONFIG.deploySecret;
  if (!secret || secret.length < 8) {
    res.status(503).type("text/plain").send("Deploy not configured — DEPLOY_SECRET missing.");
    return;
  }

  const provided = (req.query["token"] as string | undefined) ?? "";
  if (!provided || !safeEqual(provided, secret)) {
    logger.warn({ ip: req.socket.remoteAddress }, "Deploy page access rejected: invalid token");
    res.status(401).send(
      "<!DOCTYPE html><html><head><title>Unauthorized</title></head><body>" +
      "<h1>401 Unauthorized</h1>" +
      "<p>Open this page with <code>?token=&lt;your DEPLOY_SECRET&gt;</code> to authenticate.</p>" +
      "<p>Bookmark that full URL — Safari keeps the token in the bookmark.</p>" +
      "</body></html>"
    );
    return;
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.send(buildDeployPage(secret));
});

// ── POST /trigger ─────────────────────────────────────────────────────────────
// HMAC preferred; legacy X-Deploy-Token accepted for back-compat with oracle-ai.
// Body:    { source?: string, ref?: string }
// Auth runs first; rate limit (5/min per IP) runs after.

router.post("/trigger", requireAuth({ allowLegacy: true }), validateBody(deployTriggerSchema), (req, res, next) => {
  if (rateCheck(req, res, 5)) return;
  next();
}, async (req: Request, res: Response) => {
  const source: string = (req.body as { source?: string })?.source ?? "replit-deploy";
  if (!ALLOWED_SOURCES.has(source)) {
    res.status(400).json({ ok: false, error: `Invalid source: ${source}` });
    return;
  }

  // Resolve via the canonical chain (connector → env PAT) so this route is
  // consistent with what /api/deploy/config validates and banner health reflects.
  let pat: string;
  try {
    ({ token: pat } = await resolveGitHubToken());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(503).json({ ok: false, error: message, field: "GITHUB_TOKEN" });
    return;
  }

  const dispatchId = `deploy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  trackDispatch(dispatchId, source);

  try {
    const ghRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WF}/dispatches`,
      {
        method: "POST",
        headers: ghHeaders(pat),
        body: JSON.stringify({ ref: BRANCH, inputs: { source } }),
      }
    );

    if (ghRes.status === 204) {
      resolveDispatch(dispatchId);
      logger.info({ source, dispatchId }, "Workflow dispatched successfully");
      res.json({
        ok: true,
        message: `Workflow '${WF}' dispatched on ${OWNER}/${REPO}@${BRANCH}`,
        actionsUrl: `https://github.com/${OWNER}/${REPO}/actions`,
      });
      return;
    }

    const body = await ghRes.text();
    logger.error({ status: ghRes.status, body, dispatchId }, "GitHub dispatch failed");
    res.status(502).json({ ok: false, error: `GitHub dispatch failed (HTTP ${ghRes.status})`, detail: body });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ message, dispatchId }, "Unexpected error dispatching workflow");
    res.status(500).json({ ok: false, error: message });
  }
});

// ── GET /status ───────────────────────────────────────────────────────────────
// Returns the latest self-trigger.yml runs from oracle-ai.
// HMAC preferred; legacy X-Deploy-Token accepted for back-compat.
// Rate limit (30/min per IP) — generous enough for 6 s polling.

router.get("/status", requireAuth({ allowLegacy: true }), (req, res, next) => {
  if (rateCheck(req, res, 30)) return;
  next();
}, async (_req: Request, res: Response) => {
  // Resolve via the canonical chain (connector → env PAT) so this route is
  // consistent with what /api/deploy/config validates and banner health reflects.
  let token: string;
  try {
    ({ token } = await resolveGitHubToken());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(503).json({ ok: false, error: message, field: "GITHUB_TOKEN" });
    return;
  }

  try {
    // Scope to the specific workflow file so unrelated runs don't appear as deploy status.
    const ghRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WF}/runs?per_page=5`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    const data = await ghRes.json() as { workflow_runs?: unknown[] };
    const runs = ((data.workflow_runs ?? []) as Record<string, unknown>[]).map((r) => ({
      id:         r["id"],
      name:       r["name"],
      status:     r["status"],
      conclusion: r["conclusion"],
      created_at: r["created_at"],
      updated_at: r["updated_at"],
      url:        r["html_url"],
    }));

    res.json({ ok: true, runs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: message });
  }
});

// ── POST /refresh-token ───────────────────────────────────────────────────────
// Allows in-app token rotation without visiting the Replit dashboard.
// Auth: X-Deploy-Token: <DEPLOY_SECRET>
// Body: { token: string }  — the new GitHub PAT to adopt

const refreshTokenSchema = {
  safeParse(body: unknown): { success: true; data: { token: string } } | { success: false } {
    if (typeof body !== "object" || body === null) return { success: false };
    const token = (body as Record<string, unknown>)["token"];
    if (typeof token !== "string" || token.trim().length < 10) return { success: false };
    return { success: true, data: { token: token.trim() } };
  },
};

registerRateMap("deploy-refresh", refreshRateMap);

function isRefreshRateLimited(ip: string): boolean {
  const now  = Date.now();
  const key  = (ip || "unknown").slice(0, 40);
  const entry = refreshRateMap.get(key);
  if (!entry || now > entry.resetAt) {
    refreshRateMap.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 5; // 5 refresh attempts per minute
}

router.post("/refresh-token", requireAuth({ allowLegacy: true }), async (req: Request, res: Response) => {
  if (isRefreshRateLimited(deployIp(req))) {
    res.status(429).json({ ok: false, error: "Too many refresh attempts — wait a minute" });
    return;
  }

  const parsed = refreshTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Body must be { token: string } with a non-empty PAT (≥10 chars)" });
    return;
  }

  const { token: newPat } = parsed.data;

  const looksLikePat = /^(ghp_|gho_|ghs_|ghu_|github_pat_)[A-Za-z0-9_]{6,}/.test(newPat);
  if (!looksLikePat) {
    res.status(400).json({ ok: false, error: "Token does not look like a GitHub PAT (expected ghp_, gho_, etc.)" });
    return;
  }

  // Snapshot the current runtime env value so we can revert on failure.
  // Use process.env directly — not CONFIG.githubPat which is frozen at startup.
  const prevRuntimePat = process.env["GITHUB_PAT"] ?? "";

  // Validate directly against GitHub (bypasses connector chain entirely)
  const validation = await validateTokenDirect(newPat);
  if (!validation.valid) {
    logger.warn({ error: validation.error }, "refresh-token: new PAT failed GitHub validation — reverted to prior runtime value");
    res.status(422).json({ ok: false, error: `New token rejected by GitHub: ${validation.error}` });
    return;
  }

  const hasWorkflow = validation.scopes?.includes("workflow") ?? false;
  if (!hasWorkflow) {
    res.status(422).json({
      ok: false,
      error: `Token is valid but missing 'workflow' scope (has: ${(validation.scopes ?? []).join(", ") || "none"}). Generate a new token with repo + workflow scopes.`,
    });
    return;
  }

  // Adopt the new token at runtime
  process.env["GITHUB_PAT"] = newPat;
  clearTokenCache();
  logger.info({ login: validation.login, scopes: validation.scopes }, "refresh-token: GitHub PAT updated in memory");

  // Re-validate through the full resolution chain to confirm the switch is visible
  const recheck = await validateTokenDirect(process.env["GITHUB_PAT"] ?? "");
  if (!recheck.valid) {
    process.env["GITHUB_PAT"] = prevRuntimePat;
    clearTokenCache();
    logger.warn({ error: recheck.error }, "refresh-token: recheck failed — reverted to prior runtime value");
    res.status(500).json({ ok: false, error: "Token update failed internal recheck — reverted" });
    return;
  }

  // Persist to SENTIENT_TOKEN GitHub Actions variable so restarts auto-heal.
  // Fire-and-forget — never block the response on this.
  persistSentinelToken(newPat).then(() =>
    logger.info({ login: validation.login }, "refresh-token: SENTIENT_TOKEN variable updated in oracle-ai")
  ).catch(() => {
    // Already logged inside persistSentinelToken — nothing more to do here.
  });

  res.json({
    ok: true,
    login: validation.login,
    scopes: validation.scopes,
    message: "GitHub PAT updated in memory and persisted to SENTIENT_TOKEN in oracle-ai. Survives server restarts.",
  });
});

// ── GET /deploy/siri  (Siri Shortcut endpoint — plain-text response) ─────────
// Auth: ?t=<derived-siri-token>   (rate-limited, 5 per 30 min per IP)
// The siri token is HMAC-SHA256(DEPLOY_SECRET, "siri-shortcut-v1").slice(0,32).
// The raw DEPLOY_SECRET never leaves the server.
// Response is plain text so the "Speak Text" Shortcuts action can read it aloud.

router.get("/siri", async (req: Request, res: Response) => {
  const secret = CONFIG.deploySecret;
  if (!secret || secret.length < 8) {
    res.status(503).type("text/plain").send("Deploy not configured. D E P L O Y underscore S E C R E T is missing.");
    return;
  }

  const provided = (req.query["t"] as string | undefined) ?? "";
  const expected = deriveSiriToken(secret);
  if (!provided || !safeEqual(provided, expected)) {
    logger.warn({ ip: req.socket.remoteAddress }, "Siri deploy rejected: invalid token");
    res.status(401).type("text/plain").send("Unauthorized. Siri token is invalid. Re-download the shortcut.");
    return;
  }

  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim()
    ?? req.socket.remoteAddress
    ?? "unknown";

  if (isSiriRateLimited(ip)) {
    logger.warn({ ip }, "Siri deploy rate-limited");
    res.status(429).type("text/plain").send("Too many deploys. Wait 30 minutes and try again.");
    return;
  }

  // Resolve via the canonical chain (connector → env PAT) so this route is
  // consistent with what /api/deploy/config validates and banner health reflects.
  let pat: string;
  try {
    ({ token: pat } = await resolveGitHubToken());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ message }, "Siri deploy: no GitHub token available");
    res.status(503).type("text/plain").send("Deploy failed. GitHub token is expired. Use the Kimi app to update it.");
    return;
  }

  try {
    const ghRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WF}/dispatches`,
      {
        method: "POST",
        headers: ghHeaders(pat),
        body: JSON.stringify({ ref: BRANCH, inputs: { source: "siri-shortcut" } }),
      }
    );

    if (ghRes.status === 204) {
      logger.info({ ip }, "Siri deploy triggered");
      res.type("text/plain").send(
        `Deploy triggered. Your Kimi app is building in Xcode Cloud. ` +
        `Check github.com slash ${OWNER} slash ${REPO} slash actions for progress.`
      );
      return;
    }

    const errBody = await ghRes.text();
    logger.error({ status: ghRes.status, errBody }, "Siri deploy: GitHub dispatch failed");

    if (ghRes.status === 401 || ghRes.status === 403) {
      res.status(502).type("text/plain").send("Deploy failed. GitHub token is expired or missing workflow scope. Update it in Replit Secrets.");
    } else if (ghRes.status === 422) {
      res.status(502).type("text/plain").send("Deploy failed. Workflow file not found on GitHub. Run setup-workflow first.");
    } else {
      res.status(502).type("text/plain").send(`Deploy failed. GitHub returned status ${ghRes.status}.`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ message }, "Siri deploy: unexpected error");
    res.status(500).type("text/plain").send(`Deploy failed. Server error: ${message}`);
  }
});

// ── GET /deploy/shortcut.shortcut  (download the pre-built iOS Shortcut) ─────
// Auth: ?token=<DEPLOY_SECRET>  (same pattern as /deploy/page — one-time download)
// The returned .shortcut file embeds the derived siri-token so the user never
// has to type a secret on their iPhone.  Assign any Siri phrase in the app.

router.get("/shortcut.shortcut", (req: Request, res: Response) => {
  const secret = CONFIG.deploySecret;
  if (!secret || secret.length < 8) {
    res.status(503).type("text/plain").send("Deploy not configured — DEPLOY_SECRET missing.");
    return;
  }

  const provided = (req.query["token"] as string | undefined) ?? "";
  if (!provided || !safeEqual(provided, secret)) {
    logger.warn({ ip: req.socket.remoteAddress }, "Shortcut download rejected: invalid token");
    res.status(401).type("text/plain").send(
      "Unauthorized. Supply ?token=<DEPLOY_SECRET> to download the Shortcut."
    );
    return;
  }

  const siriToken  = deriveSiriToken(secret);
  const forwarded  = req.headers["x-forwarded-host"] as string | undefined;
  const host       = forwarded ?? (req.headers["host"] as string | undefined) ?? "localhost";
  const baseUrl    = `https://${host}`;
  const siriUrl    = `${baseUrl}/api/deploy/siri?t=${siriToken}`;
  const plist      = buildShortcutPlist(siriUrl);

  res.setHeader("Content-Type", "application/x-apple-shortcut");
  res.setHeader("Content-Disposition", 'attachment; filename="Deploy-Kimi.shortcut"');
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.send(plist);
});

// ── Served HTML page ──────────────────────────────────────────────────────────

function buildDeployPage(deployToken: string): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="S1AF Deploy" />
  <title>S1AF Deploy</title>
  <style>
    :root {
      --bg:     #0a0e1a; --card:   #111827; --border: #1e2d45;
      --accent: #3b82f6; --green:  #22c55e; --red:    #ef4444;
      --yellow: #f59e0b; --text:   #f1f5f9; --muted:  #64748b;
      --mono:   'SF Mono', ui-monospace, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body {
      background: var(--bg); color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
      min-height: 100dvh;
      padding: env(safe-area-inset-top,20px) env(safe-area-inset-right,16px)
               env(safe-area-inset-bottom,20px) env(safe-area-inset-left,16px);
      display: flex; flex-direction: column; gap: 14px;
    }
    header { padding-top: 12px; text-align: center; }
    header .logo { font-size: 11px; letter-spacing: .15em; text-transform: uppercase; color: var(--accent); font-family: var(--mono); margin-bottom: 6px; }
    header h1 { font-size: 26px; font-weight: 700; }
    header p  { font-size: 13px; color: var(--muted); margin-top: 4px; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 16px; }
    label { display: block; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
    select {
      width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: 10px;
      color: var(--text); font-size: 14px; font-family: var(--mono);
      padding: 11px 13px; outline: none; -webkit-appearance: none;
    }
    select:focus { border-color: var(--accent); }
    .deploy-btn {
      width: 100%; background: var(--accent); color: #fff; font-size: 18px; font-weight: 700;
      border: none; border-radius: 16px; padding: 18px; cursor: pointer;
      transition: opacity .15s; letter-spacing: .02em;
    }
    .deploy-btn:active { opacity: .75; }
    .deploy-btn:disabled { opacity: .4; cursor: default; }
    .deploy-btn.success { background: var(--green); }
    .deploy-btn.failure { background: var(--red); }
    #log {
      font-family: var(--mono); font-size: 12px; line-height: 1.7;
      color: var(--muted); background: var(--bg); border: 1px solid var(--border);
      border-radius: 10px; padding: 12px; min-height: 80px; max-height: 240px;
      overflow-y: auto; white-space: pre-wrap;
    }
    .log-ok { color: var(--green); } .log-err { color: var(--red); }
    .log-info { color: var(--accent); } .log-warn { color: var(--yellow); }
    .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--muted); margin-right: 6px; vertical-align: middle; }
    .status-dot.ok  { background: var(--green); box-shadow: 0 0 6px var(--green); }
    .status-dot.err { background: var(--red);   box-shadow: 0 0 6px var(--red); }
    .status-dot.spin { background: var(--accent); animation: pulse 1s infinite; }
    @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.3} }
    .row { display: flex; align-items: center; gap: 8px; }
    .run-card {
      background: var(--bg); border: 1px solid var(--border); border-radius: 10px;
      padding: 10px 12px; margin-top: 8px;
      display: flex; justify-content: space-between; align-items: center; gap: 8px;
    }
    .run-name  { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .run-badge { font-size: 11px; font-family: var(--mono); padding: 3px 8px; border-radius: 6px; flex-shrink: 0; }
    .badge-queued      { background:#1e2d45; color:var(--muted); }
    .badge-in_progress { background:#1e3a5f; color:var(--accent); }
    .badge-success     { background:#14532d; color:var(--green); }
    .badge-failure     { background:#450a0a; color:var(--red); }
    .badge-cancelled   { background:#2a1a00; color:var(--yellow); }
    .badge-green { display:inline-flex;align-items:center;gap:6px;background:color-mix(in srgb,var(--green) 12%,transparent);border:1px solid color-mix(in srgb,var(--green) 30%,transparent);border-radius:8px;padding:6px 12px;font-size:12px;color:var(--green);font-family:var(--mono); }
    footer { text-align:center; font-size:11px; color:var(--border); padding-bottom:8px; }
    .link { color:var(--accent); text-decoration:none; }
    .small-btn { font-size:12px; color:var(--muted); background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:5px 10px; cursor:pointer; margin-top:8px; }
    .small-btn:active { opacity:.6; }
  </style>
</head>
<body>
  <header>
    <div class="logo">S1AF v2.0.0 · Jonathan Sherman</div>
    <h1>Replit Deploy</h1>
    <p>oracle-ai · GitHub Actions · iOS</p>
  </header>

  <div class="card" style="display:flex;align-items:center;gap:12px;">
    <span class="badge-green">🔐 Token-free</span>
    <span style="font-size:13px;color:var(--muted);">PAT is stored in Replit — your device never sees it.</span>
  </div>

  <div class="card">
    <label>Workflow Source Label</label>
    <select id="source">
      <option value="replit-deploy">replit-deploy</option>
      <option value="ios-trigger">ios-trigger</option>
      <option value="oracle-ai-deploy">oracle-ai-deploy</option>
      <option value="m2m-launchd">m2m-launchd</option>
      <option value="sandbox-release">sandbox-release (tags release)</option>
      <option value="sandbox-bridge">sandbox-bridge</option>
    </select>
  </div>

  <button class="deploy-btn" id="deployBtn" onclick="deploy()">🚀 Deploy Now</button>

  <div class="card" style="padding:12px;">
    <div class="row" style="margin-bottom:8px;">
      <span class="status-dot" id="dot"></span>
      <span id="statusText" style="font-size:12px;">Ready</span>
      <button class="small-btn" style="margin:0 0 0 auto;" onclick="pollStatus()">↻ Refresh</button>
    </div>
    <div id="log">Tap Deploy to trigger the S1AF Sandbox Bridge workflow.</div>
    <div id="runs"></div>
  </div>

  <footer>
    (c) 2026 Jonathan Sherman · S1AF · Sovereign ID: 1<br/>
    <a class="link" href="https://github.com/jonathanEIDfounder/oracle-ai/actions" target="_blank">View Actions →</a>
  </footer>

  <script>
    const DEPLOY_TOKEN = ${JSON.stringify(deployToken)};
    const API_BASE = "/api";

    const logEl = document.getElementById("log");
    const dot = document.getElementById("dot");
    const statusText = document.getElementById("statusText");
    const runsEl = document.getElementById("runs");

    function clearLog() { logEl.textContent = ""; }
    function logLine(msg, cls) {
      const span = document.createElement("span");
      if (cls) span.className = "log-" + cls;
      span.textContent = msg + "\\n";
      logEl.appendChild(span);
      logEl.scrollTop = logEl.scrollHeight;
    }
    function setStatus(state, text) {
      dot.className = "status-dot " + (state || "");
      statusText.textContent = text;
    }

    let pollTimer = null;
    function badgeClass(r) {
      if (r.status === "completed") return "badge-" + (r.conclusion || "cancelled");
      if (r.status === "in_progress") return "badge-in_progress";
      return "badge-queued";
    }
    function badgeLabel(r) { return r.status === "completed" ? (r.conclusion || "done") : r.status; }

    async function pollStatus() {
      try {
        const res = await fetch(API_BASE + "/deploy/status", { headers: { "x-deploy-token": DEPLOY_TOKEN } });
        const data = await res.json();
        if (!data.ok || !data.runs?.length) { runsEl.innerHTML = ""; return; }
        runsEl.innerHTML = data.runs.slice(0, 3).map(r => \`
          <div class="run-card">
            <div class="run-name">
              <a class="link" href="\${r.url}" target="_blank">\${r.name}</a>
              <span style="font-size:11px;color:var(--muted);display:block;">\${(r.created_at||"").slice(0,16).replace("T"," ")}</span>
            </div>
            <span class="run-badge \${badgeClass(r)}">\${badgeLabel(r)}</span>
          </div>\`).join("");
        const allDone = data.runs.every(r => r.status === "completed");
        if (allDone && pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      } catch { /* offline — silently skip */ }
    }

    function startPolling() {
      if (pollTimer) clearInterval(pollTimer);
      pollStatus();
      pollTimer = setInterval(pollStatus, 6000);
    }

    async function deploy() {
      const source = document.getElementById("source").value;
      const btn = document.getElementById("deployBtn");
      btn.disabled = true; btn.textContent = "⏳ Deploying…"; btn.className = "deploy-btn";
      clearLog(); runsEl.innerHTML = ""; setStatus("spin", "Connecting…");
      try {
        logLine("[1/2] Sending dispatch request to Replit server…", "info");
        const res = await fetch(API_BASE + "/deploy/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-deploy-token": DEPLOY_TOKEN },
          body: JSON.stringify({ source }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Server error (HTTP " + res.status + ")");
        logLine("      ✅  " + data.message, "ok");
        logLine("[2/2] Opening Actions tab…", "info");
        const url = data.actionsUrl ?? "https://github.com/jonathanEIDfounder/oracle-ai/actions";
        setTimeout(() => window.open(url, "_blank"), 800);
        logLine("      ✅  " + url, "ok");
        setStatus("ok", "Deploy triggered — polling status…");
        btn.textContent = "✅ Deployed"; btn.className = "deploy-btn success";
        startPolling();
      } catch (err) {
        logLine("❌  " + (err.message || String(err)), "err");
        setStatus("err", "Failed");
        btn.textContent = "❌ Failed — Tap to retry"; btn.className = "deploy-btn failure"; btn.disabled = false;
        return;
      }
      setTimeout(() => { btn.disabled = false; btn.textContent = "🚀 Deploy Now"; btn.className = "deploy-btn"; setStatus("", "Ready"); }, 8000);
    }

    pollStatus();
  </script>
</body>
</html>`;
}

export default router;
