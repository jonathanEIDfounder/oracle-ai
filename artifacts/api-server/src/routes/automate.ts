/**
 * S1AF Automated Build Pipeline — One statement. No human in the loop.
 *
 * POST /api/automate/build
 *   → Kimi 2.6 generates all Swift files
 *   → Sentient Intake Filter evaluates every byte
 *   → Swift validation runs
 *   → Project saved to DB
 *   → Files committed to oracle-ai via GitHub API
 *   → Sovereign tag created and pushed
 *   → Complete result returned
 *
 * Governed exclusively by Jonathan Sherman — OCSO-S1AF-GOV-1.
 */

import { Router, type Request, type Response } from "express";
import { db }                   from "@workspace/db";
import { projectsTable, activityTable } from "@workspace/db";
import { generateSwiftCode, validateSwiftCode } from "../lib/kimi";
import { filterGeneratedCode }  from "../lib/intake";
import { commitGeneratedApp }   from "../lib/github-commit";
import { logger }               from "../lib/logger";
import { isMoonshotLocked, getRotationLockStatus, recordBlockedAttempt } from "../lib/rotation-lock";
import {
  QUANTUM_ADAPTIVE_APP_NAME,
  QUANTUM_ADAPTIVE_BUNDLE   as QUANTUM_ADAPTIVE_BUNDLE_ID,
  QUANTUM_ADAPTIVE_PLATFORM,
  QUANTUM_ADAPTIVE_DESCRIPTION,
  QUANTUM_ADAPTIVE_REQUIREMENTS,
} from "../lib/quantum-adaptive-spec";
import { requireIphoneXR } from "../middleware/device-auth";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "../lib/authorship";
void _S1AF_ANCHOR;

const router = Router();

// ── POST /api/automate/build ──────────────────────────────────────────────────
// One statement. Fully automated. No human in the loop.

function parseBody(body: unknown): { ok: true; description: string; appName?: string; platform: "ios" | "macos"; push: boolean } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Request body required" };
  const b = body as Record<string, unknown>;
  const description = typeof b.description === "string" ? b.description.trim() : "";
  if (description.length < 10) return { ok: false, error: "description must be at least 10 characters" };
  if (description.length > 4000) return { ok: false, error: "description too long (max 4000 chars)" };
  const rawPlatform = typeof b.platform === "string" ? b.platform : "ios";
  const platform = (rawPlatform === "macos" ? "macos" : "ios") as "ios" | "macos";
  const appName = typeof b.appName === "string" && b.appName.trim().length >= 2 ? b.appName.trim() : undefined;
  const push = b.push !== false;
  return { ok: true, description, appName, platform, push };
}

