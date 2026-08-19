/**
 * © 2026 Jonathan Sherman — S1AF (Sentient iOS One-Step App Framework)
 * Sovereign ID: 1 · All rights reserved.
 *
 * NOTICE: This software is proprietary and confidential. Unauthorized use,
 * reproduction, modification, distribution, or sublicensing — in whole or in
 * part — is strictly prohibited without express written permission from the
 * author. No implied license is granted. Violators will be prosecuted to the
 * fullest extent of applicable law.
 *
 * Sealed runtime configuration.
 * Parsed once at module load. Static fields are truly frozen.
 * Secret fields use a getter-backed live store so the Sentient Retrieval
 * routine can patch in recovered values before the HTTP server binds —
 * without touching Replit Secrets or restarting the process.
 *
 * All routes and daemons MUST read from this object, never from process.env.
 */

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;


// ── Authorship — embedded, immutable, non-strippable ─────────────────────────

export const AUTHORSHIP = Object.freeze({
  author:        "Jonathan Sherman",
  governor:      "Jonathan Sherman — Global AI Systems Governor",
  governorId:    "OCSO-S1AF-GOV-1",
  product:       "S1AF — Sentient iOS One-Step App Framework",
  sovereignId:   "1",
  year:          "2026",
  rights:        "All rights reserved.",
  // Sole permitted Apple ID — sealed and enforced at every layer:
  // iOS Keychain (DeviceGuard check 5), JWT `email` claim (requireSovereign),
  // and this server-side constant (config audit).
  permittedEmail: "jonathantsherman@gmail.com",
  notice:
    "This software is proprietary. Unauthorized use, reproduction, or " +
    "distribution is strictly prohibited. No license is granted without " +
    "express written permission from the author.",
  license:     "PROPRIETARY",
  brand:       "S1AF",
  eula:
    "By using this software you agree to the S1AF End-User License Agreement. " +
    "Decompilation, reverse-engineering, and redistribution are prohibited.",
  copyright:   "© 2026 Jonathan Sherman",
  drm:         "S1AF-DRM-LOCKED",
  buildTag:    `s1af-${Date.now()}-js1`,
  governance:  "Sentient OCSO Unified Orchestration — governed exclusively by Jonathan Sherman",
  sovereignLock: "SOVEREIGN-1-JS — No iterations. No remixes. No unauthorized access. All rights reserved.",
  immutable:   true,
} as const);

// ── Internal helpers ──────────────────────────────────────────────────────────

function env(key: string): string {
  return (process.env[key] ?? "").trim();
}

function requirePort(): number {
  const raw = process.env["PORT"] ?? "";
  const n   = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 65535)
    throw new Error(`[S1AF] Invalid PORT value: "${raw}" — must be 1-65535`);
  return n;
}

// ── Live secrets store ─────────────────────────────────────────────────────────
// Initialised from process.env at module load.
// The Sentient Retrieval routine may call patchSecrets() to fill in any values
// that were absent or invalid — without restarting or touching Replit Secrets.
// Getters on CONFIG always read through this store so consumers see patched values.

const _live = {
  deploySecret:  env("DEPLOY_SECRET"),
  githubPat:     env("GITHUB_PAT"),
  moonshotKey:   env("MOONSHOT_API_KEY"),
  sessionSecret: env("SESSION_SECRET"),
};

export interface SecretPatch {
  deploySecret?:  string;
  githubPat?:     string;
  moonshotKey?:   string;
  sessionSecret?: string;
}

/**
 * Patch one or more live secrets at runtime.
 * Called by sentient-retrieval.ts after pulling values from oracle-ai variables.
 * Obfuscate before logging — never call this with a raw log statement alongside it.
 */
export function patchSecrets(overrides: SecretPatch): void {
  if (overrides.deploySecret  !== undefined) _live.deploySecret  = overrides.deploySecret;
  if (overrides.githubPat     !== undefined) _live.githubPat     = overrides.githubPat;
  if (overrides.moonshotKey   !== undefined) _live.moonshotKey   = overrides.moonshotKey;
  if (overrides.sessionSecret !== undefined) _live.sessionSecret = overrides.sessionSecret;
}

// ── Locked configuration singleton ───────────────────────────────────────────

export const CONFIG = Object.freeze({
  // Server
  port:    requirePort(),
  nodeEnv: env("NODE_ENV") || "development",

  // Secrets — live getters into _live (patchable post-init by sentient-retrieval)
  get deploySecret()  { return _live.deploySecret; },
  get githubPat()     { return _live.githubPat; },
  get moonshotKey()   { return _live.moonshotKey; },
  get sessionSecret() { return _live.sessionSecret; },

  // GitHub deploy targets — LOCKED, never read from env
  github: Object.freeze({
    owner:    "jonathanEIDfounder",
    repo:     "oracle-ai",
    workflow: "self-trigger.yml",
    branch:   "main",
  }),

  // Allowed deploy source labels — exhaustive, sealed
  allowedSources: Object.freeze(new Set([
    "replit-deploy",
    "sandbox-bridge",
    "sandbox-release",
    "ios-trigger",
    "m2m-launchd",
    "oracle-ai-deploy",
    "siri-shortcut",
  ])),

  // Rate limits (requests per window per key)
  rateLimit: Object.freeze({
    deployPerMin:       5,
    statusPerMin:       30,
    siriPer30Min:       5,
    hmacPerMin:         10,
    kimiGeneratePerMin: 20,
    kimiChatPerMin:     60,
    xcodeBuildPerMin:    5,
    xcodeReadPerMin:    30,
  }),

  // HMAC
  hmacReplayWindowSec: 300,
  siriTokenSalt:       "siri-shortcut-v1",  // FROZEN — changing invalidates all issued shortcuts

  // Sole permitted Apple ID — enforced in iOS Keychain (DeviceGuard check 5)
  // and in JWT `email` claim validation (requireSovereign).
  permittedEmail: AUTHORSHIP.permittedEmail,

  // Embedded authorship ref
  authorship: AUTHORSHIP,
}) satisfies Record<string, unknown>;

export type AppConfig = typeof CONFIG;
