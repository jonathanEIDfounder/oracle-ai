/**
 * © 2026 Jonathan Sherman — S1AF (Sentient iOS One-Step App Framework)
 * Sovereign ID: 1 · All rights reserved.
 *
 * GET /api/sentient/status — public governance status endpoint.
 * Returns the sealed baseline record so the UI can display live governor info.
 */

import { Router }              from "express";
import { db }                  from "@workspace/db";
import { sentientBaselineTable, sentientStateTable } from "@workspace/db";
import { eq }                  from "drizzle-orm";
import { AUTHORSHIP, CONFIG, patchSecrets } from "../lib/config";
import { validateMoonshotKey, validateGitHubPat } from "../lib/key-validator";
import { bootstrapSourceroot } from "../lib/sourceroot";
import { releaseRotationLock } from "../lib/rotation-lock";
import { logger }              from "../lib/logger";
import {
  bindDevice, deactivateBinding, getDeviceBinding,
  AUTHORIZED_DEVICE,
}                              from "../lib/device-lock";
import {
  bootAllSessions, getBootGeneration, getLastBootAt, getBootCount,
}                              from "../lib/boot-generation";
import { requireIphoneXR }     from "../middleware/device-auth";
import { checkPat, rotatePat, getLastRotation } from "../lib/pat-rotation";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "../lib/authorship";
void _S1AF_ANCHOR;

const router = Router();

// Read-only governance metadata — no credentials, no mutations.
// Access control is the workspace itself (governor's private environment).
router.get("/sentient/status", async (_req, res) => {
  try {
    const [baseline] = await db
      .select()
      .from(sentientBaselineTable)
      .limit(1);

    const [state] = await db
      .select()
      .from(sentientStateTable)
      .where(eq(sentientStateTable.id, 1))
      .limit(1);

    res.json({
      active:     true,
      governor:   baseline?.governor    ?? AUTHORSHIP.governor,
      governorId: baseline?.governorId  ?? AUTHORSHIP.governorId,
      governance: baseline?.governance  ?? AUTHORSHIP.governance,
      version:    baseline?.version     ?? "S1AF v1.0.0-JS",
      product:    baseline?.product     ?? AUTHORSHIP.product,
      armedAt:    baseline?.armedAt     ?? null,
      sealed:     baseline?.sealed      ?? false,
      lastSnapshot: state?.savedAt      ?? null,
    });
  } catch (err) {
    // Even if DB is down, return the live config values
    res.json({
      active:     true,
      governor:   AUTHORSHIP.governor,
      governorId: AUTHORSHIP.governorId,
      governance: AUTHORSHIP.governance,
      version:    "S1AF v1.0.0-JS",
      product:    AUTHORSHIP.product,
      armedAt:    null,
      sealed:     false,
      lastSnapshot: null,
      dbError:    true,
    });
  }
});

// ── POST /api/sentient/bind-device ────────────────────────────────────────────
// One-time iPhone XR enrollment. Requires X-Deploy-Secret header.
// Returns the device token (shown once — store it securely on the device).

