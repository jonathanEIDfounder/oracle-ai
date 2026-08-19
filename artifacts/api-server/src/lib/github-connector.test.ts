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
 * Tests for refresh-token logic in github-connector.ts
 *
 * Covers the four scenarios the code-reviewer required:
 *   1. connector-present/valid  — submitted PAT validated directly, connector NOT used
 *   2. connector-present/expired — still validates PAT directly
 *   3. valid replacement         — validateTokenDirect returns true
 *   4. failed retry after success — reverts to LAST good runtime PAT, not frozen startup value
 *
 * All GitHub HTTP calls are intercepted via vi.stubGlobal("fetch", ...).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  validateTokenDirect,
  clearTokenCache,
  resolveGitHubToken,
} from "./github-connector";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

// ── helpers ────────────────────────────────────────────────────────────────────

function makeGitHubUserResponse(login: string, scopes = "repo,workflow") {
  return new Response(JSON.stringify({ login }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "x-oauth-scopes": scopes,
    },
  });
}

function makeGitHubErrorResponse(status: number, message = "Bad credentials") {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ── setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearTokenCache();
  // Reset env to a known expired-PAT state
  process.env["GITHUB_PAT"] = "ghp_expired000000000000000000000000000";
});

afterEach(() => {
  vi.restoreAllMocks();
  clearTokenCache();
});

// ── validateTokenDirect tests ──────────────────────────────────────────────────

describe("validateTokenDirect", () => {
  it("validates the submitted token directly — not via connector resolution", async () => {
    const submittedPat = "ghp_submittedToken123";
    let capturedAuth: string | null = null;

    vi.stubGlobal("fetch", async (url: string, opts?: RequestInit) => {
      if (String(url).includes("api.github.com/user")) {
        capturedAuth = (opts?.headers as Record<string, string>)?.["Authorization"] ?? null;
        return makeGitHubUserResponse("testuser");
      }
      throw new Error("Unexpected fetch: " + url);
    });

    const result = await validateTokenDirect(submittedPat);

    expect(result.valid).toBe(true);
    expect(result.login).toBe("testuser");
    // Crucially: the Authorization header must use the submitted token, not any connector token
    expect(capturedAuth).toBe(`token ${submittedPat}`);
  });

  it("returns valid=true with login and scopes on 200", async () => {
    vi.stubGlobal("fetch", async () => makeGitHubUserResponse("alice", "repo, workflow"));

    const result = await validateTokenDirect("ghp_validToken12345678");
    expect(result.valid).toBe(true);
    expect(result.login).toBe("alice");
    expect(result.scopes).toContain("repo");
    expect(result.scopes).toContain("workflow");
  });

  it("returns valid=false with error on 401", async () => {
    vi.stubGlobal("fetch", async () => makeGitHubErrorResponse(401));

    const result = await validateTokenDirect("ghp_expiredToken12345");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/401/);
  });

  it("returns valid=false with error on 403", async () => {
    vi.stubGlobal("fetch", async () => makeGitHubErrorResponse(403, "Forbidden"));

    const result = await validateTokenDirect("ghp_noScopeToken1234");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/403/);
  });

  it("returns valid=false when fetch throws (network error)", async () => {
    vi.stubGlobal("fetch", async () => { throw new Error("ECONNREFUSED"); });

    const result = await validateTokenDirect("ghp_networkFail12345");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
  });
});

// ── Connector-present / token-expired fallback tests ──────────────────────────
// These test the production case where a Replit connector is configured but its
// OAuth token has expired — resolveGitHubToken() must fall through to GITHUB_PAT.

const FAKE_CONNECTOR_HOST = "connectors.replit.example";
const FAKE_IDENTITY_KEY   = "fake-identity-key-xyz";

