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

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;


/**
 * GitHub token resolution for the Kimi API server.
 *
 * Resolution order (first valid token wins):
 *   1. Replit connector API   — OAuth token (full scopes incl. workflow)
 *   2. SENTIENT_TOKEN variable — GitHub Actions variable in oracle-ai repo
 *                               Readable via API (not a secret). Written back
 *                               on every successful /refresh-token rotation so
 *                               the token survives server restarts automatically.
 *   3. GITHUB_PAT env var     — static fallback
 *
 * Connector + variable tokens are cached for 50 minutes.
 */

// Read lazily so tests can inject env vars after module load.
function getConnectorHost(): string { return process.env.REPLIT_CONNECTORS_HOSTNAME ?? ""; }
function getIdentityKey(): string { return process.env.REPL_IDENTITY_KEY ?? process.env.REPL_IDENTITY ?? ""; }

interface TokenCache { token: string; expiresAt: number; source: "connector" | "env" }
let cache: TokenCache | null = null;
const CACHE_TTL_MS = 50 * 60 * 1000; // 50 min

async function resolveViaConnector(): Promise<string | null> {
  const host = getConnectorHost();
  const key  = getIdentityKey();
  if (!host || !key) return null;
  try {
    const url = `https://${host}/api/v2/connection?include_secrets=true&connector_names=github`;
    const res  = await fetch(url, {
      headers: {
        Accept:          "application/json",
        "X-Replit-Token": key,
        // oracle-ai uses X_REPLIT_TOKEN (underscore); try both
        "X_REPLIT_TOKEN": key,
      },
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const conn = Array.isArray(data?.items) ? data.items[0] : data;
    const tok  =
      conn?.settings?.access_token ??
      conn?.settings?.oauth?.credentials?.access_token ??
      conn?.oauth?.access_token ??
      null;
    if (!tok || tok.length <= 10) return null;

    // Live-validate the connector token before caching it.
    // If the connector's OAuth token is expired or revoked, fall through to
    // the GITHUB_PAT env fallback rather than caching a broken token.
    const check = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${tok}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(6000),
    });
    return check.status === 200 ? tok : null;
  } catch {
    return null;
  }
}

// ── SENTIENT_TOKEN — GitHub Actions variable pull/push ────────────────────────
// GitHub Actions *variables* (not secrets) are readable via API with repo scope.
// The oracle-ai repo stores the current valid PAT as variable SENTIENT_TOKEN.
// The server reads it as resolution step 2 and writes it back on every refresh,
// so any restart picks up the latest token without touching Replit Secrets.

const SENTINEL_VAR   = "SENTIENT_TOKEN";
const SENTINEL_OWNER = "jonathanEIDfounder";
const SENTINEL_REPO  = "oracle-ai";
const SENTINEL_VAR_URL =
  `https://api.github.com/repos/${SENTINEL_OWNER}/${SENTINEL_REPO}/actions/variables/${SENTINEL_VAR}`;

