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
 * Endpoint-level tests for POST /deploy/refresh-token and related routes.
 *
 * Uses supertest to exercise the actual Express router so that middleware
 * (requireDeployToken, rate-limit) and route handler logic are all in scope.
 *
 * Scenario coverage per reviewer requirements:
 *   A. Authenticated refresh — valid DEPLOY_SECRET + valid PAT → 200 with login
 *   B. Bad auth — missing or wrong DEPLOY_SECRET → 401 (env unchanged)
 *   C. Failed rollback — valid DEPLOY_SECRET + invalid PAT → 422, env reverts
 *      to exact prior runtime value (not frozen CONFIG startup value)
 *   D. Failed retry after success — second bad PAT reverts to first refresh's token
 *   E. Post-refresh token selection — after refresh, deploy/status uses new PAT
 *
 * ENV is set via vitest.config.ts `test.env` (PORT, DEPLOY_SECRET, ...).
 * GitHub /user calls are intercepted via vi.stubGlobal("fetch", ...).
 * Router is mounted at root so route paths match deploy.ts definitions exactly.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import supertest from "supertest";
import deployRouter, { _resetRateLimitForTesting } from "./deploy";
import { clearTokenCache, resolveGitHubToken } from "../lib/github-connector";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "../lib/authorship";
void _S1AF_ANCHOR;

// ── Test Express app ───────────────────────────────────────────────────────────
// Mount at root so paths in tests match the route definitions in deploy.ts exactly
// (e.g. router.post("/refresh-token", ...) → POST /refresh-token).

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/", deployRouter);
  return app;
}

// ── Fetch mock helpers ─────────────────────────────────────────────────────────

function ghUserOk(login = "testuser") {
  return new Response(JSON.stringify({ login }), {
    status: 200,
    headers: { "content-type": "application/json", "x-oauth-scopes": "repo,workflow" },
  });
}

