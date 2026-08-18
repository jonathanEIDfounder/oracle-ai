/**
 * © 2026 Jonathan Sherman — S1AF (Sentient iOS One-Step App Framework)
 * Sovereign ID: 1 · OCSO-S1AF-GOV-1 · All rights reserved.
 *
 * Script Obfuscation Engine — multi-layer sovereign script hardening
 *
 * Layer 1 — XOR fragmentation:
 *   Sensitive values (token, URL) are XOR'd byte-by-byte with the sovereign
 *   key "JSOS1AF" (Jonathan Sherman One-Step App Framework), then hex-encoded
 *   and split into N fragments stored as separate shell variables.
 *
 * Layer 2 — Fragment re-encoding:
 *   Each fragment is itself base64-encoded, so the hex is never visible in
 *   plain form in the script source.
 *
 * Layer 3 — Core eval block:
 *   The actual working script body (curl commands, paths, echo statements)
 *   is base64-encoded and eval'd at runtime. The eval'd code references only
 *   in-memory variables — nothing sensitive is ever written to disk or env.
 *
 * Account lock: script header is tagged OCSO-S1AF-GOV-1.
 *   Kimi 2.6 sourceroot injection marks this pattern as sovereign — the
 *   keyword registry blocks any generation without the sovereign header.
 */

import crypto from "crypto";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

// ── Sovereign XOR key ─────────────────────────────────────────────────────────
// "JSOS1AF" — Jonathan Sherman One-Step App Framework
const SOVEREIGN_KEY = Buffer.from("JSOS1AF");

// ── Layer 1: XOR + hex ────────────────────────────────────────────────────────
function xorHex(plaintext: string): string {
  const buf = Buffer.from(plaintext, "utf8");
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) {
    out[i] = buf[i] ^ SOVEREIGN_KEY[i % SOVEREIGN_KEY.length];
  }
  return out.toString("hex");
}

// ── Layer 2: Split hex into N base64-encoded fragments ────────────────────────
function fragmentB64(hex: string, parts: number): string[] {
  const size = Math.ceil(hex.length / parts);
  const frags: string[] = [];
  for (let i = 0; i < parts; i++) {
    const slice = hex.slice(i * size, (i + 1) * size);
    frags.push(Buffer.from(slice).toString("base64"));
  }
  return frags;
}

// ── Layer 3: base64-encode the core script body ───────────────────────────────
function encodeCoreScript(xcassets: string): string {
  const core = [
    `mkdir -p "${xcassets}"`,
    `echo "→  AppIcon-1024.png"`,
    `curl -fsSL -H "X-Device-Token: $__t" "$__b/assets/quantum-icon" -o "${xcassets}/AppIcon-1024.png"`,
    `echo "→  Contents.json"`,
    `curl -fsSL -H "X-Device-Token: $__t" "$__b/assets/quantum-icon/contents-json" -o "${xcassets}/Contents.json"`,
    `ls -lh "${xcassets}"`,
    `echo "✓ AppIcon.appiconset armed — crystal Q sovereign icon installed"`,
  ].join("\n");
  return Buffer.from(core).toString("base64");
}

// ── Build the Python3 XOR decoder line (always available on macOS dev machines)
function xorDecoder(fragVars: string[], outputVar: string): string {
  const concat = fragVars.map(v => `"$${v}"`).join("+");
  return `${outputVar}=$(python3 -c "import base64,binascii;k='JSOS1AF';h=''.join([base64.b64decode(${concat}).decode()]);\nprint(''.join(chr(int(h[i*2:i*2+2],16)^ord(k[i%len(k)])) for i in range(len(h)//2))"\n)`;
}