/** Attempt to fetch and validate the SENTIENT_TOKEN Actions variable. */
async function resolveViaSentinelVar(bootstrapToken: string): Promise<string | null> {
  if (!bootstrapToken || bootstrapToken.length < 10) return null;
  try {
    const r = await fetch(SENTINEL_VAR_URL, {
      headers: {
        Authorization:          `token ${bootstrapToken}`,
        Accept:                 "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (r.status !== 200) return null;
    const data = await r.json() as Record<string, unknown>;
    const tok  = (data["value"] as string | undefined) ?? "";
    if (tok.length < 10) return null;
    // Live-validate before caching — only adopt if GitHub accepts it
    const check = await fetch("https://api.github.com/user", {
      headers: {
        Authorization:          `token ${tok}`,
        Accept:                 "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(6000),
    });
    return check.status === 200 ? tok : null;
  } catch {
    return null;
  }
}

/**
 * Write a validated PAT back to the SENTIENT_TOKEN Actions variable so it
 * persists across server restarts. Uses the new token itself to authenticate
 * (it was just validated, so it has at least repo scope).
 * Non-throwing — log failure but never break the refresh flow.
 */
export async function persistSentinelToken(newToken: string): Promise<void> {
  try {
    // Try PATCH first (update existing variable); fall back to POST (create)
    const body = JSON.stringify({ name: SENTINEL_VAR, value: newToken });
    let r = await fetch(SENTINEL_VAR_URL, {
      method: "PATCH",
      headers: {
        Authorization:          `token ${newToken}`,
        Accept:                 "application/vnd.github+json",
        "Content-Type":         "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 404) {
      // Variable doesn't exist yet — create it
      r = await fetch(
        `https://api.github.com/repos/${SENTINEL_OWNER}/${SENTINEL_REPO}/actions/variables`,
        {
          method: "POST",
          headers: {
            Authorization:          `token ${newToken}`,
            Accept:                 "application/vnd.github+json",
            "Content-Type":         "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          body,
          signal: AbortSignal.timeout(8000),
        }
      );
    }
    // 201 = created, 204 = updated — both are success
    if (r.status !== 201 && r.status !== 204) {
      const t = await r.text().catch(() => "");
      throw new Error(`GitHub ${r.status}: ${t.slice(0, 80)}`);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // Import logger lazily to avoid circular dep
    console.warn(`[github-connector] persistSentinelToken failed: ${msg}`);
  }
}

/** Returns a valid GitHub token, cached. Throws if none available. */
export async function resolveGitHubToken(): Promise<{ token: string; source: string }> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return { token: cache.token, source: cache.source };
  }

  // 1 — Replit connector (live-validated inside resolveViaConnector)
  const connTok = await resolveViaConnector();
  if (connTok) {
    cache = { token: connTok, expiresAt: now + CACHE_TTL_MS, source: "connector" };
    return { token: connTok, source: "connector" };
  }

  // 2 — SENTIENT_TOKEN GitHub Actions variable (bootstrapped via env PAT read-only probe)
  const bootstrap = process.env.GITHUB_PAT ?? "";
  const sentTok   = await resolveViaSentinelVar(bootstrap);
  if (sentTok) {
    cache = { token: sentTok, expiresAt: now + CACHE_TTL_MS, source: "sentient-var" };
    return { token: sentTok, source: "sentient-var" };
  }

  // 3 — GITHUB_PAT env var (static fallback, no validation)
  if (bootstrap.length >= 10) {
    cache = { token: bootstrap, expiresAt: now + CACHE_TTL_MS, source: "env" };
    return { token: bootstrap, source: "env" };
  }

  throw new Error(
    "No GitHub token available — connector, SENTIENT_TOKEN variable, and GITHUB_PAT all failed"
  );
}

/** Clear the in-memory token cache (call after updating GITHUB_PAT at runtime). */
export function clearTokenCache(): void {
  cache = null;
}

/** Non-throwing probe — returns null if no token can be resolved. */
export async function probeGitHubToken(): Promise<{ available: boolean; source?: string }> {
  try {
    const { source } = await resolveGitHubToken();
    return { available: true, source };
  } catch {
    return { available: false };
  }
}

/**
 * Validate a specific token directly against GitHub /user.
 * Never touches the cache or the connector resolution chain — use this when
 * you need to verify a caller-supplied token without letting a healthy connector
 * mask an invalid submitted value.
 */
export async function validateTokenDirect(token: string): Promise<{
  valid: boolean;
  login?: string;
  scopes?: string[];
  error?: string;
}> {
  try {
    const r = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 200) {
      const d    = await r.json() as any;
      const scopeHeader = r.headers.get("x-oauth-scopes") ?? "";
      const scopes = scopeHeader ? scopeHeader.split(",").map(s => s.trim()).filter(Boolean) : [];
      return { valid: true, login: d.login, scopes };
    }
    const body = await r.text().catch(() => "");
    return { valid: false, error: `GitHub ${r.status}: ${body.slice(0, 80)}` };
  } catch (e: any) {
    return { valid: false, error: e.message };
  }
}

/** Live-validate: resolves token then hits /user to confirm GitHub accepts it. */
export async function validateGitHubToken(): Promise<{
  valid: boolean;
  source?: string;
  login?: string;
  scopes?: string[];
  error?: string;
}> {
  let token: string, source: string;
  try {
    ({ token, source } = await resolveGitHubToken());
  } catch (e: any) {
    return { valid: false, error: e.message };
  }
  try {
    const r = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 200) {
      const d    = await r.json() as any;
      const scopeHeader = r.headers.get("x-oauth-scopes") ?? "";
      const scopes = scopeHeader ? scopeHeader.split(",").map(s => s.trim()).filter(Boolean) : [];
      return { valid: true, source, login: d.login, scopes };
    }
    const body = await r.text().catch(() => "");
    // Token resolved but rejected by GitHub — evict cache so next call re-resolves
    cache = null;
    return { valid: false, source, error: `GitHub ${r.status}: ${body.slice(0, 80)}` };
  } catch (e: any) {
    return { valid: false, source, error: e.message };
  }
}
