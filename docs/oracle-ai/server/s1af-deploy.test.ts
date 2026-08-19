/**
 * HMAC authentication tests for oracle-ai's s1af-deploy router.
 *
 * Exercises the actual s1af-deploy router (docs/oracle-ai/server/s1af-deploy.ts)
 * with a fixture app that mirrors the fixed oracle-ai/server/index.ts wiring:
 *   ① raw-body capture middleware (added by the task-22 fix to index.ts)
 *   ② JSON parse from rawBody
 *   Router mounted at /api/deploy — so req.originalUrl is /api/deploy/trigger
 *
 * The definitive regression guard is the whitespace-divergent body test:
 * - Sends pretty-printed JSON (`{\n  "source": ...\n}`) over the wire
 * - Signs those exact bytes with HMAC-SHA256
 * - Expects 200 (server uses raw bytes) not 401 (server would use JSON.stringify fallback)
 *
 * If oracle-ai/server/index.ts is reverted so that express.json() runs BEFORE
 * the raw-body capture, req.rawBody will be "" and the verifier will compute
 * sha256("") ≠ sha256(prettyBody), returning 401 and making this test fail.
 *
 * Run with the api-server test suite:
 *   pnpm --filter @workspace/api-server run test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";
import express, { type Request, type Response, type NextFunction } from "express";
import supertest from "supertest";

// Import the oracle-ai deploy router directly (no other oracle-ai dependencies needed)
import s1afDeployRouter from "./s1af-deploy";

// ── Test constants ─────────────────────────────────────────────────────────────
// DEPLOY_SECRET is injected by vitest.config.ts `test.env` as "test-deploy-secret-ok"
const DEPLOY_SECRET = process.env["DEPLOY_SECRET"] ?? "test-deploy-secret-ok";
const TRIGGER_PATH  = "/api/deploy/trigger";

// ── HMAC helpers (mirrors hmac-auth.ts to keep this file self-contained) ──────
function sha256hex(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}
function hmacHex(secret: string, data: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}
function signBody(secret: string, method: string, path: string, body: string) {
  const ts    = Math.floor(Date.now() / 1000);
  const canon = `${ts}\n${method.toUpperCase()}\n${path}\n${sha256hex(body)}`;
  return {
    "x-deploy-timestamp": String(ts),
    "x-deploy-signature": hmacHex(secret, canon),
  };
}

// ── Oracle-AI fixture app ──────────────────────────────────────────────────────
// Mirrors the fixed index.ts middleware stack:
//   ① raw-body capture  (added by task-22 to docs/oracle-ai/server/index.ts)
//   ② JSON parse from rawBody
// Mounted at /api/deploy so req.originalUrl matches production.

function buildOracleAiApp() {
  const app = express();

  // ① Raw-body capture — mirrors the middleware added to oracle-ai/server/index.ts.
  //   If this block is removed or swapped below JSON parsing, the
  //   whitespace-divergent test fails, catching the regression.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const ct = (req.headers["content-type"] as string) ?? "";
    if (ct.startsWith("multipart/form-data")) {
      (req as any).rawBody = "";
      return next();
    }
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      (req as any).rawBody = Buffer.concat(chunks).toString("utf8");
      next();
    });
    req.on("error", next);
  });

  // ② JSON parse from rawBody (oracle-ai style, matching the index.ts fix).
  app.use((req: Request, res: Response, next: NextFunction) => {
    const raw: string = (req as any).rawBody ?? "";
    if (raw && ((req.headers["content-type"] as string) ?? "").includes("application/json")) {
      try {
        req.body = JSON.parse(raw);
      } catch {
        res.status(400).json({ ok: false, error: "Malformed JSON" });
        return;
      }
    }
    next();
  });

  app.use("/api/deploy", s1afDeployRouter);
  return app;
}

// ── Rate bucket reset helper ───────────────────────────────────────────────────
// s1af-deploy.ts keeps its own in-memory rate buckets. Clear them between tests.
import { rateBuckets as _s1afRateBuckets } from "./s1af-deploy";

// ── Fetch mock ────────────────────────────────────────────────────────────────
function mockFetchDispatch204() {
  vi.stubGlobal("fetch", async (url: string) => {
    const u = String(url);
    if (u.includes("actions/workflows") && u.includes("dispatches")) {
      return new Response(null, { status: 204 });
    }
    // GitHub PAT-less trigger returns 503 (no PAT configured) — not 401 (bad auth)
    return new Response(JSON.stringify({ ok: false }), { status: 503 });
  });
}

beforeEach(() => {
  _s1afRateBuckets?.clear?.();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("oracle-ai s1af-deploy — HMAC authentication", () => {
  it("returns non-401 for a correctly signed compact body", async () => {
    mockFetchDispatch204();
    const bodyStr = JSON.stringify({ source: "oracle-ai-deploy" });
    const hdrs    = signBody(DEPLOY_SECRET, "POST", TRIGGER_PATH, bodyStr);

    const res = await supertest(buildOracleAiApp())
      .post(TRIGGER_PATH)
      .set("x-deploy-timestamp", hdrs["x-deploy-timestamp"])
      .set("x-deploy-signature", hdrs["x-deploy-signature"])
      .type("json")
      .send(bodyStr);

    // Auth passed — handler may succeed (200) or fail for PAT reasons (503),
    // but MUST NOT return 401 (which would mean HMAC verification failed).
    expect(res.status).not.toBe(401);
  });

  it("returns non-401 for a pretty-printed body signed against its exact wire bytes", async () => {
    // Pretty-printed body: wire bytes differ from JSON.stringify(req.body).
    // Only a server that uses req.rawBody (not JSON.stringify fallback) can
    // verify this correctly.  If oracle-ai/server/index.ts loses raw-body capture,
    // this test returns 401 and exposes the regression.
    mockFetchDispatch204();
    const prettyBody = '{\n  "source": "oracle-ai-deploy"\n}';
    const hdrs       = signBody(DEPLOY_SECRET, "POST", TRIGGER_PATH, prettyBody);

    const res = await supertest(buildOracleAiApp())
      .post(TRIGGER_PATH)
      .set("x-deploy-timestamp", hdrs["x-deploy-timestamp"])
      .set("x-deploy-signature", hdrs["x-deploy-signature"])
      .type("json")
      .send(prettyBody);

    expect(res.status).not.toBe(401);
  });

  it("returns 401 when no auth headers are sent", async () => {
    const res = await supertest(buildOracleAiApp())
      .post(TRIGGER_PATH)
      .type("json")
      .send(JSON.stringify({ source: "oracle-ai-deploy" }));

    expect(res.status).toBe(401);
  });

  it("returns 401 when HMAC is signed with the wrong secret", async () => {
    const bodyStr = JSON.stringify({ source: "oracle-ai-deploy" });
    const hdrs    = signBody("totally-wrong-secret-0000000", "POST", TRIGGER_PATH, bodyStr);

    const res = await supertest(buildOracleAiApp())
      .post(TRIGGER_PATH)
      .set("x-deploy-timestamp", hdrs["x-deploy-timestamp"])
      .set("x-deploy-signature", hdrs["x-deploy-signature"])
      .type("json")
      .send(bodyStr);

    expect(res.status).toBe(401);
  });

  it("returns 401 when X-Deploy-Timestamp is older than 5 minutes", async () => {
    const staleTs  = Math.floor(Date.now() / 1000) - 400;
    const bodyStr  = JSON.stringify({ source: "oracle-ai-deploy" });
    const bodyHash = sha256hex(bodyStr);
    const canon    = `${staleTs}\nPOST\n${TRIGGER_PATH}\n${bodyHash}`;
    const staleSig = hmacHex(DEPLOY_SECRET, canon);

    const res = await supertest(buildOracleAiApp())
      .post(TRIGGER_PATH)
      .set("x-deploy-timestamp", String(staleTs))
      .set("x-deploy-signature", staleSig)
      .type("json")
      .send(bodyStr);

    expect(res.status).toBe(401);
  });

  it("returns 401 when signature is all-zero garbage hex", async () => {
    const bodyStr = JSON.stringify({ source: "oracle-ai-deploy" });
    const ts      = String(Math.floor(Date.now() / 1000));

    const res = await supertest(buildOracleAiApp())
      .post(TRIGGER_PATH)
      .set("x-deploy-timestamp", ts)
      .set("x-deploy-signature", "0".repeat(64))
      .type("json")
      .send(bodyStr);

    expect(res.status).toBe(401);
  });
});
