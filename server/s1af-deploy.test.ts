/**
 * © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1
 * S1AF — Sentient iOS One-Step App Framework · Sovereign ID: 1
 *
 * End-to-end HMAC auth tests for server/s1af-deploy.ts
 *
 * Confirms that:
 *   • Valid HMAC-signed requests reach the handler (no 401).
 *   • Invalid / expired / replayed signatures are rejected with 401.
 *   • Legacy X-Deploy-Token path still works.
 *   • HMAC fails clearly (500) when the host app forgot raw-body capture.
 *
 * Run:  pnpm --filter @workspace/api-server exec vitest run server/s1af-deploy.test.ts
 * (or)  npx vitest run server/s1af-deploy.test.ts   (from repo root)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Application } from "express";
import request from "supertest";
import crypto from "crypto";
import { createServer, type Server } from "http";

// ── Helpers (mirrors scripts/deploy.sh and hmac-auth.ts signRequest) ─────────

const TEST_SECRET = "test-deploy-secret-s1af-sovereign-1";

function sha256hex(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function hmacHex(secret: string, data: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

/**
 * Build the three HMAC headers for a request.
 * Canonical string: `${ts}\n${METHOD}\n${path}\n${SHA256(rawBody)}`
 * This is the same format used by hmac-auth.ts signRequest() and
 * server/s1af-deploy.ts requireDeployToken().
 */
function signRequest(
  method: string,
  path: string,
  body: string,
  secret: string,
  tsOverride?: number,
): Record<string, string> {
  const ts    = tsOverride ?? Math.floor(Date.now() / 1000);
  const canon = `${ts}\n${method.toUpperCase()}\n${path}\n${sha256hex(body)}`;
  const sig   = hmacHex(secret, canon);
  return {
    "X-Deploy-Timestamp": String(ts),
    "X-Deploy-Signature": sig,
    "Content-Type":       "application/json",
  };
}

// ── Test app factory ─────────────────────────────────────────────────────────

/**
 * Spins up a minimal Express app that mirrors the correct oracle-ai setup:
 *   1. Raw-body capture (before express.json)
 *   2. express.json()
 *   3. s1af-deploy router mounted at /api/deploy
 *
 * @param captureRawBody - pass false to simulate the broken config (no capture)
 */