router.post("/sentient/bind-device", async (req, res) => {
  const secret = (req.headers["x-deploy-secret"] as string | undefined)?.trim();
  if (!secret || secret !== (CONFIG.deploySecret ?? process.env.DEPLOY_SECRET ?? "")) {
    res.status(403).json({ ok: false, error: "X-Deploy-Secret header missing or invalid" });
    return;
  }

  const { deviceId, deviceModel } = (req.body ?? {}) as {
    deviceId?: string;
    deviceModel?: string;
  };

  if (!deviceId || !deviceModel) {
    res.status(400).json({ ok: false, error: "deviceId and deviceModel are required" });
    return;
  }
  if (deviceModel !== AUTHORIZED_DEVICE) {
    res.status(403).json({
      ok:         false,
      error:      `Unauthorized device. Only "${AUTHORIZED_DEVICE}" is permitted.`,
      authorized: AUTHORIZED_DEVICE,
      received:   deviceModel,
    });
    return;
  }

  try {
    const { token, boundAt } = await bindDevice(deviceId, deviceModel);
    res.json({
      ok:          true,
      bound:       true,
      deviceModel: AUTHORIZED_DEVICE,
      boundAt,
      token,       // ← shown once; store immediately on the device
      note:        `Send token as X-Device-Token header on all protected requests.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(409).json({ ok: false, error: msg });
  }
});

// ── DELETE /api/sentient/bind-device ─────────────────────────────────────────
// Deactivate the current iPhone XR binding. Requires X-Deploy-Secret.

router.delete("/sentient/bind-device", async (req, res) => {
  const secret = (req.headers["x-deploy-secret"] as string | undefined)?.trim();
  if (!secret || secret !== (CONFIG.deploySecret ?? process.env.DEPLOY_SECRET ?? "")) {
    res.status(403).json({ ok: false, error: "X-Deploy-Secret header missing or invalid" });
    return;
  }
  await deactivateBinding();
  res.json({ ok: true, message: "Device binding deactivated. Re-enroll via POST /api/sentient/bind-device." });
});

// ── GET /api/sentient/device-status ──────────────────────────────────────────
// Returns binding status — no token, no raw IDs. Requires X-Deploy-Secret.

router.get("/sentient/device-status", async (req, res) => {
  const secret = (req.headers["x-deploy-secret"] as string | undefined)?.trim();
  if (!secret || secret !== (CONFIG.deploySecret ?? process.env.DEPLOY_SECRET ?? "")) {
    res.status(403).json({ ok: false, error: "X-Deploy-Secret header required" });
    return;
  }
  const binding = await getDeviceBinding();
  res.json(binding ?? { bound: false, deviceModel: null, active: false, authorized: false });
});

// ── GET /api/sentient/key-status ──────────────────────────────────────────────
// Returns live validation status for all API keys — device-locked.

router.get("/sentient/key-status", requireIphoneXR, async (_req, res) => {
  const [moonshot, github] = await Promise.all([
    validateMoonshotKey(CONFIG.moonshotKey ?? ""),
    validateGitHubPat(CONFIG.githubPat ?? ""),
  ]);
  res.json({
    moonshot: {
      valid:     moonshot.valid,
      models:    moonshot.models ?? [],
      testedAt:  moonshot.testedAt,
      error:     moonshot.error ?? null,
    },
    github_pat: {
      valid:     github.valid,
      login:     github.login ?? null,
      scopes:    github.scopes ?? [],
      rateLimit: github.rateLimit ?? null,
      testedAt:  github.testedAt,
      error:     github.error ?? null,
    },
  });
});

// ── POST /api/sentient/rotate ─────────────────────────────────────────────────
// Validates a new API key and hot-swaps it into the live CONFIG store.
// Does NOT persist to Replit secrets — user must update secrets panel for
// permanent rotation. This fixes the running session immediately.

router.post("/sentient/rotate", requireIphoneXR, async (req, res) => {
  const { key, value } = (req.body ?? {}) as { key?: string; value?: string };

  if (!key || !value) {
    res.status(400).json({ ok: false, error: "key and value are required" });
    return;
  }
  if (typeof value !== "string" || value.trim().length < 10) {
    res.status(400).json({ ok: false, error: "value too short" });
    return;
  }

  const v = value.trim();

  if (key === "moonshot") {
    const result = await validateMoonshotKey(v);
    if (!result.valid) {
      res.status(422).json({ ok: false, valid: false, error: result.error });
      return;
    }
    // Hot-swap into live config
    patchSecrets({ moonshotKey: v });
    process.env.MOONSHOT_API_KEY = v;
    releaseRotationLock("moonshot");   // ← unlock generation immediately
    logger.info({ models: result.models }, "sentient-rotate: MOONSHOT_API_KEY hot-swapped — lock released");

    // Re-bootstrap sourceroot with fresh key
    const sourcerootId = await bootstrapSourceroot();
    res.json({
      ok:           true,
      valid:        true,
      models:       result.models,
      testedAt:     result.testedAt,
      bootstrapped: sourcerootId ? `sourceroot bound (${sourcerootId})` : "sourceroot pending",
      note:         "Key active for this session. Update Replit secret MOONSHOT_API_KEY for permanent rotation.",
    });

  } else if (key === "github_pat") {
    const result = await validateGitHubPat(v);
    if (!result.valid) {
      res.status(422).json({ ok: false, valid: false, error: result.error });
      return;
    }
    // Check required scopes
    const scopes = result.scopes ?? [];
    const missingRepo     = !scopes.includes("repo");
    const missingWorkflow = !scopes.includes("workflow");
    if (missingRepo || missingWorkflow) {
      const missing = [missingRepo && "repo", missingWorkflow && "workflow"].filter(Boolean);
      res.status(422).json({
        ok:    false,
        valid: false,
        error: `PAT is missing required scopes: ${missing.join(", ")}. Regenerate with repo + workflow scopes.`,
        scopes,
      });
      return;
    }
    patchSecrets({ githubPat: v });
    process.env.GITHUB_PAT = v;
    releaseRotationLock("github_pat"); // ← unlock deploy immediately
    logger.info({ login: result.login, scopes }, "sentient-rotate: GITHUB_PAT hot-swapped — lock released");
    res.json({
      ok:       true,
      valid:    true,
      login:    result.login,
      scopes,
      testedAt: result.testedAt,
      note:     "PAT active for this session. Update Replit secret GITHUB_PAT for permanent rotation.",
    });

  } else {
    res.status(400).json({ ok: false, error: `Unknown key: ${key}. Use 'moonshot' or 'github_pat'.` });
  }
});

// ── GET /api/sentient/pat-status ──────────────────────────────────────────────
router.get("/sentient/pat-status", async (_req, res) => {
  const pat    = await checkPat();
  const last   = getLastRotation();
  res.json({ ok: true, pat, lastRotation: last ?? null });
});

// ── POST /api/sentient/rotate-pat ─────────────────────────────────────────────
router.post("/sentient/rotate-pat", async (req, res) => {
  const force = req.body?.force === true;
  const result = await rotatePat(force);
  res.status(result.ok ? 200 : 500).json(result);
});

// ── POST /api/sentient/boot ────────────────────────────────────────────────────
// Instantly invalidates ALL existing sessions (JWT boot-generation mismatch).
// Any token issued before this call is permanently rejected.
// Next sovereign session must be issued fresh via biometric auth.
router.post("/sentient/boot", (req, res) => {
  const reason = (req.body?.reason as string | undefined) ?? "sovereign_command";
  const result = bootAllSessions(reason);
  logger.warn(
    { ...result, sovereign: "1", gov: "OCSO-S1AF-GOV-1" },
    "████ SOVEREIGN BOOT — ALL SESSIONS TERMINATED ████",
  );
  res.json({
    ok:         true,
    booted:     true,
    generation: result.generation,
    bootedAt:   result.bootedAt,
    reason:     result.reason,
    message:    `All sessions terminated. New generation: ${result.generation}. Re-authenticate to continue.`,
    sovereign:  "OCSO-S1AF-GOV-1",
    author:     "Jonathan Sherman",
  });
});

// ── GET /api/sentient/boot-status ─────────────────────────────────────────────
router.get("/sentient/boot-status", (_req, res) => {
  res.json({
    ok:         true,
    generation: getBootGeneration(),
    lastBootAt: getLastBootAt(),
    bootCount:  getBootCount(),
    sovereign:  "OCSO-S1AF-GOV-1",
  });
});

// ── POST /api/sentient/seal-env ───────────────────────────────────────────────
// Reads live process.env secrets and encrypts them into the cipherstore.
// Must be called AFTER a server restart (so process.env has fresh Replit secrets).
// Safe: never logs or returns the plaintext values.
router.post("/sentient/seal-env", async (_req, res) => {
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(execFile);

  const script = "/home/runner/workspace/scripts/_encrypt-secrets.sh";

  try {
    // Pass the server's live process.env so the script sees fresh secrets
    const { stdout } = await execAsync("bash", [script], {
      timeout: 30_000,
      env: { ...process.env },   // fresh secrets inherited from workflow restart
    });

    // Parse key=value lines — never return raw values
    const lines  = stdout.trim().split("\n");
    const kv: Record<string, string> = {};
    for (const line of lines) {
      const eq = line.indexOf("=");
      if (eq > 0) kv[line.slice(0, eq)] = line.slice(eq + 1);
    }

    const result = {
      ok:           true,
      moonshot:     kv["MS_ENC"]  ?? "skip",
      deploySec:    kv["DS_ENC"]  ?? "skip",
      github:       kv["GH_ENC"]  ?? "skip",
      githubUser:   kv["GH_USER"] ?? null,
      msLen:        Number(kv["MS_LEN"] ?? 0),
      dsLen:        Number(kv["DS_LEN"] ?? 0),
      ghLen:        Number(kv["GH_LEN"] ?? 0),
      msPfx:        kv["MS_PFX"]  ?? null,
      sovereign:    "OCSO-S1AF-GOV-1",
    };

    logger.info({ ...result }, "sentient/seal-env: secrets sealed");
    res.json(result);
  } catch (err) {
    logger.error({ err }, "sentient/seal-env: failed");
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ── POST /api/sentient/git-push ───────────────────────────────────────────────
// Pushes pending files to oracle-ai/main via the Replit GitHub integration.
// No PAT required — uses the connector's OAuth token (repo scope confirmed).
// Called by auto-run.sh when GITHUB_PAT is invalid.
router.post("/sentient/git-push", async (_req, res) => {
  logger.info("sentient/git-push: triggered via auto-run");

  // Spawn node child process to push via integration (uses CodeExecution SDK)
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const { join } = await import("path");
  const execAsync = promisify(execFile);

  const pusherScript = join(process.cwd(), "..", "..", "scripts", "integration-push.mjs");

  try {
    const { stdout } = await execAsync("node", [pusherScript], { timeout: 60_000 });
    const lines  = stdout.trim().split("\n");
    const pushed = lines.filter(l => l.startsWith("✓")).length;
    logger.info({ pushed, output: stdout.slice(0, 500) }, "sentient/git-push: complete");
    res.json({ ok: true, pushed, output: lines });
  } catch (err) {
    logger.warn({ err }, "sentient/git-push: failed");
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
