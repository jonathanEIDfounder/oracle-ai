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
 * Xcode Cloud routes — Apple App Store Connect CI/CD API.
 *
 * Security:
 *   • All routes are rate-limited per IP (reads: 30/min, build trigger: 5/min)
 *   • POST /xcode/builds (build trigger) additionally requires HMAC auth —
 *     legacy X-Deploy-Token accepted for back-compat with existing tooling
 *   • Rate maps are registered with the daemon prune loop
 */

import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { projectsTable, activityTable } from "@workspace/db";
import { appleRequest } from "../lib/apple-jwt";
import {
  ListXcodeProductsParams,
  TriggerXcodeBuildBody,
  GetXcodeBuildParams,
} from "@workspace/api-zod";
import { CONFIG } from "../lib/config";
import { requireAuth } from "../lib/hmac-auth";
import { registerRateMap } from "../lib/daemons";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "../lib/authorship";
void _S1AF_ANCHOR;

const router = Router();

// ── Per-IP rate limiting ──────────────────────────────────────────────────────

const readRateMap  = new Map<string, { count: number; resetAt: number }>();
const buildRateMap = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS    = 60_000;

registerRateMap("xcode-read",  readRateMap);
registerRateMap("xcode-build", buildRateMap);

function clientIp(req: Request): string {
  return ((req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown")
    .split(",")[0].trim().slice(0, 40);
}

function isRateLimited(
  map:   Map<string, { count: number; resetAt: number }>,
  ip:    string,
  limit: number,
): boolean {
  const now   = Date.now();
  const entry = map.get(ip);
  if (!entry || now > entry.resetAt) {
    map.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > limit;
}

// ── Shared response types ─────────────────────────────────────────────────────

interface AppleListResponse<T> {
  data: Array<{ id: string; type: string; attributes: T }>;
}

// ── GET /api/xcode/apps ───────────────────────────────────────────────────────
router.get("/xcode/apps", async (req: Request, res: Response) => {
  if (isRateLimited(readRateMap, clientIp(req), CONFIG.rateLimit.xcodeReadPerMin)) {
    res.status(429).json({ ok: false, error: "Too many requests — try again in a minute" });
    return;
  }
  try {
    const data = await appleRequest<AppleListResponse<{ name: string; bundleId: string }>>(
      "/apps?limit=50&fields[apps]=name,bundleId",
    );
    res.json(data.data.map((item) => ({
      id:       item.id,
      name:     item.attributes.name,
      bundleId: item.attributes.bundleId,
    })));
  } catch (err) {
    req.log.error({ err }, "Error fetching Xcode apps");
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Failed to fetch apps" });
  }
});

// ── GET /api/xcode/apps/:appId/products ──────────────────────────────────────
router.get("/xcode/apps/:appId/products", async (req: Request, res: Response) => {
  if (isRateLimited(readRateMap, clientIp(req), CONFIG.rateLimit.xcodeReadPerMin)) {
    res.status(429).json({ ok: false, error: "Too many requests — try again in a minute" });
    return;
  }
  const params = ListXcodeProductsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ ok: false, error: "Invalid appId" });
    return;
  }
  try {
    const data = await appleRequest<AppleListResponse<{ name: string; productType: string }>>(
      `/apps/${params.data.appId}/ciProduct?fields[ciProducts]=name,productType`,
    );
    res.json(data.data.map((item) => ({
      id:          item.id,
      name:        item.attributes.name,
      productType: item.attributes.productType,
    })));
  } catch (err) {
    req.log.error({ err }, "Error fetching Xcode CI products");
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Failed to fetch CI products" });
  }
});

