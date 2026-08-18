/**
 * © 2026 Jonathan Sherman — S1AF · OCSO-S1AF-GOV-1
 * PAT Rotation Engine — automated fine-grained token lifecycle.
 *
 * Flow:
 *   1. checkPat()          — validate current PAT + detect expiry
 *   2. needsRotation()     — true when invalid or expiring within ROTATE_BEFORE_DAYS
 *   3. rotatePat()         — create new fine-grained PAT via GitHub API
 *   4. commitRotation()    — patch CONFIG + persist to SENTIENT_TOKEN Actions var + relock git
 *
 * Auto-rotation daemon: runs every 6 hours (wired in daemons.ts).
 * Manual trigger:        POST /api/sentient/rotate-pat (sovereign-authenticated).
 */

import { logger }                    from "./logger";
import { CONFIG, patchSecrets }       from "./config";
import { persistSentinelToken }       from "./github-connector";
import { acquireRotationLock, releaseRotationLock } from "./rotation-lock";
import { execFile }           from "child_process";
import { promisify }          from "util";
import { join }               from "path";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

const execFileAsync = promisify(execFile);

// ── Constants ─────────────────────────────────────────────────────────────────
const ROTATE_BEFORE_DAYS = 7;       // rotate when expiry is within this window
const GH_API             = "https://api.github.com";
const OWNER              = "jonathanEIDfounder";
const REPO               = "oracle-ai";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PatStatus {
  valid:      boolean;
  login?:     string;
  scopes?:    string;
  expiresAt?: Date | null;     // null = never expires (classic no-expiry)
  daysLeft?:  number | null;
  needsRotation: boolean;
  reason?:    string;
}

export interface RotationResult {
  ok:          boolean;
  newPatMask?: string;       // first 8 chars + "…" — never the full value
  expiresAt?:  string;
  persisted:   boolean;
  gitRelocked: boolean;
  error?:      string;
}

// ── In-memory last-rotation record ───────────────────────────────────────────
let lastRotation: { at: string; expiresAt: string | null } | null = null;

export function getLastRotation() { return lastRotation; }

