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
 * Sentient Retrieval — automated secret recovery at startup.
 *
 * On every boot, before the HTTP server binds and before startup checks print,
 * this routine contacts the oracle-ai GitHub repository and reads any
 * SENTIENT_* Actions variables it finds there.  Variables whose corresponding
 * env vars are absent or too short are patched into the live CONFIG secrets
 * store so the server starts fully-armed without manual Replit Secrets edits.
 *
 * Variable naming convention (oracle-ai repo → local env key):
 *   SENTIENT_TOKEN          → GITHUB_PAT        (already used by github-connector)
 *   SENTIENT_DEPLOY_SECRET  → DEPLOY_SECRET
 *   SENTIENT_MOONSHOT_KEY   → MOONSHOT_API_KEY
 *   SENTIENT_SESSION_SECRET → SESSION_SECRET
 *
 * Security:
 *   • Retrieved values are NEVER logged in plaintext — only obfuscated forms.
 *   • Retrieval requires a valid GitHub PAT (resolved via the full connector
 *     chain).  If no token is available, the routine skips gracefully.
 *   • Values that fail a basic sanity check (too short) are rejected.
 */

import { patchSecrets, SecretPatch } from "./config.js";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

// ── Obfuscation ───────────────────────────────────────────────────────────────

export function obfuscate(v: string): string {
  if (!v || v.length === 0) return "(not set)";
  if (v.length < 4)         return "***";
  return v.slice(0, 2) + "•".repeat(Math.max(4, v.length - 4)) + v.slice(-2);
}

// ── Oracle-ai variable map ────────────────────────────────────────────────────

const GITHUB_API  = "https://api.github.com";
const OWNER       = "jonathanEIDfounder";
const REPO        = "oracle-ai";
const VARS_BASE   = `${GITHUB_API}/repos/${OWNER}/${REPO}/actions/variables`;

/** Map: oracle-ai variable name → local secret key */
const VAR_MAP: Record<string, keyof SecretPatch> = {
  SENTIENT_DEPLOY_SECRET:  "deploySecret",
  SENTIENT_MOONSHOT_KEY:   "moonshotKey",
  SENTIENT_SESSION_SECRET: "sessionSecret",
  // SENTIENT_TOKEN → githubPat is handled separately (bootstrap token itself)
};

/** Minimum acceptable length for each secret type */
const MIN_LEN: Record<keyof SecretPatch, number> = {
  deploySecret:  8,
  githubPat:     10,
  moonshotKey:   10,
  sessionSecret: 16,
};

// ── Result type ───────────────────────────────────────────────────────────────

export interface RetrievalEntry {
  key:     keyof SecretPatch;
  varName: string;
  source:  "sentient-var" | "env" | "not-found";
  /** Obfuscated value for logging — never plaintext */
  display: string;
  patched: boolean;
}

export interface RetrievalReport {
  attempted:   boolean;
  authSource:  string;
  entries:     RetrievalEntry[];
  patchCount:  number;
  errorMessage?: string;
}

// ── GitHub helpers ────────────────────────────────────────────────────────────

