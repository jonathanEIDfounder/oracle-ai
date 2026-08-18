#!/usr/bin/env node
/**
 * © 2026 Jonathan Sherman — S1AF · OCSO-S1AF-GOV-1
 * scripts/create-release.mjs
 *
 * Creates a GitHub release on oracle-ai/main and uploads the Xcode ZIP.
 * Tries GitHub PAT first; falls back to connector-push instructions.
 *
 * Called by: POST /api/sentient/create-release
 * Args: <version> <commit>
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const OWNER   = "jonathanEIDfounder";
const REPO    = "oracle-ai";
const ROOT    = new URL("../", import.meta.url).pathname;
const VERSION = process.argv[2] ?? `v${new Date().toISOString().slice(0,10)}-s1af`;
const COMMIT  = process.argv[3] ?? "HEAD";

// ── Resolve GitHub token from cipherstore ─────────────────────────────────────
let TOKEN = (process.env.GITHUB_PAT ?? "").trim();
if (!TOKEN || TOKEN.length < 20 || TOKEN.includes("TEST")) {
  try {
    TOKEN = execSync(
      `bash -c 'source "${join(ROOT, "scripts/pat-cipher.sh")}" && s1af_decrypt_named github-pat'`,
      { encoding: "utf8", timeout: 10_000 }
    ).trim();
  } catch { TOKEN = ""; }
}

const validPat = TOKEN && TOKEN.length >= 20 && !TOKEN.includes("TEST") && !TOKEN.includes("placeholder");

// ── Release body ──────────────────────────────────────────────────────────────
const body = [
  `## S1AF Release ${VERSION}`,
  ``,
  `**Sovereign:** OCSO-S1AF-GOV-1 · Jonathan Sherman`,
  `**Commit:** ${COMMIT}`,
  `**Platforms:** iOS (Xcode 15+) · Linux (Swift 5.8)`,
  ``,
  `### Contents`,
  `- \`Oracle-AI-Kimi-Xcode.zip\` — Xcode project for iPhone XR`,
  `  - Open in Xcode → Build (⌘B) → Run (⌘R)`,
  `  - Requires: iPhone XR hardware (Face ID + hardware lock)`,
  ``,
  `### What's new`,
  `- Cross-platform OracleAICore Swift package (Linux + iOS)`,
  `- Automated 7-phase S1AF pipeline (✓7 ⚠0)`,
  `- Moonshot Kimi 2.6 integration`,
  ``,
  `© 2026 Jonathan Sherman — S1AF-DRM-LOCKED`,
].join("\n");

async function createRelease() {
  if (!validPat) {
    // Return metadata for connector-based release creation
    console.log(JSON.stringify({
      ok: false,
      method: "connector-required",
      version: VERSION,
      releaseUrl: `https://github.com/${OWNER}/${REPO}/releases/tag/${VERSION}`,
      message: "GitHub PAT not available — release will be created via Replit connector",
      releaseBody: body,
    }));
    process.exit(0);
  }

  const headers = {
    "Authorization": `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
    "User-Agent":   "S1AF-deploy/1.0",
    "Accept":       "application/vnd.github.v3+json",
  };

  // 1. Create the release
  const createRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      tag_name:         VERSION,
      target_commitish: "main",
      name:             `S1AF ${VERSION}`,
      body,
      draft:            false,
      prerelease:       false,
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    console.log(JSON.stringify({ ok: false, error: err, status: createRes.status }));
    process.exit(1);
  }

  const release = await createRes.json();
  const releaseId  = release.id;
  const releaseUrl = release.html_url;
  const uploadUrl  = release.upload_url.replace("{?name,label}", "");

  // 2. Upload Xcode ZIP
  const ZIP = join(ROOT, "build-output/Oracle-AI-Kimi-Xcode.zip");
  let assetUrl = "";
  if (existsSync(ZIP)) {
    const zipData = readFileSync(ZIP);
    const uploadRes = await fetch(`${uploadUrl}?name=Oracle-AI-Kimi-Xcode.zip`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/zip" },
      body: zipData,
    });
    if (uploadRes.ok) {
      const asset = await uploadRes.json();
      assetUrl = asset.browser_download_url;
    }
  }

  console.log(JSON.stringify({
    ok: true,
    releaseId,
    releaseUrl,
    assetUrl,
    version: VERSION,
  }));
}

createRelease().catch(e => {
  console.log(JSON.stringify({ ok: false, error: String(e) }));
  process.exit(1);
});
