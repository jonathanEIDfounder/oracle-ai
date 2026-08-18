/**
 * © 2026 Jonathan Sherman — S1AF (Sentient iOS One-Step App Framework)
 * Sovereign ID: 1 · OCSO-S1AF-GOV-1 · All rights reserved.
 *
 * Transform routes — Gallows + Reaper + full pipeline
 * All routes locked to iPhone XR via requireIphoneXR middleware.
 *
 * POST /api/transform/gallows   — combine up to 3 app descriptions → unified spec
 * POST /api/transform/reap      — transform a single spec → S1AF-sovereign spec
 * POST /api/transform/build     — full pipeline: gallows → reaper → Swift → DB → commit
 */

import { Router, type Request, type Response } from "express";
import { db }                   from "@workspace/db";
import { projectsTable }        from "@workspace/db";
import { filterGeneratedCode }  from "../lib/intake";
import { validateSwiftCode }    from "../lib/kimi";
import { commitGeneratedApp }   from "../lib/github-commit";
import { logger }               from "../lib/logger";
import { requireIphoneXR }      from "../middleware/device-auth";
import { isMoonshotLocked, getRotationLockStatus, recordBlockedAttempt } from "../lib/rotation-lock";
import { gallowsCombine, reaperTransform, transformPipeline } from "../lib/transform-pipeline";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "../lib/authorship";
void _S1AF_ANCHOR;

const router = Router();

// ── Lock check helper ─────────────────────────────────────────────────────────
function assertUnlocked(res: Response): boolean {
  if (!isMoonshotLocked()) return true;
  recordBlockedAttempt();
  const lock = getRotationLockStatus();
  res.status(503).json({ ok: false, error: "api_locked", message: lock.message, locked: true });
  return false;
}

// ── POST /api/transform/gallows ───────────────────────────────────────────────
// Combine 1–3 app descriptions into one unified sovereign spec via Kimi 2.6.
// Body: { descriptions: string[] }   (1–3 items, each max 8000 chars)

