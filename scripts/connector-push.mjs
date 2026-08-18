#!/usr/bin/env node
/**
 * © 2026 Jonathan Sherman — S1AF · OCSO-S1AF-GOV-1
 * scripts/connector-push.mjs
 *
 * Reusable GitHub push via Replit connector (Octokit / proxyFetch).
 * MUST be called from the CodeExecution sandbox — listConnections,
 * conn.getClient(), and conn.proxyFetch() are sandbox-only APIs.
 *
 * This module is the groundwork for Task #72 (server-side connector relay).
 *
 * Usage from CodeExecution:
 *   import { pushFiles, CONN_ID, OWNER, REPO, BRANCH } from './scripts/connector-push.mjs';
 *   // pass listConnections from the sandbox scope
 *   const results = await pushFiles({ files, listConnections });
 */

export const CONN_ID = "conn_github_01KA362WTY0G2Q4XBNC7KMRB8D";
export const OWNER   = "jonathanEIDfounder";
export const REPO    = "oracle-ai";
export const BRANCH  = "main";

// Source directories + extensions for a full sync
export const SYNC_DIRS = ["scripts", "artifacts/api-server/src", "AARTE-iOS-App"];
export const SYNC_EXT  = [".sh", ".mjs", ".ts", ".swift", ".plist", ".yml"];
export const SYNC_EXCL = [".d.ts", ".map", "node_modules/", "dist/"];

/**
 * Push workspace files to GitHub via the Replit connector.
 *
 * @param {object}   opts
 * @param {string[]} opts.files            - workspace-relative paths to push
 * @param {Function} opts.listConnections  - listConnections from CodeExecution sandbox
 * @param {string}  [opts.owner]
 * @param {string}  [opts.repo]
 * @param {string}  [opts.branch]
 * @returns {Promise<Array<{file, ok, code?, error?}>>}
 */
export async function pushFiles({
  files,
  listConnections: lc,
  owner  = OWNER,
  repo   = REPO,
  branch = BRANCH,
}) {
  const { readFile } = await import("node:fs/promises");
  const { join }     = await import("node:path");
  const ROOT         = "/home/runner/workspace";

  const conns = await lc("github");
  if (!conns?.length) throw new Error("GitHub connector not available");
  const conn = conns[0];

  const results = [];

  for (const relPath of files) {
    try {
      const content = await readFile(join(ROOT, relPath), "utf8");
      const b64     = Buffer.from(content).toString("base64");

      // Get current remote SHA (required for update; absent for new files)
      const getRes    = await conn.proxyFetch(
        `/repos/${owner}/${repo}/contents/${relPath}?ref=${branch}`
      );
      const remoteSha = getRes.status === 200
        ? (await getRes.json()).sha
        : null;

      const putRes = await conn.proxyFetch(
        `/repos/${owner}/${repo}/contents/${relPath}`,
        {
          method:  "PUT",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            message: `S1AF: sync ${relPath} — OCSO-S1AF-GOV-1`,
            content: b64,
            branch,
            ...(remoteSha ? { sha: remoteSha } : {}),
          }),
        }
      );

      const ok = putRes.status === 200 || putRes.status === 201;
      results.push({ file: relPath, ok, code: putRes.status });
    } catch (e) {
      results.push({ file: relPath, ok: false, error: String(e) });
    }
  }

  return results;
}
