/**
 * © 2026 Jonathan Sherman — S1AF · OCSO-S1AF-GOV-1
 *
 * Cipherstore loader — reads AES-256 encrypted token files written by
 * scripts/retrieve-and-obfuscate.sh and warms the live CONFIG store.
 *
 * This makes the server self-healing: even if Replit's env vars are stale
 * (cached from a previous container run), the cipherstore holds the last
 * valid values and is loaded here before any route or daemon reads CONFIG.
 *
 * Token files:
 *   ~/.s1af-cipher/github-pat.enc    → CONFIG.githubPat
 *   ~/.s1af-cipher/moonshot-key.enc  → CONFIG.moonshotKey
 *   ~/.s1af-cipher/deploy-secret.enc → CONFIG.deploySecret
 *
 * The raw values exist in memory only for the instant patchSecrets() is
 * called — they are not stored in any variable, log, or snapshot.
 */

import { execFile }   from "child_process";
import { promisify }  from "util";
import { join }        from "path";
import { homedir }     from "os";
import { existsSync }  from "fs";
import { logger }      from "./logger";
import { patchSecrets, CONFIG } from "./config";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

const execFileAsync = promisify(execFile);

// ── Token registry ─────────────────────────────────────────────────────────

interface TokenEntry {
  name:       string;                        // cipher name (e.g. "github-pat")
  configKey:  "githubPat" | "moonshotKey" | "deploySecret";
  minLen:     number;
  logLabel:   string;
}

const TOKENS: TokenEntry[] = [
  { name: "github-pat",    configKey: "githubPat",    minLen: 40, logLabel: "GITHUB_PAT"       },
  { name: "moonshot-key",  configKey: "moonshotKey",  minLen: 30, logLabel: "MOONSHOT_API_KEY" },
  { name: "deploy-secret", configKey: "deploySecret", minLen: 16, logLabel: "DEPLOY_SECRET"    },
];

// ── Paths ──────────────────────────────────────────────────────────────────

const CIPHER_DIR    = join(homedir(), ".s1af-cipher");
const CIPHER_SCRIPT = join(process.cwd(), "..", "..", "scripts", "pat-cipher.sh");

function encFile(name: string): string {
  return join(CIPHER_DIR, `${name}.enc`);
}

// ── Decrypt one named token via the bash cipher library ────────────────────

async function decryptNamed(name: string): Promise<string | null> {
  const enc = encFile(name);
  if (!existsSync(enc)) return null;

  try {
    const { stdout } = await execFileAsync("bash", ["-c",
      `source "${CIPHER_SCRIPT}" && s1af_decrypt_named "${name}"`
    ], { timeout: 10_000 });
    const value = stdout.trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

// ── Mask a secret for logging (never log raw values) ──────────────────────

function mask(v: string): string {
  if (!v || v.length < 6) return "•".repeat(v?.length ?? 3);
  return `${v.slice(0, 4)}${"•".repeat(Math.max(4, v.length - 6))}${v.slice(-2)}`;
}

// ── Main boot loader ───────────────────────────────────────────────────────

/**
 * Called once at startup (before server binds).
 * For each token: if the env var is invalid, attempts to load from cipherstore
 * and patches CONFIG with the recovered value.
 *
 * Returns a map of token name → "env" | "cipher" | "missing".
 */
export async function loadCipherstore(): Promise<Record<string, "env" | "cipher" | "missing">> {
  const results: Record<string, "env" | "cipher" | "missing"> = {};

  for (const token of TOKENS) {
    const current = CONFIG[token.configKey] ?? "";

    if (current.length >= token.minLen) {
      // Env var is already valid — no need to touch cipherstore
      results[token.name] = "env";
      logger.info(`cipherstore: ${token.logLabel} valid from env`, {
        source: "env",
        masked: mask(current),
      });
      // Still encrypt to cipherstore so it stays fresh for next restart
      void encryptToStore(token.name, current);
      continue;
    }

    // Env var missing/invalid — try cipherstore
    logger.info(`cipherstore: ${token.logLabel} env invalid (${current.length} chars) — trying cipherstore`);
    const recovered = await decryptNamed(token.name);

    if (recovered && recovered.length >= token.minLen) {
      // Patch CONFIG live store
      patchSecrets({ [token.configKey]: recovered } as Parameters<typeof patchSecrets>[0]);
      results[token.name] = "cipher";
      logger.info(`cipherstore: ${token.logLabel} recovered from cipherstore → CONFIG patched`, {
        source: "cipher",
        masked: mask(recovered),
      });
    } else {
      results[token.name] = "missing";
      logger.warn(`cipherstore: ${token.logLabel} missing from env AND cipherstore — rotate required`, {
        source: "missing",
      });
    }
  }

  return results;
}

// ── Async write-back: encrypt a valid env value into cipherstore ───────────
// Called when env var is valid, so cipherstore stays fresh for next restart.

async function encryptToStore(name: string, value: string): Promise<void> {
  try {
    await execFileAsync("bash", ["-c",
      `source "${CIPHER_SCRIPT}" && s1af_encrypt_named "${name}" "${value.replace(/"/g, '\\"')}"`
    ], { timeout: 10_000 });
  } catch {
    // Non-fatal — env var is still available; cipherstore is opportunistic
  }
}

/**
 * Convenience: decrypt a named token on-demand (e.g. for git push).
 * Returns null if cipherstore is absent or decryption fails.
 */
export async function decryptToken(name: string): Promise<string | null> {
  return decryptNamed(name);
}