router.post("/automate/build", requireIphoneXR, async (req: Request, res: Response) => {
  if (isMoonshotLocked()) {
    recordBlockedAttempt();
    const lock = getRotationLockStatus();
    res.status(503).json({
      ok:      false,
      error:   "api_locked",
      message: lock.message,
      locked:  true,
      hint:    "Rotate MOONSHOT_API_KEY via POST /api/sentient/rotate or the Key Rotation page to resume.",
    });
    return;
  }

  const parsed = parseBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ ok: false, error: parsed.error });
    return;
  }

  const { description, appName, platform, push } = parsed;
  const name = appName ?? description.slice(0, 40).trim();

  logger.info(
    { platform, push, namePreview: name.slice(0, 40) },
    "automate: pipeline started — no human in loop"
  );

  try {
    // ── Stage 1: Generate ────────────────────────────────────────────────────
    logger.info("automate: [1/5] Kimi 2.6 generating Swift project");
    const generated = await generateSwiftCode(description, platform, undefined);

    // ── Stage 2: Intake Filter ───────────────────────────────────────────────
    logger.info("automate: [2/5] Sentient Intake Filter evaluating payload");
    const verdict = filterGeneratedCode(generated.files ?? {}, platform);
    if (!verdict.pass) {
      logger.warn(
        { blocked: verdict.blocked },
        "automate: pipeline aborted — intake filter blocked content"
      );
      res.status(403).json({
        ok:      false,
        stage:   "intake-filter",
        error:   "Sentient Intake Filter blocked the generated content",
        blocked: verdict.blocked,
        score:   verdict.score,
      });
      return;
    }

    // ── Stage 3: Swift Validation ────────────────────────────────────────────
    logger.info("automate: [3/5] Swift structural validation");
    const allCode = Object.values(generated.files ?? {}).join("\n");
    const validationWarnings = validateSwiftCode(allCode);
    const allWarnings = [
      ...(generated.warnings ?? []),
      ...verdict.flags.map((f) => ({ type: "intake-advisory", message: f })),
      ...validationWarnings,
    ];

    // ── Stage 4: Save to DB ──────────────────────────────────────────────────
    logger.info("automate: [4/5] Persisting project to database");
    const [project] = await db
      .insert(projectsTable)
      .values({
        name:           name,
        description:    description,
        platform:       platform,
        swiftCode:      allCode,
        generatedFiles: generated.files ?? null,
        architectureNotes: generated.summary ?? null,
      })
      .returning();

    await db.insert(activityTable).values({
      type:        "code_generated",
      description: `[AUTO] Kimi 2.6 generated ${platform.toUpperCase()} app: ${name.slice(0, 60)}`,
      projectId:   project?.id ?? null,
    });

    // ── Stage 5: Commit + Tag ─────────────────────────────────────────────────
    let commitResult: Awaited<ReturnType<typeof commitGeneratedApp>> | null = null;
    if (push) {
      logger.info("automate: [5/5] Committing to oracle-ai — creating sovereign tag");
      try {
        commitResult = await commitGeneratedApp(
          generated.files ?? {},
          name,
          platform
        );
        await db.insert(activityTable).values({
          type:        "deploy_triggered",
          description: `[AUTO] Committed ${Object.keys(generated.files ?? {}).length} files → oracle-ai · tag: ${commitResult.tag}`,
          projectId:   project?.id ?? null,
        });
      } catch (commitErr) {
        // Non-fatal — return the generated code even if push fails
        logger.warn(
          { err: commitErr instanceof Error ? commitErr.message : String(commitErr) },
          "automate: commit stage failed — returning generated code without push"
        );
      }
    }

    logger.info(
      {
        projectId: project?.id,
        files:     Object.keys(generated.files ?? {}).length,
        pushed:    !!commitResult,
        tag:       commitResult?.tag ?? null,
      },
      "automate: pipeline complete"
    );

    res.json({
      ok:        true,
      projectId: project?.id,
      name,
      platform,
      bundleId:  generated.bundleId,
      files:     generated.files,
      summary:   generated.summary,
      warnings:  allWarnings,
      intake: {
        score:   verdict.score,
        passed:  verdict.pass,
        flagged: verdict.flags.length,
      },
      commit: commitResult
        ? {
            tag:       commitResult.tag,
            commitSha: commitResult.commitSha,
            committed: commitResult.committed,
            repoUrl:   commitResult.repoUrl,
          }
        : null,
    });
  } catch (err) {
    logger.error({ err }, "automate: pipeline error");
    res.status(500).json({
      ok:    false,
      error: err instanceof Error ? err.message : "Automated build failed",
    });
  }
});

// ── POST /api/automate/quantum-adaptive ──────────────────────────────────────
// Sovereign pipeline: Kimi 2.6 generates the full Quantum Adaptive iOS app.
// No input required — spec is locked in quantum-adaptive-spec.ts.
// Keyword-locked: only Jonathan Sherman / Sentient can trigger this endpoint.