// ── Step 1: Check current PAT ─────────────────────────────────────────────────
export async function checkPat(token?: string): Promise<PatStatus> {
  const pat = token ?? CONFIG.githubPat ?? "";

  if (!pat || pat.length < 20) {
    return { valid: false, needsRotation: true, reason: "PAT missing or too short" };
  }

  try {
    const res = await fetch(`${GH_API}/user`, {
      headers: {
        Authorization:          `token ${pat}`,
        Accept:                 "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (res.status === 401) {
      return { valid: false, needsRotation: true, reason: "GitHub rejected token (401)" };
    }
    if (!res.ok) {
      return { valid: false, needsRotation: false, reason: `GitHub API ${res.status}` };
    }

    const user   = await res.json() as Record<string, unknown>;
    const scopes = res.headers.get("x-oauth-scopes") ?? "";

    // Fine-grained PATs don't expose X-OAuth-Scopes; expiry comes from
    // GET /user/personal-access-tokens/{id} — approximate via token format.
    // Classic PATs: check expiry via token-check endpoint.
    let expiresAt: Date | null = null;
    let daysLeft:  number | null = null;

    // Try to fetch expiry from GitHub's token endpoint
    const checkRes = await fetch(`${GH_API}/user/installations`, {
      headers: {
        Authorization:          `token ${pat}`,
        Accept:                 "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(5_000),
    }).catch(() => null);

    // Fine-grained PAT expiry — read from list endpoint
    const tokenListRes = await fetch(`${GH_API}/user/personal-access-tokens?per_page=10`, {
      headers: {
        Authorization:          `token ${pat}`,
        Accept:                 "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(5_000),
    }).catch(() => null);

    if (tokenListRes?.ok) {
      const tokens = await tokenListRes.json() as Array<Record<string, unknown>>;
      // Match by finding the token whose name contains "s1af" or first in list
      const match = tokens.find(t =>
        String(t["name"] ?? "").toLowerCase().includes("s1af")
      ) ?? tokens[0];

      if (match?.["expires_at"]) {
        expiresAt = new Date(match["expires_at"] as string);
        daysLeft  = Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000);
      }
    }

    const needsRotation =
      !expiresAt ? false :                         // no expiry — fine
      daysLeft !== null && daysLeft <= ROTATE_BEFORE_DAYS;

    return {
      valid:   true,
      login:   user["login"] as string,
      scopes,
      expiresAt,
      daysLeft,
      needsRotation,
      reason: needsRotation ? `Expires in ${daysLeft} days` : undefined,
    };
  } catch (e) {
    return { valid: false, needsRotation: true, reason: String(e) };
  }
}

// ── Step 2: Create new fine-grained PAT via GitHub API ───────────────────────
async function createFinegrainedPat(currentPat: string): Promise<string> {
  // Expiry: 90 days from now (GitHub maximum for fine-grained PATs)
  const expiresAt = new Date(Date.now() + 90 * 86_400_000)
    .toISOString()
    .split("T")[0]; // YYYY-MM-DD

  const body = {
    name:        `s1af-sovereign-${Date.now()}`,
    description: "S1AF auto-rotated PAT — OCSO-S1AF-GOV-1 Jonathan Sherman",
    expires_at:  expiresAt,
    owner:       OWNER,
    repositories: [REPO],
    permissions: {
      // Minimum permissions needed for oracle-ai operations
      actions:           "write",   // trigger workflows
      contents:          "write",   // push commits
      metadata:          "read",    // required base permission
      variables:         "write",   // update SENTIENT_TOKEN
      administration:    "write",   // manage repo settings
    },
  };

  const res = await fetch(`${GH_API}/user/personal-access-tokens`, {
    method:  "POST",
    headers: {
      Authorization:          `token ${currentPat}`,
      Accept:                 "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type":         "application/json",
    },
    body:   JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub PAT creation failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json() as Record<string, unknown>;
  const token = data["token"] as string | undefined;
  if (!token || token.length < 20) {
    throw new Error("GitHub returned empty token value — rotation aborted");
  }

  return token;
}

// ── Step 3: Re-lock git credential helper ────────────────────────────────────
async function relockGit(): Promise<boolean> {
  try {
    const setupScript = join(process.cwd(), "scripts", "setup-git-auth.sh");
    await execFileAsync("bash", [setupScript], {
      env: { ...process.env, GITHUB_PAT: CONFIG.githubPat ?? "" },
      timeout: 10_000,
    });
    return true;
  } catch (e) {
    logger.warn({ err: e }, "pat-rotation: git relock failed (non-fatal)");
    return false;
  }
}

// ── Step 4: Full rotation ─────────────────────────────────────────────────────
export async function rotatePat(force = false): Promise<RotationResult> {
  const currentPat = CONFIG.githubPat ?? "";

  try {
    // Validate current token
    const status = await checkPat(currentPat);

    if (!force && !status.needsRotation) {
      return {
        ok:        true,
        persisted: false,
        gitRelocked: false,
        error:     `Rotation skipped — PAT healthy (${status.daysLeft ?? "∞"} days left)`,
      };
    }

    if (!status.valid && !force) {
      // Current token is invalid — can't create new one from it
      throw new Error(
        "Current PAT is invalid — cannot create new PAT. " +
        "Install a valid PAT via POST /api/sentient/rotate first."
      );
    }

    logger.info({ reason: status.reason, force }, "pat-rotation: starting rotation");

    // Create new fine-grained PAT
    const newPat = await createFinegrainedPat(currentPat);
    const newMask = `${newPat.slice(0, 8)}…`;

    // Patch CONFIG live store (immediate, no restart)
    patchSecrets({ githubPat: newPat });
    logger.info({ mask: newMask }, "pat-rotation: CONFIG patched");

    // Persist to SENTIENT_TOKEN GitHub Actions variable
    let persisted = false;
    try {
      await persistSentinelToken(newPat);
      persisted = true;
      logger.info({ mask: newMask }, "pat-rotation: SENTIENT_TOKEN updated");
    } catch (e) {
      logger.warn({ err: e }, "pat-rotation: SENTIENT_TOKEN persist failed (non-fatal)");
    }

    // Release rotation lock if github was locked
    releaseRotationLock("github_pat");

    // Re-lock git credential helper
    const gitRelocked = await relockGit();

    // Record rotation
    const expiresAt = new Date(Date.now() + 90 * 86_400_000).toISOString();
    lastRotation = { at: new Date().toISOString(), expiresAt };

    logger.info({ mask: newMask, persisted, gitRelocked }, "pat-rotation: COMPLETE");

    return { ok: true, newPatMask: newMask, expiresAt, persisted, gitRelocked };

  } catch (e) {
    const error = String(e);
    logger.error({ err: e }, "pat-rotation: FAILED");
    acquireRotationLock("github_pat", "github-invalid");
    return { ok: false, persisted: false, gitRelocked: false, error };
  }
}

// ── Daemon tick: called every 6 hours by daemons.ts ──────────────────────────
export async function patRotationTick(): Promise<void> {
  const status = await checkPat();

  if (!status.valid) {
    logger.warn({ reason: status.reason }, "pat-rotation-processor: PAT invalid — locking");
    acquireRotationLock("github_pat", "github-invalid");
    return;
  }

  if (status.needsRotation) {
    logger.info({ daysLeft: status.daysLeft }, "pat-rotation-processor: rotation window — rotating now");
    const result = await rotatePat();
    logger.info(result, "pat-rotation-processor: result");
    return;
  }

  logger.info(
    { daysLeft: status.daysLeft ?? "∞", login: status.login },
    "pat-rotation-processor: PAT healthy — no action"
  );
}
