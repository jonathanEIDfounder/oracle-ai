/**
 * © 2026 Jonathan Sherman — S1AF · OCSO-S1AF-GOV-1
 *
 * GitHub OAuth Device Flow — runs inside the persistent API server process.
 * No Shell tab / TTY required. The polling loop lives in Node.js and
 * survives across agent ShellExec session boundaries.
 *
 * Flow:
 *   1. POST /auth/github-device/start  → returns user_code + verification_uri
 *   2. User visits URL, enters code on any browser
 *   3. Server polls GitHub every 5s automatically
 *   4. On approval: encrypts token via cipher script → patchSecrets() → git push
 *   5. GET  /auth/github-device/status → poll result
 */

import { execFile }          from "child_process";
import { promisify }         from "util";
import { join }              from "path";
import { logger }            from "./logger";
import { patchSecrets, CONFIG } from "./config";

const execFileAsync = promisify(execFile);

const GH_CLIENT_ID   = "178c6fc778ccc68e1d6a";  // gh CLI public OAuth app
const DEVICE_CODE_URL = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";

// ── State ──────────────────────────────────────────────────────────────────

export type DeviceFlowState =
  | "idle"
  | "pending"   // waiting for user approval
  | "approved"  // token received + encrypted
  | "expired"
  | "denied"
  | "error";

interface DeviceFlowStatus {
  state:            DeviceFlowState;
  userCode?:        string;
  verificationUri?: string;
  expiresAt?:       string;
  approvedAt?:      string;
  tokenMask?:       string;   // first 6 + "…" — never full value
  error?:           string;
  pollCount:        number;
}

let _status: DeviceFlowStatus = { state: "idle", pollCount: 0 };
let _pollTimer: ReturnType<typeof setInterval> | null = null;

export function getDeviceFlowStatus(): DeviceFlowStatus {
  return { ..._status };
}

// ── Step 1: Request device code ────────────────────────────────────────────

export async function startDeviceFlow(): Promise<DeviceFlowStatus> {
  if (_pollTimer) clearInterval(_pollTimer);

  logger.info("github-device-flow: requesting device code");

  const res = await fetch(DEVICE_CODE_URL, {
    method:  "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body:    `client_id=${GH_CLIENT_ID}&scope=repo%2Cworkflow`,
    signal:  AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    _status = { state: "error", pollCount: 0, error: `GitHub ${res.status}: ${body.slice(0, 200)}` };
    return _status;
  }

  const data = await res.json() as {
    device_code: string;
    user_code:   string;
    verification_uri: string;
    interval:    number;
    expires_in:  number;
  };

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  _status = {
    state:           "pending",
    userCode:        data.user_code,
    verificationUri: data.verification_uri,
    expiresAt,
    pollCount:       0,
  };

  logger.info(
    { userCode: data.user_code, verificationUri: data.verification_uri, expiresAt },
    `github-device-flow: code issued — visit ${data.verification_uri} and enter ${data.user_code}`,
  );

  // Start polling loop inside Node.js — survives ShellExec session end
  const deviceCode = data.device_code;
  const interval   = Math.max(data.interval ?? 5, 5) * 1000;

  _pollTimer = setInterval(() => void pollForToken(deviceCode, expiresAt), interval);
  _pollTimer.unref();

  return _status;
}

// ── Step 2: Poll for token ─────────────────────────────────────────────────

async function pollForToken(deviceCode: string, expiresAt: string): Promise<void> {
  if (_status.state !== "pending") {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
    return;
  }

  if (new Date() > new Date(expiresAt)) {
    _status = { ..._status, state: "expired", error: "Device code expired" };
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
    logger.warn("github-device-flow: code expired");
    return;
  }

  _status.pollCount += 1;

  try {
    const res = await fetch(ACCESS_TOKEN_URL, {
      method:  "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body:    `client_id=${GH_CLIENT_ID}&device_code=${deviceCode}&grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code`,
      signal:  AbortSignal.timeout(10_000),
    });

    const data = await res.json() as { access_token?: string; error?: string };

    if (data.access_token) {
      if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
      await handleToken(data.access_token);
      return;
    }

    if (data.error === "access_denied") {
      _status = { ..._status, state: "denied", error: "User denied access" };
      if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
      logger.warn("github-device-flow: access denied by user");
    }
    // authorization_pending and slow_down → keep polling

  } catch (err) {
    logger.debug({ err }, "github-device-flow: poll error (will retry)");
  }
}

// ── Step 3: Handle approved token ─────────────────────────────────────────

async function handleToken(token: string): Promise<void> {
  logger.info("github-device-flow: token received — encrypting");

  const REPO_ROOT  = join(process.cwd(), "..", "..");
  const CIPHER_SH  = join(REPO_ROOT, "scripts", "pat-cipher.sh");

  // Encrypt into cipherstore
  try {
    await execFileAsync("bash", ["-c",
      `source "${CIPHER_SH}" && s1af_encrypt_named "github-pat" "${token.replace(/"/g, '\\"')}"`
    ], { timeout: 15_000 });
    logger.info("github-device-flow: token encrypted → cipherstore [OBFUSCATED]");
  } catch (err) {
    logger.warn({ err }, "github-device-flow: cipherstore encryption failed — patching CONFIG only");
  }

  // Patch live CONFIG
  patchSecrets({ githubPat: token });
  logger.info("github-device-flow: CONFIG.githubPat patched live");

  // Relock git + push pending commits (non-blocking)
  void gitPushAfterAuth(token, REPO_ROOT);

  _status = {
    ..._status,
    state:      "approved",
    approvedAt: new Date().toISOString(),
    tokenMask:  `${token.slice(0, 6)}…`,
  };
}

// ── Step 4: Push pending commits ──────────────────────────────────────────

async function gitPushAfterAuth(token: string, repoRoot: string): Promise<void> {
  const SETUP_SH = join(repoRoot, "scripts", "setup-git-auth.sh");

  try {
    await execFileAsync("bash", [SETUP_SH], {
      timeout: 30_000,
      env: { ...process.env, GITHUB_PAT: token, GIT_ASKPASS: "" },
    });
  } catch { /* non-fatal */ }

  try {
    const pushUrl = `https://jonathanEIDfounder:${token}@github.com/jonathanEIDfounder/oracle-ai.git`;
    const { stdout } = await execFileAsync("git", [
      "-C", repoRoot, "push", pushUrl, "HEAD:main", "--tags",
    ], { timeout: 60_000 });

    // Restore clean URL
    await execFileAsync("git", [
      "-C", repoRoot, "remote", "set-url", "oracle-ai",
      "https://jonathanEIDfounder@github.com/jonathanEIDfounder/oracle-ai.git",
    ], { timeout: 5_000 });

    logger.info({ output: stdout.slice(0, 200) }, "github-device-flow: commits pushed to oracle-ai/main");
  } catch (err) {
    logger.warn({ err }, "github-device-flow: git push failed (token may lack repo scope)");
  }
}
