/**
 * HMAC authentication tests for oracle-ai's s1af-deploy router.
 *
 * Regression guarantee: the fixture app calls `applyOracleAiBodyParsing` —
 * the SAME shared factory that docs/oracle-ai/server/index.ts uses.  If
 * someone removes rawBodyCapture or swaps ① and ② inside that factory,
 * the whitespace-divergent body test below returns 401 instead of 200 and
 * fails immediately, catching the regression before it reaches production.
 *
 * A fixture that hardcoded its own middleware copy would NOT catch changes
 * to the production factory — this test does.
 *
 * Run with the api-server test suite:
 *   pnpm --filter @workspace/api-server run test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";
import express from "express";
import supertest from "supertest";

// ── Production factories (same modules used by index.ts) ──────────────────────
import { applyOracleAiBodyParsing } from "./body-parsing";
import s1afDeployRouter, { rateBuckets as s1afRateBuckets } from "./s1af-deploy";

// ── Test constants ─────────────────────────────────────────────────────────────
const DEPLOY_SECRET = process.env["DEPLOY_SECRET"] ?? "test-deploy-secret-ok";
const TRIGGER_PATH  = "/api/deploy/trigger";

// ── HMAC signing helper ────────────────────────────────────────────────────────
function sha256hex(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}
function hmacHex(secret: string, data: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}
function signWireBytes(secret: string, method: string, path: string, body: string) {
  const ts    = Math.floor(Date.now() / 1000);
  const canon = `${ts}\n${method.toUpperCase()}\n${path}\n${sha256hex(body)}`;
  return {
    "x-deploy-timestamp": String(ts),
    "x-deploy-signature": hmacHex(secret, canon),
  };
}

// ── Test fixture app ───────────────────────────────────────────────────────────
// Uses the SAME applyOracleAiBodyParsing factory as index.ts.
// Reordering ① and ② inside the factory makes the whitespace-divergent test fail.

function buildOracleAiApp() {
  const app = express();
  applyOracleAiBodyParsing(app);          // shared production factory — same as index.ts
  app.use("/api/deploy", s1afDeployRouter); // same mount point as index.ts line 2468+
  return app;
}

// ── Test isolation ─────────────────────────────────────────────────────────────

beforeEach(() => {
  s1afRateBuckets.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("oracle-ai s1af-deploy — HMAC authentication (production factory)", () => {
  function mockGitHub204() {
    vi.stubGlobal("fetch", async (url: string) => {
      const u = String(url);
      if (u.includes("actions/workflows") && u.includes("dispatches")) {
        return new Response(null, { status: 204 });
      }
      // No PAT configured in tests → 503, not 401
      return new Response(JSON.stringify({ ok: false }), { status: 503 });
    });
  }

  it("returns non-401 for a correctly signed compact body", async () => {
    mockGitHub204();
    const body = JSON.stringify({ source: "oracle-ai-deploy" });
    const hdrs = signWireBytes(DEPLOY_SECRET, "POST", TRIGGER_PATH, body);

    const res = await supertest(buildOracleAiApp())
      .post(TRIGGER_PATH)
      .set("x-deploy-timestamp", hdrs["x-deploy-timestamp"])
      .set("x-deploy-signature", hdrs["x-deploy-signature"])
      .type("json")
      .send(body);

    // Auth passed; handler may return 200 or 503 (no PAT), but never 401.
    expect(res.status).not.toBe(401);
  });

  it("returns non-401 for a pretty-printed body signed against the same wire bytes", async () => {
    // KEY REGRESSION TEST: pretty-printed bytes differ from JSON.stringify(req.body).
    // A server using rawBody signs the right bytes → non-401.
    // If rawBodyCapture is removed from the shared factory, req.rawBody = "" and
    // HMAC computes sha256("") ≠ sha256(prettyBody) → 401 → test fails.
    mockGitHub204();
    const prettyBody = '{\n  "source": "oracle-ai-deploy"\n}';
    const hdrs = signWireBytes(DEPLOY_SECRET, "POST", TRIGGER_PATH, prettyBody);

    const res = await supertest(buildOracleAiApp())
      .post(TRIGGER_PATH)
      .set("x-deploy-timestamp", hdrs["x-deploy-timestamp"])
      .set("x-deploy-signature", hdrs["x-deploy-signature"])
      .type("json")
      .send(prettyBody);

    expect(res.status).not.toBe(401);
  });

  it("returns 401 when no auth headers are provided", async () => {
    const res = await supertest(buildOracleAiApp())
      .post(TRIGGER_PATH)
      .type("json")
      .send(JSON.stringify({ source: "oracle-ai-deploy" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when signed with the wrong secret", async () => {
    const body = JSON.stringify({ source: "oracle-ai-deploy" });
    const hdrs = signWireBytes("wrong-secret-00000000000", "POST", TRIGGER_PATH, body);
    const res = await supertest(buildOracleAiApp())
      .post(TRIGGER_PATH)
      .set("x-deploy-timestamp", hdrs["x-deploy-timestamp"])
      .set("x-deploy-signature", hdrs["x-deploy-signature"])
      .type("json")
      .send(body);
    expect(res.status).toBe(401);
  });

  it("returns 401 when timestamp is older than 5 minutes", async () => {
    const staleTs = Math.floor(Date.now() / 1000) - 400;
    const body    = JSON.stringify({ source: "oracle-ai-deploy" });
    const canon   = `${staleTs}\nPOST\n${TRIGGER_PATH}\n${sha256hex(body)}`;
    const sig     = hmacHex(DEPLOY_SECRET, canon);
    const res = await supertest(buildOracleAiApp())
      .post(TRIGGER_PATH)
      .set("x-deploy-timestamp", String(staleTs))
      .set("x-deploy-signature", sig)
      .type("json")
      .send(body);
    expect(res.status).toBe(401);
  });

  it("returns 401 when signature is all-zero garbage", async () => {
    const body = JSON.stringify({ source: "oracle-ai-deploy" });
    const ts   = String(Math.floor(Date.now() / 1000));
    const res = await supertest(buildOracleAiApp())
      .post(TRIGGER_PATH)
      .set("x-deploy-timestamp", ts)
      .set("x-deploy-signature", "0".repeat(64))
      .type("json")
      .send(body);
    expect(res.status).toBe(401);
  });
});