router.post("/transform/gallows", requireIphoneXR, async (req: Request, res: Response) => {
  if (!assertUnlocked(res)) return;

  const { descriptions } = (req.body ?? {}) as { descriptions?: unknown };

  if (!Array.isArray(descriptions) || descriptions.length === 0) {
    res.status(400).json({ ok: false, error: "descriptions must be a non-empty array" });
    return;
  }
  if (descriptions.length > 4) {
    res.status(400).json({ ok: false, error: "Gallows accepts at most 4 descriptions" });
    return;
  }
  for (const d of descriptions) {
    if (typeof d !== "string" || d.trim().length < 10) {
      res.status(400).json({ ok: false, error: "Each description must be at least 10 characters" });
      return;
    }
  }

  try {
    logger.info({ count: descriptions.length }, "transform/gallows: combining");
    const unified = await gallowsCombine(descriptions as string[]);
    res.json({
      ok:          true,
      stage:       "gallows",
      inputCount:  descriptions.length,
      unifiedSpec: unified,
      chars:       unified.length,
    });
  } catch (err) {
    logger.error({ err }, "transform/gallows: error");
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /api/transform/reap ──────────────────────────────────────────────────
// Transform a single app description into a pure S1AF-sovereign spec.
// Body: { description: string }

router.post("/transform/reap", requireIphoneXR, async (req: Request, res: Response) => {
  if (!assertUnlocked(res)) return;

  const { description } = (req.body ?? {}) as { description?: unknown };

  if (typeof description !== "string" || description.trim().length < 10) {
    res.status(400).json({ ok: false, error: "description must be at least 10 characters" });
    return;
  }

  try {
    logger.info({ chars: description.length }, "transform/reap: transforming");
    const transformed = await reaperTransform(description);
    res.json({
      ok:              true,
      stage:           "reaper",
      transformedSpec: transformed,
      chars:           transformed.length,
    });
  } catch (err) {
    logger.error({ err }, "transform/reap: error");
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /api/transform/build ─────────────────────────────────────────────────
// Full transform pipeline: gallows → reaper → Kimi 2.6 Swift generation → DB → oracle-ai
// Body: { descriptions: string[], name: string, platform?: "ios" | "macos" }

router.post("/transform/build", requireIphoneXR, async (req: Request, res: Response) => {
  if (!assertUnlocked(res)) return;

  const {
    descriptions,
    name,
    platform = "ios",
  } = (req.body ?? {}) as {
    descriptions?: unknown;
    name?: unknown;
    platform?: unknown;
  };

  if (!Array.isArray(descriptions) || descriptions.length === 0) {
    res.status(400).json({ ok: false, error: "descriptions required (1–3 items)" });
    return;
  }
  if ((descriptions as unknown[]).length > 4) {
    res.status(400).json({ ok: false, error: "Gallows accepts at most 4 descriptions" });
    return;
  }
  if (typeof name !== "string" || name.trim().length < 2) {
    res.status(400).json({ ok: false, error: "name is required" });
    return;
  }
  if (platform !== "ios" && platform !== "macos") {
    res.status(400).json({ ok: false, error: "platform must be 'ios' or 'macos'" });
    return;
  }

  const appName = name.trim();

  logger.info(
    { appName, platform, inputs: (descriptions as string[]).length },
    "transform/build: sovereign pipeline initiated — gallows → reaper → kimi 2.6"
  );

  try {
    // ── Stages 1–3: Transform pipeline ───────────────────────────────────────
    const { gallowsSpec, reaperSpec, generated, stages } = await transformPipeline(
      descriptions as string[],
      appName,
      platform as "ios" | "macos"
    );

    // ── Stage 4: Sentient Intake Filter ──────────────────────────────────────
    logger.info("transform/build: [4/6] Sentient Intake Filter");
    const verdict = filterGeneratedCode(generated.files, platform as string);
    if (!verdict.pass) {
      res.status(403).json({
        ok: false, stage: "intake",
        blocked: verdict.blocked,
        message: "Sentient Intake Filter blocked the transform output",
      });
      return;
    }

    // ── Stage 5: Swift structural validation ──────────────────────────────────
    logger.info("transform/build: [5/6] Swift structural validation");
    const validation  = validateSwiftCode(generated.files);
    const allWarnings = [
      ...verdict.flags.map(f => ({ type: "intake-advisory", message: f })),
      ...validation.warnings.map(w => ({ type: w.type, message: w.message })),
    ];

    // ── Stage 6a: Save to DB ──────────────────────────────────────────────────
    logger.info("transform/build: [6/6a] Persisting to DB");
    let project: { id: number } | undefined;
    try {
      const [inserted] = await db
        .insert(projectsTable)
        .values({
          name:           appName,
          platform:       platform as string,
          description:    reaperSpec.slice(0, 500),
          generatedFiles: Object.entries(generated.files).map(([filename, content]) => ({
            filename, content, lines: content.split("\n").length,
          })),
          summary: generated.summary ?? `${appName} — S1AF Transform Pipeline`,
          bundleId: `com.sentient.ios.${appName.toLowerCase().replace(/\s+/g, "-")}`,
        } as Record<string, unknown>)
        .returning({ id: projectsTable.id });
      project = inserted;
    } catch (dbErr) {
      logger.warn({ err: dbErr }, "transform/build: DB insert failed — continuing");
    }

    // ── Stage 6b: Commit to oracle-ai ────────────────────────────────────────
    logger.info("transform/build: [6/6b] Committing to oracle-ai");
    let commitResult = null;
    try {
      commitResult = await commitGeneratedApp(generated.files, appName, platform as string);
    } catch (commitErr) {
      logger.warn({ err: commitErr }, "transform/build: commit failed — returning without commit");
    }

    logger.info(
      { projectId: project?.id, files: Object.keys(generated.files).length, commit: commitResult?.tag },
      "transform/build: pipeline complete"
    );

    res.json({
      ok:         true,
      app:        appName,
      platform,
      projectId:  project?.id ?? null,
      pipeline: {
        gallowsSpec,
        reaperSpec,
        stages,
      },
      files:      generated.files,
      fileCount:  Object.keys(generated.files).length,
      summary:    generated.summary,
      warnings:   allWarnings,
      intake:     { score: verdict.score, passed: verdict.pass, flagged: verdict.flags.length },
      commit:     commitResult ? {
        tag:       commitResult.tag,
        commitSha: commitResult.commitSha,
        committed: commitResult.committed,
        repoUrl:   commitResult.repoUrl,
      } : null,
    });

  } catch (err) {
    logger.error({ err }, "transform/build: pipeline error");
    res.status(500).json({
      ok:    false,
      error: err instanceof Error ? err.message : "Transform pipeline failed",
    });
  }
});

export default router;