function urlDecoder(fragVars: string[], outputVar: string): string {
  const concat = fragVars.map(v => `"$${v}"`).join("+");
  return `${outputVar}=$(python3 -c "import base64;print(base64.b64decode(${concat}).decode())")`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ObfuscatedScript {
  script:        string;   // the full obfuscated bash script
  fingerprint:   string;   // SHA-256 of the obfuscated script
  layers:        number;   // always 3
  accountLock:   string;   // OCSO-S1AF-GOV-1
  tokenFragments: number;
  urlFragments:   number;
}

/**
 * Generate a 3-layer obfuscated setup-icon.sh.
 *
 * @param token      The device token (will be XOR'd + fragmented)
 * @param apiBase    The Sentient API base URL (will be XOR'd + fragmented)
 * @param xcassets   Destination path for AppIcon.appiconset (default shown below)
 */
export function generateObfuscatedScript(
  token:    string,
  apiBase:  string,
  xcassets = "QuantumAdaptive/Assets.xcassets/AppIcon.appiconset"
): ObfuscatedScript {

  // ── Layer 1 + 2: XOR → hex → base64 fragments ──────────────────────────────
  const tokenHex  = xorHex(token);
  const urlHex    = xorHex(apiBase);

  const tokenFrags = fragmentB64(tokenHex, 4);   // _tf0 _tf1 _tf2 _tf3
  const urlFrags   = fragmentB64(urlHex,   3);   // _uf0 _uf1 _uf2

  // ── Layer 3: base64 core eval block ─────────────────────────────────────────
  const coreB64 = encodeCoreScript(xcassets);

  // ── Assemble script ─────────────────────────────────────────────────────────
  const tokenDecoder = [
    `__t=$(python3 -c "`,
    `import base64`,
    `k='JSOS1AF'`,
    `h=base64.b64decode('${tokenFrags[0]}').decode()+base64.b64decode('${tokenFrags[1]}').decode()+base64.b64decode('${tokenFrags[2]}').decode()+base64.b64decode('${tokenFrags[3]}').decode()`,
    `print(''.join(chr(int(h[i*2:i*2+2],16)^ord(k[i%len(k)])) for i in range(len(h)//2)))`,
    `")`,
  ].join("\n");

  const urlDecoderStr = [
    `__b=$(python3 -c "`,
    `import base64`,
    `h=base64.b64decode('${urlFrags[0]}').decode()+base64.b64decode('${urlFrags[1]}').decode()+base64.b64decode('${urlFrags[2]}').decode()`,
    `print(''.join(chr(int(h[i*2:i*2+2],16)^ord('JSOS1AF'[i%7])) for i in range(len(h)//2)))`,
    `")`,
  ].join("\n");

  const script = `#!/usr/bin/env bash
# ================================================================
# S1AF QuantumAdaptive — AppIcon Setup
# © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1
# Sovereign lock: authorized device · ${new Date().toISOString().split("T")[0]}
# Layers: 3 (XOR-fragment · base64-fragment · eval-core)
# ================================================================
set -euo pipefail
# ── Fragment group A (token) ─────────────────────────────────────
_tf0="${tokenFrags[0]}"
_tf1="${tokenFrags[1]}"
_tf2="${tokenFrags[2]}"
_tf3="${tokenFrags[3]}"
# ── Fragment group B (endpoint) ──────────────────────────────────
_uf0="${urlFrags[0]}"
_uf1="${urlFrags[1]}"
_uf2="${urlFrags[2]}"
# ── Decode A → __t ───────────────────────────────────────────────
${tokenDecoder}
# ── Decode B → __b ───────────────────────────────────────────────
${urlDecoderStr}
# ── Execute core (Layer 3 eval) ───────────────────────────────────
eval "$(printf '%s' '${coreB64}' | base64 -d)"
# ── Cleanup ───────────────────────────────────────────────────────
unset _tf0 _tf1 _tf2 _tf3 _uf0 _uf1 _uf2 __t __b
`;

  const fingerprint = crypto.createHash("sha256").update(script).digest("hex");

  return {
    script,
    fingerprint,
    layers:         3,
    accountLock:    "OCSO-S1AF-GOV-1",
    tokenFragments: tokenFrags.length,
    urlFragments:   urlFrags.length,
  };
}
