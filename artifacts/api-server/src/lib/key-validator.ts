/**
 * S1AF Key Validator — Tests API credentials against their live endpoints.
 * Used by the Sentient rotation pipeline to confirm a key is valid before
 * hot-swapping it into the live CONFIG store.
 *
 * Governed exclusively by Jonathan Sherman — OCSO-S1AF-GOV-1.
 */

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;


export interface ValidationResult {
  valid:     boolean;
  testedAt:  string;
  error?:    string;
}

export interface MoonshotResult extends ValidationResult {
  models?: string[];   // list of accessible model IDs
}

export interface GitHubResult extends ValidationResult {
  login?:    string;
  scopes?:   string[];
  rateLimit?: number;
}

// ── Moonshot / Kimi ───────────────────────────────────────────────────────────

/**
 * Validate a Moonshot API key by listing available models.
 * Returns valid=true if the key is accepted by the Moonshot API.
 */
export async function validateMoonshotKey(key: string): Promise<MoonshotResult> {
  const now = new Date().toISOString();
  try {
    const res = await fetch("https://api.moonshot.cn/v1/models", {
      headers: {
        Authorization: `Bearer ${key}`,
        "User-Agent":  "S1AF-Rotation/1.0",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { valid: false, testedAt: now, error: `Moonshot ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json()) as { data?: { id?: string }[] };
    const models = (data.data ?? []).map((m) => m.id ?? "").filter(Boolean);
    return { valid: true, testedAt: now, models };
  } catch (err) {
    return { valid: false, testedAt: now, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── GitHub PAT ────────────────────────────────────────────────────────────────

/**
 * Validate a GitHub PAT by calling /user.
 * Returns valid=true if the token is accepted; extracts login and scopes.
 */
export async function validateGitHubPat(pat: string): Promise<GitHubResult> {
  const now = new Date().toISOString();
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept:        "application/vnd.github.v3+json",
        "User-Agent":  "S1AF-Rotation/1.0",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { valid: false, testedAt: now, error: `GitHub ${res.status}: ${body.slice(0, 200)}` };
    }
    const user  = (await res.json()) as { login?: string };
    const scopeHeader = res.headers.get("x-oauth-scopes") ?? "";
    const scopes = scopeHeader.split(",").map((s) => s.trim()).filter(Boolean);
    const rateLimit = parseInt(res.headers.get("x-ratelimit-remaining") ?? "0", 10);
    return { valid: true, testedAt: now, login: user.login, scopes, rateLimit };
  } catch (err) {
    return { valid: false, testedAt: now, error: err instanceof Error ? err.message : String(err) };
  }
}
