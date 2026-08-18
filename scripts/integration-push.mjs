#!/usr/bin/env node
/**
 * © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1
 * S1AF — Sentient iOS One-Step App Framework · Sovereign ID: 1
 * integration-push.mjs — Push changed files to oracle-ai/main via GitHub API.
 * Called by POST /sentient/git-push. Uses GITHUB_PAT or REPLIT connector token.
 */

import { execSync }  from "child_process";
import { readFileSync } from "fs";
import { join, relative } from "path";

const OWNER   = "jonathanEIDfounder";
const REPO    = "oracle-ai";
const BRANCH  = "main";
const REPO_ROOT = new URL("../", import.meta.url).pathname;

// ── Resolve token ─────────────────────────────────────────────────────────────
let TOKEN = (process.env.GITHUB_PAT ?? "").trim();

// Validate — reject short placeholders
if (TOKEN.length < 20) {
  try {
    const cipher = join(REPO_ROOT, "scripts", "pat-cipher.sh");
    TOKEN = execSync(
      `bash -c 'source "${cipher}" && s1af_decrypt_named github-pat'`,
      { encoding: "utf8", timeout: 10_000 }
    ).trim();
  } catch { TOKEN = ""; }
}

if (!TOKEN || TOKEN.includes("TEST") || TOKEN.length < 20) {
  console.error("✗ No valid GitHub token available");
  process.exit(1);
}

// ── Get changed files vs remote ───────────────────────────────────────────────
let changedFiles;
try {
  const out = execSync(
    "git diff gitsafe-backup/main..HEAD --name-only 2>/dev/null || " +
    "git diff HEAD~5..HEAD --name-only 2>/dev/null",
    { cwd: REPO_ROOT, encoding: "utf8", timeout: 15_000 }
  ).trim();
  changedFiles = out ? out.split("\n").filter(Boolean) : [];
} catch {
  changedFiles = [];
}

if (!changedFiles.length) {
  console.log("– No changed files to push");
  process.exit(0);
}

// ── Push each file via GitHub Contents API ────────────────────────────────────
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
  "User-Agent": "S1AF-auto-run/1.0",
};

let pushed = 0, errors = 0;

for (const filePath of changedFiles) {
  const absPath = join(REPO_ROOT, filePath);
  let content;
  try {
    content = readFileSync(absPath, "utf8");
  } catch {
    console.log(`– SKIP (unreadable): ${filePath}`);
    continue;
  }

  const contentB64 = Buffer.from(content).toString("base64");

  // Get existing SHA
  let existingSha = null;
  try {
    const checkResp = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`,
      { headers }
    );
    if (checkResp.ok) {
      const d = await checkResp.json();
      existingSha = d.sha ?? null;
    }
  } catch { /* new file */ }

  const body = {
    message: `S1AF — ${filePath.split("/").pop()} [OCSO-S1AF-GOV-1 auto-run]`,
    content: contentB64,
    branch:  BRANCH,
    ...(existingSha ? { sha: existingSha } : {}),
  };

  try {
    const pushResp = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`,
      { method: "PUT", headers, body: JSON.stringify(body) }
    );
    const data = await pushResp.json();
    if (pushResp.ok) {
      console.log(`✓ ${pushResp.status === 201 ? "created" : "updated"}: ${filePath}`);
      pushed++;
    } else {
      console.error(`✗ [${pushResp.status}] ${filePath}: ${data.message ?? "unknown error"}`);
      errors++;
    }
  } catch (e) {
    console.error(`✗ ERROR: ${filePath}: ${e.message}`);
    errors++;
  }

  await new Promise(r => setTimeout(r, 300));
}

console.log(`\nPushed: ${pushed}  Errors: ${errors}`);
if (errors > 0) process.exit(1);