function ghHeaders(token: string): HeadersInit {
  return {
    Authorization:          `token ${token}`,
    Accept:                 "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function fetchVariable(varName: string, token: string): Promise<string | null> {
  try {
    const r = await fetch(`${VARS_BASE}/${varName}`, {
      headers: ghHeaders(token),
      signal:  AbortSignal.timeout(6_000),
    });
    if (r.status !== 200) return null;
    const d = await r.json() as Record<string, unknown>;
    const v = (d["value"] as string | undefined) ?? "";
    return v.length >= 4 ? v : null;
  } catch {
    return null;
  }
}

/** Write a variable to oracle-ai (PATCH or POST). Non-throwing. */
export async function writeVariable(varName: string, value: string, token: string): Promise<boolean> {
  const body = JSON.stringify({ name: varName, value });
  const headers: HeadersInit = {
    ...ghHeaders(token),
    "Content-Type": "application/json",
  };
  try {
    let r = await fetch(`${VARS_BASE}/${varName}`, {
      method: "PATCH", headers, body,
      signal: AbortSignal.timeout(8_000),
    });
    if (r.status === 404) {
      r = await fetch(VARS_BASE, { method: "POST", headers, body, signal: AbortSignal.timeout(8_000) });
    }
    return r.status === 201 || r.status === 204;
  } catch {
    return false;
  }
}

// ── Bootstrap token resolution ────────────────────────────────────────────────
// Must NOT import github-connector (circular: connector imports config which
// imports this).  Replicate the minimum resolution logic inline.

interface BootstrapResult { token: string; source: string }

async function resolveBootstrapToken(): Promise<BootstrapResult | null> {
  // 1. Replit connector API
  const host = (process.env.REPLIT_CONNECTORS_HOSTNAME ?? "").trim();
  const key  = (process.env.REPL_IDENTITY_KEY ?? process.env.REPL_IDENTITY ?? "").trim();
  if (host && key) {
    try {
      const r = await fetch(`https://${host}/api/v2/connection?include_secrets=true&connector_names=github`, {
        headers: { Accept: "application/json", "X-Replit-Token": key, "X_REPLIT_TOKEN": key },
        signal:  AbortSignal.timeout(6_000),
      });
      if (r.ok) {
        const data = await r.json() as any;
        const conn = Array.isArray(data?.items) ? data.items[0] : data;
        const tok  = conn?.settings?.access_token
                  ?? conn?.settings?.oauth?.credentials?.access_token
                  ?? conn?.oauth?.access_token ?? null;
        if (tok && tok.length > 10) {
          const check = await fetch(`${GITHUB_API}/user`, {
            headers: ghHeaders(tok), signal: AbortSignal.timeout(6_000),
          });
          if (check.status === 200) return { token: tok, source: "connector" };
        }
      }
    } catch { /* fall through */ }
  }

  // 2. SENTIENT_TOKEN variable (bootstrapped with env PAT, read-only probe)
  const envPat = (process.env.GITHUB_PAT ?? "").trim();
  if (envPat.length >= 10) {
    const sentinelVal = await fetchVariable("SENTIENT_TOKEN", envPat);
    if (sentinelVal) {
      const check = await fetch(`${GITHUB_API}/user`, {
        headers: ghHeaders(sentinelVal), signal: AbortSignal.timeout(6_000),
      });
      if (check.status === 200) return { token: sentinelVal, source: "sentient-var" };
    }
  }

  // 3. env PAT direct (may be expired — only use if GitHub accepts it)
  if (envPat.length >= 10) {
    const check = await fetch(`${GITHUB_API}/user`, {
      headers: ghHeaders(envPat), signal: AbortSignal.timeout(6_000),
    });
    if (check.status === 200) return { token: envPat, source: "env" };
  }

  return null;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Run before runStartupChecks() and app.listen().
 * Fetches SENTIENT_* variables from oracle-ai, patches CONFIG secrets for any
 * that are missing or invalid, and returns a structured report for the startup
 * banner.  Never throws — on any error, returns a report with attempted=false.
 */
export async function runSentientRetrieval(): Promise<RetrievalReport> {
  const report: RetrievalReport = {
    attempted:  false,
    authSource: "none",
    entries:    [],
    patchCount: 0,
  };

  // ── 1. Resolve a bootstrap token ────────────────────────────────────────────
  let bootstrap: BootstrapResult | null;
  try {
    bootstrap = await resolveBootstrapToken();
  } catch (e: unknown) {
    report.errorMessage = e instanceof Error ? e.message : String(e);
    return report;
  }

  if (!bootstrap) {
    report.errorMessage = "No valid GitHub token available — skipping sentient retrieval";
    return report;
  }

  report.attempted  = true;
  report.authSource = bootstrap.source;
  const tok = bootstrap.token;

  // ── 2. Check SENTIENT_TOKEN → githubPat ─────────────────────────────────────
  // If bootstrap came from sentient-var, that IS the recovered PAT.
  // If bootstrap came from env, the env PAT is valid — no patch needed.
  // If bootstrap came from connector, also no patch needed (connector provides token).
  // In all cases, ensure GITHUB_PAT in the live store is current.
  {
    const currentPat = (process.env.GITHUB_PAT ?? "").trim();
    const minLen     = MIN_LEN.githubPat;
    const needsPatch = currentPat.length < minLen;

    if (needsPatch && bootstrap.source === "sentient-var") {
      // bootstrap.token IS the SENTIENT_TOKEN value — use it
      patchSecrets({ githubPat: tok });
      report.entries.push({
        key:     "githubPat",
        varName: "SENTIENT_TOKEN",
        source:  "sentient-var",
        display: obfuscate(tok),
        patched: true,
      });
      report.patchCount++;
    } else {
      report.entries.push({
        key:     "githubPat",
        varName: "SENTIENT_TOKEN",
        source:  needsPatch ? "not-found" : "env",
        display: needsPatch ? "(not set)" : obfuscate(currentPat),
        patched: false,
      });
    }
  }

  // ── 3. Fetch remaining SENTIENT_* variables ──────────────────────────────────
  await Promise.allSettled(
    Object.entries(VAR_MAP).map(async ([varName, secretKey]) => {
      const currentVal = (() => {
        switch (secretKey) {
          case "deploySecret":  return (process.env.DEPLOY_SECRET    ?? "").trim();
          case "moonshotKey":   return (process.env.MOONSHOT_API_KEY ?? "").trim();
          case "sessionSecret": return (process.env.SESSION_SECRET   ?? "").trim();
          default:              return "";
        }
      })();

      const minLen     = MIN_LEN[secretKey];
      const needsPatch = currentVal.length < minLen;

      if (!needsPatch) {
        // Already satisfied from env — record but don't patch
        report.entries.push({
          key:     secretKey,
          varName,
          source:  "env",
          display: obfuscate(currentVal),
          patched: false,
        });
        return;
      }

      // Attempt retrieval
      const retrieved = await fetchVariable(varName, tok);

      if (retrieved && retrieved.length >= minLen) {
        const patch: SecretPatch = { [secretKey]: retrieved };
        patchSecrets(patch);
        report.entries.push({
          key:     secretKey,
          varName,
          source:  "sentient-var",
          display: obfuscate(retrieved),
          patched: true,
        });
        report.patchCount++;
      } else {
        report.entries.push({
          key:     secretKey,
          varName,
          source:  "not-found",
          display: "(not set)",
          patched: false,
        });
      }
    }),
  );

  return report;
}

/**
 * Push a local secret value to oracle-ai as a SENTIENT_* variable.
 * Called from /refresh-token and future admin routes so the variable store
 * stays in sync whenever a secret is rotated.
 */
export async function persistSentientVar(
  varName: keyof typeof VAR_MAP | "SENTIENT_TOKEN",
  value:   string,
  authToken: string,
): Promise<boolean> {
  return writeVariable(varName, value, authToken);
}