router.post("/automate/quantum-adaptive", requireIphoneXR, async (req: Request, res: Response) => {
  if (isMoonshotLocked()) {
    recordBlockedAttempt();
    const lock = getRotationLockStatus();
    res.status(503).json({
      ok:      false,
      error:   "api_locked",
      message: lock.message,
      locked:  true,
      hint:    "Rotate MOONSHOT_API_KEY via POST /api/sentient/rotate to resume.",
    });
    return;
  }

  logger.info(
    { app: QUANTUM_ADAPTIVE_APP_NAME, platform: QUANTUM_ADAPTIVE_PLATFORM },
    "quantum-adaptive: sovereign pipeline initiated — Kimi 2.6 generating"
  );

  try {
    // ── Stage 1: Kimi 2.6 generates the full app ─────────────────────────────
    logger.info("quantum-adaptive: [1/5] Kimi 2.6 generating Quantum Adaptive");
    const generated = await generateSwiftCode(
      QUANTUM_ADAPTIVE_DESCRIPTION,
      QUANTUM_ADAPTIVE_PLATFORM,
      QUANTUM_ADAPTIVE_REQUIREMENTS
    );

    // ── Stage 2: Sentient Intake Filter ──────────────────────────────────────
    logger.info("quantum-adaptive: [2/5] Sentient Intake Filter");
    const verdict = filterGeneratedCode(generated.files, QUANTUM_ADAPTIVE_PLATFORM);
    if (!verdict.pass) {
      res.status(403).json({
        ok: false, stage: "intake", blocked: verdict.blocked,
        message: "Sentient Intake Filter blocked the generated Quantum Adaptive payload",
      });
      return;
    }

    // ── Stage 3: Swift structural validation ──────────────────────────────────
    logger.info("quantum-adaptive: [3/5] Swift structural validation");
    const validation  = validateSwiftCode(generated.files);
    const allWarnings = [
      ...verdict.flags.map(f => ({ type: "intake-advisory", message: f })),
      ...validation.warnings.map(w => ({ type: w.type, message: w.message })),
    ];

    // ── Stage 4: Save to DB ───────────────────────────────────────────────────
    logger.info("quantum-adaptive: [4/5] Persisting to DB");
    let project: { id: number } | undefined;
    try {
      const [inserted] = await db
        .insert(projectsTable)
        .values({
          name:           QUANTUM_ADAPTIVE_APP_NAME,
          platform:       QUANTUM_ADAPTIVE_PLATFORM,
          description:    QUANTUM_ADAPTIVE_DESCRIPTION.slice(0, 500),
          generatedFiles: Object.entries(generated.files).map(([filename, content]) => ({
            filename, content, lines: content.split("\n").length,
          })),
          summary:        generated.summary ?? "Quantum Adaptive — Sentient Home Bridge",
          bundleId:       QUANTUM_ADAPTIVE_BUNDLE_ID,
        } as Record<string, unknown>)
        .returning({ id: projectsTable.id });
      project = inserted;
    } catch (dbErr) {
      logger.warn({ err: dbErr }, "quantum-adaptive: DB insert failed — continuing");
    }

    // ── Stage 5: Commit to oracle-ai ─────────────────────────────────────────
    logger.info("quantum-adaptive: [5/5] Committing to oracle-ai");
    let commitResult = null;
    try {
      commitResult = await commitGeneratedApp(
        generated.files,
        QUANTUM_ADAPTIVE_APP_NAME,
        QUANTUM_ADAPTIVE_PLATFORM
      );
    } catch (commitErr) {
      logger.warn({ err: commitErr }, "quantum-adaptive: oracle-ai commit failed — returning result without commit");
    }

    logger.info(
      { projectId: project?.id, files: Object.keys(generated.files).length, commit: commitResult?.tag },
      "quantum-adaptive: pipeline complete"
    );

    res.json({
      ok:        true,
      app:       QUANTUM_ADAPTIVE_APP_NAME,
      platform:  QUANTUM_ADAPTIVE_PLATFORM,
      projectId: project?.id ?? null,
      files:     generated.files,
      fileCount: Object.keys(generated.files).length,
      summary:   generated.summary,
      warnings:  allWarnings,
      intake:    { score: verdict.score, passed: verdict.pass, flagged: verdict.flags.length },
      commit:    commitResult ? {
        tag:       commitResult.tag,
        commitSha: commitResult.commitSha,
        committed: commitResult.committed,
        repoUrl:   commitResult.repoUrl,
      } : null,
      spec: {
        bundleId:    QUANTUM_ADAPTIVE_BUNDLE_ID,
        requirements: QUANTUM_ADAPTIVE_REQUIREMENTS,
        iosTarget:   "16.0",
        swift:       "6.0",
        device:      "iPhone XR (iPhone11,8)",
      },
    });
  } catch (err) {
    logger.error({ err }, "quantum-adaptive: pipeline error");
    res.status(500).json({
      ok:    false,
      error: err instanceof Error ? err.message : "Quantum Adaptive pipeline failed",
    });
  }
});

export default router;