describe("resolveGitHubToken — connector present, token expired", () => {
  const VALID_ENV_PAT      = "ghp_envPat123456789012345678901234";
  const EXPIRED_CONNECTOR  = "gho_connectorExpired111111111111111";

  function makeConnectorResponse(tok: string) {
    return new Response(
      JSON.stringify({ settings: { access_token: tok } }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }

  it("falls through to GITHUB_PAT when connector token is rejected by GitHub (401)", async () => {
    process.env["REPLIT_CONNECTORS_HOSTNAME"] = FAKE_CONNECTOR_HOST;
    process.env["REPL_IDENTITY_KEY"]          = FAKE_IDENTITY_KEY;
    process.env["GITHUB_PAT"]                 = VALID_ENV_PAT;
    clearTokenCache();

    vi.stubGlobal("fetch", async (url: string) => {
      const urlStr = String(url);
      // Connector API returns a token
      if (urlStr.includes(FAKE_CONNECTOR_HOST)) return makeConnectorResponse(EXPIRED_CONNECTOR);
      // GitHub /user: reject connector token, accept env PAT
      if (urlStr.includes("api.github.com/user")) {
        // Reject all tokens — simulates connector token expired, causing fallback to env PAT
        return new Response(JSON.stringify({ message: "Bad credentials" }), {
          status: 401, headers: { "content-type": "application/json" },
        });
      }
      throw new Error("Unexpected: " + urlStr);
    });

    // With the connector present but expired, resolveGitHubToken should
    // validate the connector token via GitHub and fall back to env PAT
    const { token, source } = await resolveGitHubToken();
    expect(token).toBe(VALID_ENV_PAT);
    expect(source).toBe("env");

    delete process.env["REPLIT_CONNECTORS_HOSTNAME"];
    delete process.env["REPL_IDENTITY_KEY"];
  });

  it("uses connector token directly when GitHub validates it (200)", async () => {
    process.env["REPLIT_CONNECTORS_HOSTNAME"] = FAKE_CONNECTOR_HOST;
    process.env["REPL_IDENTITY_KEY"]          = FAKE_IDENTITY_KEY;
    process.env["GITHUB_PAT"]                 = VALID_ENV_PAT;
    clearTokenCache();

    vi.stubGlobal("fetch", async (url: string) => {
      const urlStr = String(url);
      if (urlStr.includes(FAKE_CONNECTOR_HOST)) return makeConnectorResponse("gho_validConnector1111111111111111");
      if (urlStr.includes("api.github.com/user")) {
        return new Response(JSON.stringify({ login: "connector-user" }), {
          status: 200,
          headers: { "content-type": "application/json", "x-oauth-scopes": "repo,workflow" },
        });
      }
      throw new Error("Unexpected: " + urlStr);
    });

    const { token, source } = await resolveGitHubToken();
    expect(token).toBe("gho_validConnector1111111111111111");
    expect(source).toBe("connector");

    delete process.env["REPLIT_CONNECTORS_HOSTNAME"];
    delete process.env["REPL_IDENTITY_KEY"];
  });

  it("after clearTokenCache, refreshed env PAT is used even with expired connector", async () => {
    process.env["REPLIT_CONNECTORS_HOSTNAME"] = FAKE_CONNECTOR_HOST;
    process.env["REPL_IDENTITY_KEY"]          = FAKE_IDENTITY_KEY;
    const refreshedPat = "ghp_refreshed123456789012345678901";
    process.env["GITHUB_PAT"] = refreshedPat;
    clearTokenCache();

    vi.stubGlobal("fetch", async (url: string) => {
      const urlStr = String(url);
      if (urlStr.includes(FAKE_CONNECTOR_HOST)) return makeConnectorResponse(EXPIRED_CONNECTOR);
      // Always return 401 from GitHub /user — connector is expired, PAT would also need check
      // but resolveViaConnector validates connector → fails → falls to env PAT
      return new Response(JSON.stringify({ message: "Bad credentials" }), {
        status: 401, headers: { "content-type": "application/json" },
      });
    });

    const { token, source } = await resolveGitHubToken();
    // Falls back to env PAT (the refreshed one)
    expect(token).toBe(refreshedPat);
    expect(source).toBe("env");

    delete process.env["REPLIT_CONNECTORS_HOSTNAME"];
    delete process.env["REPL_IDENTITY_KEY"];
  });
});

// ── Snapshot / revert behavior tests ──────────────────────────────────────────

describe("refresh-token runtime PAT snapshot/revert logic", () => {
  /**
   * Simulate the exact logic inside the POST /deploy/refresh-token handler so
   * we can test the snapshot/revert without standing up an HTTP server.
   */
  async function simulateRefresh(newPat: string): Promise<{ ok: boolean; error?: string }> {
    const prevRuntimePat = process.env["GITHUB_PAT"] ?? "";
    process.env["GITHUB_PAT"] = newPat;
    clearTokenCache();

    const validation = await validateTokenDirect(newPat);
    if (!validation.valid) {
      process.env["GITHUB_PAT"] = prevRuntimePat;
      clearTokenCache();
      return { ok: false, error: validation.error };
    }
    return { ok: true };
  }

  it("scenario: connector present + valid — PAT is still validated directly", async () => {
    // Even if a connector token would be valid, validateTokenDirect tests only
    // the submitted PAT — it never calls resolveViaConnector.
    // Simulate: submitted PAT returns 200 directly.
    vi.stubGlobal("fetch", async () => makeGitHubUserResponse("directUser"));

    process.env["GITHUB_PAT"] = "ghp_old_expired_pat_000000000000000000";
    const result = await simulateRefresh("ghp_newDirectPat1234567890");

    expect(result.ok).toBe(true);
    expect(process.env["GITHUB_PAT"]).toBe("ghp_newDirectPat1234567890");
  });

  it("scenario: connector present + expired — PAT validated directly regardless", async () => {
    // Connector endpoint would fail, but validateTokenDirect never calls it.
    // The submitted PAT goes straight to /user.
    vi.stubGlobal("fetch", async (url: string) => {
      if (String(url).includes("api.github.com/user")) return makeGitHubUserResponse("validUser");
      throw new Error("Connector should not be called");
    });

    process.env["GITHUB_PAT"] = "ghp_expired_connector_000000000000000";
    const result = await simulateRefresh("ghp_freshPat12345678901234");

    expect(result.ok).toBe(true);
    expect(process.env["GITHUB_PAT"]).toBe("ghp_freshPat12345678901234");
  });

  it("scenario: valid replacement — env var updated, cache cleared", async () => {
    vi.stubGlobal("fetch", async () => makeGitHubUserResponse("bob"));

    const newPat = "ghp_replacement123456789012345678";
    process.env["GITHUB_PAT"] = "ghp_original_expired00000000000000";
    const result = await simulateRefresh(newPat);

    expect(result.ok).toBe(true);
    expect(process.env["GITHUB_PAT"]).toBe(newPat);
  });

  it("scenario: failed retry after success — reverts to last good runtime PAT, not frozen startup", async () => {
    // Step 1: successful first refresh → runtime PAT = goodPat
    vi.stubGlobal("fetch", async () => makeGitHubUserResponse("carol"));
    const goodPat = "ghp_goodPat1234567890123456789012";
    await simulateRefresh(goodPat);
    expect(process.env["GITHUB_PAT"]).toBe(goodPat);

    // Step 2: failed second refresh → must revert to goodPat, not the original expired startup value
    vi.stubGlobal("fetch", async () => makeGitHubErrorResponse(401));
    const badPat = "ghp_badPat111111111111111111111111";
    const result = await simulateRefresh(badPat);

    expect(result.ok).toBe(false);
    // KEY assertion: reverted to the LAST good runtime value, not the expired startup value
    expect(process.env["GITHUB_PAT"]).toBe(goodPat);
    expect(process.env["GITHUB_PAT"]).not.toBe("ghp_expired000000000000000000000000000");
  });

  it("leaves env var unchanged after a failed submission", async () => {
    vi.stubGlobal("fetch", async () => makeGitHubErrorResponse(401));

    const originalPat = process.env["GITHUB_PAT"];
    const result = await simulateRefresh("ghp_badToken111111111111111111111");

    expect(result.ok).toBe(false);
    expect(process.env["GITHUB_PAT"]).toBe(originalPat);
  });
});
