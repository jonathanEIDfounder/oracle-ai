/**
 * GitHub Commit Pipeline — S1AF Automated Push Layer
 *
 * Commits generated Swift project files directly to oracle-ai via the
 * GitHub Contents API, then creates a sovereign signed tag.
 * No local git. No human touch. One call, fully automated.
 *
 * Governed exclusively by Jonathan Sherman — OCSO-S1AF-GOV-1.
 */

import { CONFIG } from "./config";
import { logger } from "./logger";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

const GH_API = "https://api.github.com";
const { owner, repo, branch } = CONFIG.github;

function authHeader(): Record<string, string> {
  const pat = CONFIG.githubPat;
  if (!pat) throw new Error("GITHUB_PAT not available — rotate via in-app banner");
  return {
    Authorization: `Bearer ${pat}`,
    Accept:        "application/vnd.github.v3+json",
    "Content-Type": "application/json",
    "User-Agent":   "S1AF-AutoBuild/1.0",
  };
}

/** Fetch the current blob SHA for a file (needed to update existing files). */
async function getFileSha(path: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      `${GH_API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      { headers: authHeader() }
    );
    if (res.status === 404) return undefined;
    if (!res.ok) return undefined;
    const data = (await res.json()) as { sha?: string };
    return data.sha;
  } catch {
    return undefined;
  }
}

/** Upsert a single file into oracle-ai. */
async function upsertFile(
  path:    string,
  content: string,
  message: string
): Promise<{ sha: string; path: string }> {
  const sha  = await getFileSha(path);
  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content, "utf-8").toString("base64"),
    branch,
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    `${GH_API}/repos/${owner}/${repo}/contents/${path}`,
    { method: "PUT", headers: authHeader(), body: JSON.stringify(body) }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub upsert failed for ${path}: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { content?: { sha?: string; path?: string } };
  return {
    sha:  data.content?.sha  ?? "unknown",
    path: data.content?.path ?? path,
  };
}

/** Get the HEAD commit SHA for the branch. */
async function getHeadSha(): Promise<string> {
  const res = await fetch(
    `${GH_API}/repos/${owner}/${repo}/git/ref/heads/${branch}`,
    { headers: authHeader() }
  );
  if (!res.ok) throw new Error(`Failed to get HEAD SHA: ${res.status}`);
  const data = (await res.json()) as { object?: { sha?: string } };
  return data.object?.sha ?? "";
}

/** Create an annotated tag pointing at the current HEAD. */
async function createTag(tagName: string, message: string): Promise<string> {
  const headSha = await getHeadSha();

  // 1. Create the tag object
  const tagRes = await fetch(
    `${GH_API}/repos/${owner}/${repo}/git/tags`,
    {
      method:  "POST",
      headers: authHeader(),
      body: JSON.stringify({
        tag:     tagName,
        message,
        object:  headSha,
        type:    "commit",
        tagger: {
          name:  "Jonathan Sherman",
          email: "sovereign@s1af.io",
          date:  new Date().toISOString(),
        },
      }),
    }
  );
  if (!tagRes.ok) {
    const err = await tagRes.text();
    throw new Error(`Failed to create tag object: ${tagRes.status} ${err}`);
  }
  const tagObj = (await tagRes.json()) as { sha?: string };
  const tagSha = tagObj.sha ?? headSha;

  // 2. Create the ref
  const refRes = await fetch(
    `${GH_API}/repos/${owner}/${repo}/git/refs`,
    {
      method:  "POST",
      headers: authHeader(),
      body: JSON.stringify({ ref: `refs/tags/${tagName}`, sha: tagSha }),
    }
  );
  if (!refRes.ok) {
    // Tag may already exist — not fatal
    logger.warn({ tag: tagName }, "github-commit: tag ref already exists — skipping");
  }

  return tagSha;
}

export interface CommitResult {
  committed:   string[];          // file paths committed
  commitSha:   string;            // HEAD SHA after push
  tag:         string;            // tag name created
  tagSha:      string;            // tag SHA
  repoUrl:     string;            // link to the commit on GitHub
}

/**
 * Commit all generated Swift files to oracle-ai and create a sovereign tag.
 *
 * @param files      Map of relative file path → Swift source content
 * @param appName    Human-readable app name (used in commit message + tag)
 * @param platform   "ios" | "macos"
 */
export async function commitGeneratedApp(
  files:    Record<string, string>,
  appName:  string,
  platform: string
): Promise<CommitResult> {
  const ts       = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  const safeName = appName.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 40);
  const tagName  = `s1af-${platform}-${safeName}-${ts}`;
  const message  =
    `S1AF ${platform.toUpperCase()} native — iPhone XR Metal binding — Jonathan Sherman\n\n` +
    `App: ${appName}\nPlatform: ${platform}\nSovereign ID: 1\nGovernor: OCSO-S1AF-GOV-1\n` +
    `Generated by Kimi 2.6 · Intake filtered · Auto-committed — no human in loop`;

  logger.info({ files: Object.keys(files).length, appName, platform }, "github-commit: beginning auto-commit");

  const basePath = `apps/${safeName}`;
  const committed: string[] = [];

  // Commit files sequentially (GitHub API rate limit consideration)
  for (const [filename, content] of Object.entries(files)) {
    const repoPath = `${basePath}/${filename}`;
    try {
      await upsertFile(repoPath, content, `[${appName}] ${filename} — ${message.split("\n")[0]}`);
      committed.push(repoPath);
      logger.debug({ path: repoPath }, "github-commit: file committed");
    } catch (err) {
      logger.warn(
        { path: repoPath, err: err instanceof Error ? err.message : String(err) },
        "github-commit: file commit failed — continuing"
      );
    }
  }

  // Create sovereign tag
  let tagSha = "";
  try {
    tagSha = await createTag(tagName, message);
    logger.info({ tag: tagName, sha: tagSha }, "github-commit: sovereign tag created");
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "github-commit: tag creation failed — non-fatal");
  }

  const commitSha = await getHeadSha().catch(() => "unknown");

  return {
    committed,
    commitSha,
    tag:     tagName,
    tagSha,
    repoUrl: `https://github.com/${owner}/${repo}/tree/${branch}/${basePath}`,
  };
}
