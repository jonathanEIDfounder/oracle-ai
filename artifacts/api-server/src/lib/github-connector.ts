/**
 * GitHub token resolution for the Kimi API server.
 *
 * Resolution order (first valid token wins):
 *   1. Replit connector API  — OAuth token with full scopes incl. workflow
 *   2. GITHUB_PAT env var    — fallback
 *
 * The connector token is fetched once and cached for 50 minutes
 * (GitHub OAuth tokens typically last 8 hours).
 */

const CONNECTOR_HOST = process.env.REPLIT_CONNECTORS_HOSTNAME ?? "";
const IDENTITY_KEY   = process.env.REPL_IDENTITY_KEY ?? process.env.REPL_IDENTITY ?? "";

interface TokenCache { token: string; expiresAt: number; source: "connector" | "env" }
let cache: TokenCache | null = null;
const CACHE_TTL_MS = 50 * 60 * 1000; // 50 min

async function resolveViaConnector(): Promise<string | null> {
  if (!CONNECTOR_HOST || !IDENTITY_KEY) return null;
  try {
    const url = `https://${CONNECTOR_HOST}/api/v2/connection?include_secrets=true&connector_names=github`;
    const res  = await fetch(url, {
      headers: {
        Accept:          "application/json",
        "X-Replit-Token": IDENTITY_KEY,
        // oracle-ai uses X_REPLIT_TOKEN (underscore); try both
        "X_REPLIT_TOKEN": IDENTITY_KEY,
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
    return tok && tok.length > 10 ? tok : null;
  } catch {
    return null;
  }
}

/** Returns a valid GitHub token, cached. Throws if none available. */
export async function resolveGitHubToken(): Promise<{ token: string; source: string }> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return { token: cache.token, source: cache.source };
  }

  // 1 — Replit connector
  const connTok = await resolveViaConnector();
  if (connTok) {
    cache = { token: connTok, expiresAt: now + CACHE_TTL_MS, source: "connector" };
    return { token: connTok, source: "connector" };
  }

  // 2 — env var fallback
  const envTok = process.env.GITHUB_PAT ?? "";
  if (envTok.length >= 10) {
    cache = { token: envTok, expiresAt: now + CACHE_TTL_MS, source: "env" };
    return { token: envTok, source: "env" };
  }

  throw new Error("No GitHub token available (connector + GITHUB_PAT both failed)");
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
