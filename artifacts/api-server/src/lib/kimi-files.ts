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

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;


/**
 * © 2026 Jonathan Sherman — S1AF (Sentient iOS One-Step App Framework)
 * Sovereign ID: 1 · All rights reserved.
 *
 * Moonshot Files API client.
 * Handles upload, list, content extraction, and deletion of file attachments
 * that are injected as context into Kimi generation / chat calls.
 *
 * Moonshot Files API reference:
 *   POST   /v1/files                       — upload (purpose: file-extract)
 *   GET    /v1/files                       — list
 *   GET    /v1/files/{id}/content          — extracted text
 *   DELETE /v1/files/{id}                  — delete
 */

const MOONSHOT_BASE = "https://api.moonshot.cn/v1";

/** Maximum characters of extracted file content injected per file. */
export const MAX_FILE_CONTENT_CHARS = 40_000;

/** Maximum total attachment context characters injected into a single prompt. */
export const MAX_TOTAL_ATTACHMENT_CHARS = 100_000;

function getApiKey(): string {
  // Prefer live CONFIG (patchable via sentient-rotate) over process.env
  const { CONFIG } = require("./config") as { CONFIG: { moonshotKey?: string } };
  const key = CONFIG.moonshotKey ?? process.env.MOONSHOT_API_KEY;
  if (!key) throw new Error("MOONSHOT_API_KEY is not set — rotate via /api/sentient/rotate");
  return key;
}

function authHeaders(): HeadersInit {
  return { Authorization: `Bearer ${getApiKey()}` };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MoonshotFile {
  id: string;
  object: string;
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
  status: string;
  status_details?: string;
}

// ── API calls ─────────────────────────────────────────────────────────────────

/**
 * Upload a file buffer to the Moonshot Files API.
 * Uses purpose="file-extract" so the platform extracts readable text.
 */
export async function uploadToMoonshot(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<MoonshotFile> {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType }), filename);
  form.append("purpose", "file-extract");

  const res = await fetch(`${MOONSHOT_BASE}/files`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Moonshot upload ${res.status}: ${text}`);
  }

  return res.json() as Promise<MoonshotFile>;
}

/** List all files stored for this API key. */
export async function listMoonshotFiles(): Promise<MoonshotFile[]> {
  const res = await fetch(`${MOONSHOT_BASE}/files`, { headers: authHeaders() });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Moonshot list ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { data: MoonshotFile[] };
  return data.data ?? [];
}

/**
 * Fetch the extracted text content of a file.
 * Truncates to MAX_FILE_CONTENT_CHARS to avoid prompt overflows.
 */
export async function getMoonshotFileContent(fileId: string): Promise<string> {
  const res = await fetch(`${MOONSHOT_BASE}/files/${fileId}/content`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Moonshot file content ${res.status}: ${text}`);
  }

  const text = await res.text();
  return text.length > MAX_FILE_CONTENT_CHARS
    ? text.slice(0, MAX_FILE_CONTENT_CHARS) + "\n…[truncated]"
    : text;
}

/** Delete a file from Moonshot storage. */
export async function deleteMoonshotFile(fileId: string): Promise<void> {
  const res = await fetch(`${MOONSHOT_BASE}/files/${fileId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Moonshot delete ${res.status}: ${text}`);
  }
}

/**
 * Fetch content for multiple file IDs and assemble an attachment context block
 * ready to prepend to a Kimi prompt.
 *
 * Returns an empty string when fileIds is empty.
 */
export async function buildAttachmentContext(fileIds: string[]): Promise<string> {
  if (!fileIds.length) return "";

  const contents = await Promise.allSettled(
    fileIds.map((id) => getMoonshotFileContent(id)),
  );

  const blocks: string[] = [];
  let total = 0;

  for (let i = 0; i < contents.length; i++) {
    const r = contents[i];
    if (r.status === "rejected") {
      blocks.push(`[Attachment ${fileIds[i]}: failed to load — ${r.reason}]`);
      continue;
    }
    const snippet =
      total + r.value.length > MAX_TOTAL_ATTACHMENT_CHARS
        ? r.value.slice(0, MAX_TOTAL_ATTACHMENT_CHARS - total) + "\n…[global limit reached]"
        : r.value;
    total += snippet.length;
    blocks.push(`--- Attached file ${i + 1} (id: ${fileIds[i]}) ---\n${snippet}`);
    if (total >= MAX_TOTAL_ATTACHMENT_CHARS) break;
  }

  return (
    "=== USER-PROVIDED ATTACHMENTS ===\n" +
    "The following documents were attached by the user. Use them as primary source material.\n\n" +
    blocks.join("\n\n") +
    "\n\n=== END ATTACHMENTS ==="
  );
}
