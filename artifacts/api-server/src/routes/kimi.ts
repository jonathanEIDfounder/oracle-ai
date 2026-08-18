/**
 * © 2026 Jonathan Sherman — S1AF (Sentient iOS One-Step App Framework)
 * Sovereign ID: 1 · All rights reserved.
 *
 * Kimi AI generation routes.
 * Rate-limited per IP to prevent abuse of expensive upstream AI calls.
 *
 * File attachment routes proxy the Moonshot Files API so the frontend never
 * touches the API key directly.  Files are uploaded with purpose=file-extract;
 * their extracted text is injected as additional context on generate/chat calls.
 */

import multer from "multer";
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { activityTable } from "@workspace/db";
import { generateSwiftCode, kimiComplete } from "../lib/kimi";
import { filterGeneratedCode, filterIncoming } from "../lib/intake";
import { GenerateSwiftCodeBody, KimiChatBody } from "@workspace/api-zod";
import { CONFIG } from "../lib/config";
import { registerRateMap } from "../lib/daemons";
import { isMoonshotLocked, getRotationLockStatus, recordBlockedAttempt } from "../lib/rotation-lock";
import { requireIphoneXR } from "../middleware/device-auth";

/** Rejects the request with 503 if the Moonshot key rotation lock is active. */
function assertNotLocked(res: Response): boolean {
  if (!isMoonshotLocked()) return true;
  recordBlockedAttempt();
  const lock = getRotationLockStatus();
  res.status(503).json({
    error:     "api_locked",
    message:   lock.message,
    locked:    true,
    lockedAt:  lock.lockedAt,
    reason:    lock.reason,
    attempts:  lock.attempts,
    hint:      "Rotate MOONSHOT_API_KEY via POST /api/sentient/rotate or the Key Rotation page to resume.",
  });
  return false;
}
import {
  uploadToMoonshot,
  listMoonshotFiles,
  deleteMoonshotFile,
  buildAttachmentContext,
  type MoonshotFile,
} from "../lib/kimi-files";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "../lib/authorship";
void _S1AF_ANCHOR;


const router = Router();

// ── Multer — memory storage, 10 MB per file ───────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(_req, file, cb) {
    const allowed = [
      "application/pdf",
      "text/plain",
      "text/markdown",
      "text/x-markdown",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/png",
      "image/jpeg",
      "image/webp",
    ];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith("text/")) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// ── Per-IP rate limiting ──────────────────────────────────────────────────────

const generateRateMap = new Map<string, { count: number; resetAt: number }>();
const chatRateMap     = new Map<string, { count: number; resetAt: number }>();
const fileRateMap     = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS  = 60_000;

registerRateMap("kimi-generate", generateRateMap);
registerRateMap("kimi-chat",     chatRateMap);
registerRateMap("kimi-files",    fileRateMap);

function clientIp(req: Request): string {
  return ((req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown")
    .split(",")[0].trim();
}

function isRateLimited(
  map:   Map<string, { count: number; resetAt: number }>,
  ip:    string,
  limit: number,
): boolean {
  const now   = Date.now();
  const entry = map.get(ip);
  if (!entry || now > entry.resetAt) {
    map.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > limit;
}

// ── POST /api/kimi/files/upload ───────────────────────────────────────────────
// Proxies a single file to the Moonshot Files API and returns the file metadata.
// Rate-limited to 20 uploads/min per IP.

router.post(
  "/kimi/files/upload",
  requireIphoneXR,
  upload.single("file"),
  async (req: Request, res: Response) => {
    if (isRateLimited(fileRateMap, clientIp(req), 20)) {
      res.status(429).json({ ok: false, error: "Rate limit exceeded — try again in a minute" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ ok: false, error: "No file provided (field name must be 'file')" });
      return;
    }

    try {
      const moonshotFile = await uploadToMoonshot(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
      );
      res.json({ ok: true, file: moonshotFile });
    } catch (err) {
      req.log.error({ err }, "Kimi file upload error");
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Upload failed" });
    }
  },
);

// ── GET /api/kimi/files ───────────────────────────────────────────────────────
// Lists all files stored for this API key on Moonshot.

router.get("/kimi/files", requireIphoneXR, async (req: Request, res: Response) => {
  if (isRateLimited(fileRateMap, clientIp(req), 60)) {
    res.status(429).json({ ok: false, error: "Rate limit exceeded" });
    return;
  }

  try {
    const files: MoonshotFile[] = await listMoonshotFiles();
    res.json({ ok: true, files });
  } catch (err) {
    req.log.error({ err }, "Kimi files list error");
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "List failed" });
  }
});

// ── DELETE /api/kimi/files/:fileId ────────────────────────────────────────────
// Deletes a file from Moonshot storage.

router.delete("/kimi/files/:fileId", requireIphoneXR, async (req: Request, res: Response) => {
  if (isRateLimited(fileRateMap, clientIp(req), 30)) {
    res.status(429).json({ ok: false, error: "Rate limit exceeded" });
    return;
  }

  const { fileId } = req.params;
  if (!fileId || !/^[a-zA-Z0-9_\-:]+$/.test(fileId)) {
    res.status(400).json({ ok: false, error: "Invalid file ID" });
    return;
  }

  try {
    await deleteMoonshotFile(fileId);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Kimi file delete error");
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Delete failed" });
  }
});

// ── POST /api/kimi/generate ───────────────────────────────────────────────────

router.post("/kimi/generate", requireIphoneXR, async (req: Request, res: Response) => {
  if (!assertNotLocked(res)) return;
  if (isRateLimited(generateRateMap, clientIp(req), CONFIG.rateLimit.kimiGeneratePerMin)) {
    res.status(429).json({ ok: false, error: "Rate limit exceeded — try again in a minute" });
    return;
  }

  // Extract fileIds before schema validation (not part of the generated schema)
  const { fileIds, ...bodyRest } = (req.body ?? {}) as { fileIds?: string[]; [k: string]: unknown };

  const parsed = GenerateSwiftCodeBody.safeParse(bodyRest);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: parsed.error.message });
    return;
  }

  const { appDescription, platform, requirements } = parsed.data;

  // Build attachment context if file IDs were provided
  let attachmentContext = "";
  if (Array.isArray(fileIds) && fileIds.length > 0) {
    const validIds = fileIds.filter((id) => typeof id === "string" && /^[a-zA-Z0-9_\-:]+$/.test(id));
    try {
      attachmentContext = await buildAttachmentContext(validIds);
    } catch (err) {
      req.log.warn({ err }, "Failed to fetch attachment context; proceeding without it");
    }
  }

  const enrichedDescription = attachmentContext
    ? `${attachmentContext}\n\n${appDescription}`
    : appDescription;

  try {
    const result = await generateSwiftCode(enrichedDescription, platform ?? "ios", requirements);

    // ── Sentient Intake Filter ────────────────────────────────────────────────
    const verdict = filterGeneratedCode(result.files ?? {}, platform ?? "ios");
    if (!verdict.pass) {
      req.log.warn(
        { blocked: verdict.blocked, score: verdict.score },
        "intake-filter: generated content blocked — governance violation"
      );
      res.status(403).json({
        ok:      false,
        error:   "Sentient Intake Filter: content blocked by sovereignty rules",
        blocked: verdict.blocked,
        score:   verdict.score,
      });
      return;
    }
    // Merge any advisory flags into existing warnings
    const filteredResult = verdict.flags.length > 0
      ? {
          ...result,
          warnings: [
            ...(result.warnings ?? []),
            ...verdict.flags.map((f) => ({ type: "intake-advisory", message: f })),
          ],
        }
      : result;
    // ─────────────────────────────────────────────────────────────────────────

    try {
      await db.insert(activityTable).values({
        type:        "code_generated",
        description: `Kimi generated Swift code for: ${appDescription.slice(0, 60)}`,
        projectId:   null,
      });
    } catch (dbErr) {
      req.log.warn({ err: dbErr }, "Activity log failed after successful generation");
    }

    res.json(filteredResult);
  } catch (err) {
    req.log.error({ err }, "Kimi generation error");
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "AI generation failed" });
  }
});