function ghUser401() {
  return new Response(JSON.stringify({ message: "Bad credentials" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEPLOY_SECRET = "test-deploy-secret-ok"; // matches vitest.config.ts env
const VALID_PAT     = "ghp_validToken1234567890123456789";
const INITIAL_PAT   = "ghp_expired_initial_000000000000000";

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetRateLimitForTesting();  // clear accumulated rate-limit buckets between tests
  clearTokenCache();
  process.env["GITHUB_PAT"] = INITIAL_PAT;
});

afterEach(() => {
  vi.restoreAllMocks();
  clearTokenCache();
});

// ── A. Authenticated refresh ───────────────────────────────────────────────────

describe("POST /refresh-token — authenticated refresh", () => {
  it("returns 200 with login when DEPLOY_SECRET + valid PAT are supplied", async () => {
    vi.stubGlobal("fetch", async () => ghUserOk("alice"));

    const res = await supertest(buildApp())
      .post("/refresh-token")
      .set("x-deploy-token", DEPLOY_SECRET)
      .send({ token: VALID_PAT });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.login).toBe("alice");
  });

  it("updates process.env.GITHUB_PAT to the new token on success", async () => {
    vi.stubGlobal("fetch", async () => ghUserOk("bob"));

    await supertest(buildApp())
      .post("/refresh-token")
      .set("x-deploy-token", DEPLOY_SECRET)
      .send({ token: VALID_PAT });

    expect(process.env["GITHUB_PAT"]).toBe(VALID_PAT);
  });

  it("includes a persistence note in the success response", async () => {
    vi.stubGlobal("fetch", async () => ghUserOk());

    const res = await supertest(buildApp())
      .post("/refresh-token")
      .set("x-deploy-token", DEPLOY_SECRET)
      .send({ token: VALID_PAT });

    expect(res.body.note).toMatch(/Replit Secrets/i);
  });
});

// ── B. Authentication failures ─────────────────────────────────────────────────

describe("POST /refresh-token — auth failures", () => {
  it("returns 401 when x-deploy-token header is missing", async () => {
    const res = await supertest(buildApp())
      .post("/refresh-token")
      .send({ token: VALID_PAT });

    expect(res.status).toBe(401);
    expect(process.env["GITHUB_PAT"]).toBe(INITIAL_PAT);
  });

  it("returns 401 when x-deploy-token is wrong", async () => {
    const res = await supertest(buildApp())
      .post("/refresh-token")
      .set("x-deploy-token", "wrong-secret-value")
      .send({ token: VALID_PAT });

    expect(res.status).toBe(401);
    expect(process.env["GITHUB_PAT"]).toBe(INITIAL_PAT);
  });

  it("returns 400 when body is missing the token field", async () => {
    const res = await supertest(buildApp())
      .post("/refresh-token")
      .set("x-deploy-token", DEPLOY_SECRET)
      .send({});

    expect(res.status).toBe(400);
    expect(process.env["GITHUB_PAT"]).toBe(INITIAL_PAT);
  });

  it("returns 400 when token does not match a GitHub PAT prefix", async () => {
    const res = await supertest(buildApp())
      .post("/refresh-token")
      .set("x-deploy-token", DEPLOY_SECRET)
      .send({ token: "not-a-pat-12345678" });

    expect(res.status).toBe(400);
    expect(process.env["GITHUB_PAT"]).toBe(INITIAL_PAT);
  });
});

// ── C. Failed rollback — reverts to prior runtime value ───────────────────────

describe("POST /refresh-token — failed rollback", () => {
  it("returns 422 and reverts env to prior runtime PAT when GitHub rejects the token", async () => {
    vi.stubGlobal("fetch", async () => ghUser401());

    const res = await supertest(buildApp())
      .post("/refresh-token")
      .set("x-deploy-token", DEPLOY_SECRET)
      .send({ token: VALID_PAT });

    expect(res.status).toBe(422);
    expect(res.body.ok).toBe(false);
    // Must revert to the runtime value before the call, not the frozen CONFIG startup value
    expect(process.env["GITHUB_PAT"]).toBe(INITIAL_PAT);
  });
});

// ── D. Failed retry after success ─────────────────────────────────────────────

describe("POST /refresh-token — failed retry after prior success", () => {
  it("reverts to the LAST good runtime PAT when retry fails, not the original startup value", async () => {
    const app     = buildApp();
    const goodPat = "ghp_goodFromFirstRefresh1234567890";
    const badPat  = "ghp_badSecondAttempt111111111111111";

    // Step 1: successful first refresh
    vi.stubGlobal("fetch", async () => ghUserOk("carol"));
    const r1 = await supertest(app)
      .post("/refresh-token")
      .set("x-deploy-token", DEPLOY_SECRET)
      .send({ token: goodPat });
    expect(r1.status).toBe(200);
    expect(process.env["GITHUB_PAT"]).toBe(goodPat);

    // Step 2: failed second refresh — reset rate limit so this isn't 429
    _resetRateLimitForTesting();
    vi.stubGlobal("fetch", async () => ghUser401());
    const r2 = await supertest(app)
      .post("/refresh-token")
      .set("x-deploy-token", DEPLOY_SECRET)
      .send({ token: badPat });
    expect(r2.status).toBe(422);

    // KEY: must revert to goodPat, not the original INITIAL_PAT
    expect(process.env["GITHUB_PAT"]).toBe(goodPat);
    expect(process.env["GITHUB_PAT"]).not.toBe(INITIAL_PAT);
  });
});

// ── E. Post-refresh token selection ───────────────────────────────────────────

describe("Post-refresh token selection", () => {
  it("resolveGitHubToken() returns the updated env PAT after cache is cleared", async () => {
    process.env["GITHUB_PAT"] = VALID_PAT;
    clearTokenCache();

    // No connector available (CONNECTOR_HOST empty in tests — returns null immediately)
    const { token, source } = await resolveGitHubToken();
    expect(token).toBe(VALID_PAT);
    expect(source).toBe("env");
  });

  it("deploy/status uses the refreshed PAT when resolving the token", async () => {
    let capturedAuth: string | null = null;

    // Simulate a prior successful in-memory refresh
    process.env["GITHUB_PAT"] = VALID_PAT;
    clearTokenCache();

    vi.stubGlobal("fetch", async (url: string, opts?: RequestInit) => {
      const urlStr = String(url);
      // Connector hostname is empty in tests — this branch is never reached,
      // but guard it defensively.
      if (urlStr.includes("connectors")) return new Response(null, { status: 401 });
      // The actual URL pattern is: .../actions/workflows/self-trigger.yml/runs?per_page=5
      // "workflow_runs" appears only in the response body, not the URL.
      if (urlStr.includes("actions/workflows") && urlStr.includes("/runs")) {
        capturedAuth = (opts?.headers as Record<string, string>)?.["Authorization"] ?? null;
        return new Response(JSON.stringify({ workflow_runs: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error("Unexpected fetch: " + urlStr);
    });

    // Router is mounted at root "/" so the route path is /status (not /deploy/status)
    const res = await supertest(buildApp())
      .get("/status")
      .set("x-deploy-token", DEPLOY_SECRET);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // GitHub must have been called with the refreshed PAT
    expect(capturedAuth).toBe(`token ${VALID_PAT}`);
  });
});