// ── GET /api/xcode/builds ─────────────────────────────────────────────────────
router.get("/xcode/builds", async (req: Request, res: Response) => {
  if (isRateLimited(readRateMap, clientIp(req), CONFIG.rateLimit.xcodeReadPerMin)) {
    res.status(429).json({ ok: false, error: "Too many requests — try again in a minute" });
    return;
  }
  try {
    const data = await appleRequest<AppleListResponse<{
      number: number;
      executionProgress: string;
      completionStatus: string;
      startedDate: string | null;
      finishedDate: string | null;
      sourceChanges?: Array<{ commitSha?: string }>;
    }>>(
      "/ciBuildRuns?limit=20&sort=-startedDate&fields[ciBuildRuns]=number,executionProgress,completionStatus,startedDate,finishedDate,sourceChanges",
    );
    res.json(data.data.map((item) => ({
      id:                item.id,
      number:            item.attributes.number,
      executionProgress: item.attributes.executionProgress as "PENDING_EXECUTION" | "PREPARING" | "RUNNING" | "COMPLETE",
      completionStatus:  item.attributes.completionStatus  as "SUCCEEDED" | "FAILED" | "ERRORED" | "CANCELED" | "SKIPPED" | "NOT_COMPLETED",
      startedDate:       item.attributes.startedDate  ?? null,
      finishedDate:      item.attributes.finishedDate ?? null,
      appName:           null,
      productName:       null,
      sourceChanges:     item.attributes.sourceChanges?.map((sc) => sc.commitSha ?? "").filter(Boolean).join(", ") ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "Error fetching Xcode builds");
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Failed to fetch builds" });
  }
});

// ── POST /api/xcode/builds ────────────────────────────────────────────────────
// Triggers a real Xcode Cloud build — requires HMAC auth to prevent abuse.
router.post(
  "/xcode/builds",
  requireAuth({ allowLegacy: true }),
  async (req: Request, res: Response) => {
    if (isRateLimited(buildRateMap, clientIp(req), CONFIG.rateLimit.xcodeBuildPerMin)) {
      res.status(429).json({ ok: false, error: "Too many build requests — try again in a minute" });
      return;
    }

    const parsed = TriggerXcodeBuildBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: parsed.error.message });
      return;
    }

    const { xcodeProductId, projectId } = parsed.data;

    try {
      const buildPayload = {
        data: {
          type: "ciBuildRuns",
          relationships: {
            workflow: { data: { type: "ciWorkflows", id: xcodeProductId } },
          },
        },
      };

      const result = await appleRequest<{
        data: {
          id: string;
          attributes: {
            number: number;
            executionProgress: string;
            completionStatus: string;
            startedDate: string | null;
            finishedDate: string | null;
          };
        };
      }>("/ciBuildRuns", { method: "POST", body: JSON.stringify(buildPayload) });

      const build = {
        id:                result.data.id,
        number:            result.data.attributes.number,
        executionProgress: result.data.attributes.executionProgress as "PENDING_EXECUTION" | "PREPARING" | "RUNNING" | "COMPLETE",
        completionStatus:  result.data.attributes.completionStatus  as "SUCCEEDED" | "FAILED" | "ERRORED" | "CANCELED" | "SKIPPED" | "NOT_COMPLETED",
        startedDate:       result.data.attributes.startedDate  ?? null,
        finishedDate:      result.data.attributes.finishedDate ?? null,
        appName:           null,
        productName:       null,
        sourceChanges:     null,
      };

      // Update project build count if project linked (non-fatal)
      if (projectId) {
        try {
          const [project] = await db
            .select()
            .from(projectsTable)
            .where(eq(projectsTable.id, projectId));

          if (project) {
            await db
              .update(projectsTable)
              .set({ buildCount: (project.buildCount ?? 0) + 1, lastBuildStatus: "PENDING_EXECUTION", updatedAt: new Date() })
              .where(eq(projectsTable.id, projectId));

            await db.insert(activityTable).values({
              type:        "build_triggered",
              description: `Triggered Xcode Cloud build #${build.number} for ${project.name}`,
              projectId,
            });
          }
        } catch (dbErr) {
          req.log.warn({ err: dbErr }, "DB update failed after successful build trigger");
        }
      }

      res.status(201).json(build);
    } catch (err) {
      req.log.error({ err }, "Error triggering Xcode build");
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Failed to trigger build" });
    }
  },
);

// ── GET /api/xcode/builds/:buildId ───────────────────────────────────────────
router.get("/xcode/builds/:buildId", async (req: Request, res: Response) => {
  if (isRateLimited(readRateMap, clientIp(req), CONFIG.rateLimit.xcodeReadPerMin)) {
    res.status(429).json({ ok: false, error: "Too many requests — try again in a minute" });
    return;
  }
  const params = GetXcodeBuildParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ ok: false, error: "Invalid buildId" });
    return;
  }
  try {
    const result = await appleRequest<{
      data: {
        id: string;
        attributes: {
          number: number;
          executionProgress: string;
          completionStatus: string;
          startedDate: string | null;
          finishedDate: string | null;
        };
      };
    }>(`/ciBuildRuns/${params.data.buildId}`);

    res.json({
      id:                result.data.id,
      number:            result.data.attributes.number,
      executionProgress: result.data.attributes.executionProgress as "PENDING_EXECUTION" | "PREPARING" | "RUNNING" | "COMPLETE",
      completionStatus:  result.data.attributes.completionStatus  as "SUCCEEDED" | "FAILED" | "ERRORED" | "CANCELED" | "SKIPPED" | "NOT_COMPLETED",
      startedDate:       result.data.attributes.startedDate  ?? null,
      finishedDate:      result.data.attributes.finishedDate ?? null,
      appName:           null,
      productName:       null,
      sourceChanges:     null,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching Xcode build");
    const status = err instanceof Error && err.message.includes("404") ? 404 : 500;
    res.status(status).json({ ok: false, error: err instanceof Error ? err.message : "Failed to fetch build" });
  }
});

export default router;