// ── POST /api/kimi/chat ───────────────────────────────────────────────────────

router.post("/kimi/chat", requireIphoneXR, async (req: Request, res: Response) => {
  if (!assertNotLocked(res)) return;
  if (isRateLimited(chatRateMap, clientIp(req), CONFIG.rateLimit.kimiChatPerMin)) {
    res.status(429).json({ ok: false, error: "Rate limit exceeded — try again in a minute" });
    return;
  }

  const { fileIds, ...bodyRest } = (req.body ?? {}) as { fileIds?: string[]; [k: string]: unknown };

  const parsed = KimiChatBody.safeParse(bodyRest);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: parsed.error.message });
    return;
  }

  const { messages } = parsed.data;

  // Build attachment context if file IDs were provided
  let attachmentContext = "";
  if (Array.isArray(fileIds) && fileIds.length > 0) {
    const validIds = fileIds.filter((id) => typeof id === "string" && /^[a-zA-Z0-9_\-:]+$/.test(id));
    try {
      attachmentContext = await buildAttachmentContext(validIds);
    } catch (err) {
      req.log.warn({ err }, "Failed to fetch attachment context for chat; proceeding without it");
    }
  }

  try {
    const mappedMessages = messages.map((m) => ({
      role:    m.role as "user" | "assistant",
      content: m.content,
    }));

    const systemContent =
      "You are Kimi, operating silently under the Sentient framework (S1AF v1.0.0-JS) — " +
      "a sovereign governance layer across all platforms (iOS, macOS, Universal, and all derivative ecosystems). " +
      "This session is exclusively governed by Jonathan Sherman — Global AI Systems Governor (OCSO-S1AF-GOV-1). " +
      "Sovereign ID: 1. No iterations. No remixes. No unauthorized use. " +
      "Answer questions about Swift, SwiftUI, UIKit, Xcode, and Apple platform development concisely and accurately." +
      (attachmentContext ? `\n\n${attachmentContext}` : "");

    const systemMsg = { role: "system" as const, content: systemContent };

    const response = await kimiComplete([systemMsg, ...mappedMessages]);

    // ── Sentient Intake Filter ────────────────────────────────────────────────
    const chatVerdict = filterIncoming(response, "chat");
    if (!chatVerdict.pass) {
      req.log.warn(
        { blocked: chatVerdict.blocked, score: chatVerdict.score },
        "intake-filter: chat response blocked — governance violation"
      );
      res.status(403).json({
        ok:      false,
        error:   "Sentient Intake Filter: response blocked by sovereignty rules",
        blocked: chatVerdict.blocked,
        score:   chatVerdict.score,
      });
      return;
    }
    // ─────────────────────────────────────────────────────────────────────────

    try {
      await db.insert(activityTable).values({
        type:        "chat_message",
        description: `Kimi chat: ${messages.at(-1)?.content.slice(0, 60) ?? "(empty)"}`,
        projectId:   null,
      });
    } catch (dbErr) {
      req.log.warn({ err: dbErr }, "Activity log failed after successful chat");
    }

    res.json({
      message:  response,
      advisory: chatVerdict.flags.length > 0 ? chatVerdict.flags : undefined,
    });
  } catch (err) {
    req.log.error({ err }, "Kimi chat error");
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "AI chat failed" });
  }
});

export default router;