async function buildTestApp(captureRawBody = true): Promise<Application> {
  // Dynamic import so the module resolves relative to this file's location.
  const { default: deployRouter } = await import("./s1af-deploy.js");

  process.env.DEPLOY_SECRET = TEST_SECRET;
  // No real PAT — deploy/trigger will return 503 (no PAT configured), not 401.
  delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  delete process.env.GITHUB_PAT;

  const app = express();

  if (captureRawBody) {
    // ── correct setup: raw bytes captured before JSON parse ─────────────────
    app.use((req, _res, next) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end",  () => { (req as any).rawBody = Buffer.concat(chunks).toString("utf8"); next(); });
      req.on("error", next);
    });
  }

  app.use(express.json());
  app.use("/api/deploy", deployRouter);
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("server/s1af-deploy — HMAC authentication", () => {

  // ── POST /api/deploy/trigger ─────────────────────────────────────────────
  describe("POST /api/deploy/trigger", () => {
    let app: Application;

    beforeAll(async () => { app = await buildTestApp(); });

    it("accepts a correctly HMAC-signed request (no 401)", async () => {
      const body    = JSON.stringify({ source: "test-s1af" });
      const headers = signRequest("POST", "/api/deploy/trigger", body, TEST_SECRET);

      const res = await request(app)
        .post("/api/deploy/trigger")
        .set(headers)
        .send(body);

      // Without a GitHub PAT the handler returns 503, NOT 401 — auth passed.
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(500);
      // 503 is the expected response when PAT is absent.
      expect([200, 503]).toContain(res.status);
    });

    it("rejects an invalid HMAC signature with 401", async () => {
      const body    = JSON.stringify({ source: "test-s1af" });
      const headers = signRequest("POST", "/api/deploy/trigger", body, TEST_SECRET);
      // Corrupt the signature
      headers["X-Deploy-Signature"] = "deadbeef".repeat(8);

      const res = await request(app)
        .post("/api/deploy/trigger")
        .set(headers)
        .send(body);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/hmac|signature/i);
    });

    it("rejects an expired timestamp with 401", async () => {
      const body    = JSON.stringify({ source: "test-s1af" });
      const staleTs = Math.floor(Date.now() / 1000) - 400; // > 300 s window
      const headers = signRequest("POST", "/api/deploy/trigger", body, TEST_SECRET, staleTs);

      const res = await request(app)
        .post("/api/deploy/trigger")
        .set(headers)
        .send(body);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/expired|clock/i);
    });

    it("rejects a future timestamp beyond the replay window with 401", async () => {
      const body     = JSON.stringify({ source: "test-s1af" });
      const futureTs = Math.floor(Date.now() / 1000) + 400;
      const headers  = signRequest("POST", "/api/deploy/trigger", body, TEST_SECRET, futureTs);

      const res = await request(app)
        .post("/api/deploy/trigger")
        .set(headers)
        .send(body);

      expect(res.status).toBe(401);
    });

    it("rejects a request with no auth headers with 401", async () => {
      const res = await request(app)
        .post("/api/deploy/trigger")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({ source: "test-s1af" }));

      expect(res.status).toBe(401);
    });

    it("accepts the legacy X-Deploy-Token header", async () => {
      const res = await request(app)
        .post("/api/deploy/trigger")
        .set("X-Deploy-Token", TEST_SECRET)
        .set("Content-Type", "application/json")
        .send(JSON.stringify({ source: "test-s1af" }));

      // 503 (no PAT) or 200 — both mean auth passed
      expect([200, 503]).toContain(res.status);
      expect(res.status).not.toBe(401);
    });

    it("rejects a wrong legacy token with 401", async () => {
      const res = await request(app)
        .post("/api/deploy/trigger")
        .set("X-Deploy-Token", "wrong-secret")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({ source: "test-s1af" }));

      expect(res.status).toBe(401);
    });

    it("HMAC over empty body succeeds (GET-style body)", async () => {
      const body    = "";
      const headers = signRequest("POST", "/api/deploy/trigger", body, TEST_SECRET);
      delete headers["Content-Type"];

      const res = await request(app)
        .post("/api/deploy/trigger")
        .set(headers);

      expect([200, 503]).toContain(res.status);
      expect(res.status).not.toBe(401);
    });
  });

  // ── GET /api/deploy/status ───────────────────────────────────────────────
  describe("GET /api/deploy/status", () => {
    let app: Application;

    beforeAll(async () => { app = await buildTestApp(); });

    it("accepts a correctly signed GET request (no 401)", async () => {
      const headers = signRequest("GET", "/api/deploy/status", "", TEST_SECRET);

      const res = await request(app)
        .get("/api/deploy/status")
        .set(headers);

      // 503 (no PAT) or 200 — auth passed either way
      expect([200, 503]).toContain(res.status);
      expect(res.status).not.toBe(401);
    });

    it("rejects unsigned GET with 401", async () => {
      const res = await request(app).get("/api/deploy/status");
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/deploy/health (no auth required) ────────────────────────────
  describe("GET /api/deploy/health", () => {
    let app: Application;

    beforeAll(async () => { app = await buildTestApp(); });

    it("returns 200 without any auth", async () => {
      const res = await request(app).get("/api/deploy/health");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("server", "oracle-ai");
    });
  });

  // ── Misconfiguration detection ───────────────────────────────────────────
  describe("misconfigured host — rawBody not captured", () => {
    let app: Application;

    beforeAll(async () => { app = await buildTestApp(false /* no raw-body capture */); });

    it("returns 500 with a clear diagnostic message, NOT a silent 401", async () => {
      const body    = JSON.stringify({ source: "test-s1af" });
      const headers = signRequest("POST", "/api/deploy/trigger", body, TEST_SECRET);

      const res = await request(app)
        .post("/api/deploy/trigger")
        .set(headers)
        .send(body);

      // Must NOT silently authenticate with a wrong MAC (that would be a security bug)
      // and must NOT return 401 (which would look like a wrong secret).
      // Must return 500 with a human-readable diagnostic.
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/raw body|misconfigured/i);
    });
  });

  // ── Rate limiting ────────────────────────────────────────────────────────
  describe("rate limiting", () => {
    let app: Application;

    beforeAll(async () => { app = await buildTestApp(); });

    it("returns 429 after 10 failed requests in one minute", async () => {
      // Use 11 requests with wrong secret from same (loopback) IP
      const results: number[] = [];
      for (let i = 0; i < 11; i++) {
        const res = await request(app)
          .post("/api/deploy/trigger")
          .set("X-Deploy-Token", "wrong-token-intentionally")
          .set("Content-Type", "application/json")
          .send("{}");
        results.push(res.status);
      }
      expect(results).toContain(429);
    });
  });
});
