#!/usr/bin/env node
/**
 * © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1
 * S1AF Authorship Embedder — stamps every source file with immutable ownership.
 * Every letter. No stripping.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, relative, extname } from "path";

const REPO = "/home/runner/workspace";

const TS_HEADER = (file) => `\
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
 */`;

const TS_ANCHOR = `\n// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./lib/authorship";
void _S1AF_ANCHOR;\n`;

const TS_ANCHOR_LIB = `\n// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;\n`;

const SH_HEADER = `\
# =============================================================================
# © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1
# S1AF — Sentient iOS One-Step App Framework · Sovereign ID: 1
# Author      : Jonathan Sherman (jonathanEIDfounder)
# Governance  : OCSO-S1AF-GOV-1
# Copyright   : © 2026 Jonathan Sherman. All rights reserved.
# License     : PROPRIETARY — No license granted without express written permission.
# DRM         : S1AF-DRM-LOCKED
# Notice      : Unauthorized use, reproduction, modification, distribution, or
#               sublicensing is strictly prohibited. Removal of this authorship
#               notice violates applicable copyright law.
# =============================================================================`;

const SH_ANCHOR = `readonly _S1AF_AUTHOR="© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"\n`;

const AUTHORSHIP_MARKER = "OCSO-S1AF-GOV-1";
const ANCHOR_MARKER     = "_S1AF_ANCHOR";

function walk(dir, ext) {
  const results = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st   = statSync(full);
    if (st.isDirectory() && !name.startsWith(".") && name !== "node_modules" && name !== "dist") {
      results.push(...walk(full, ext));
    } else if (st.isFile() && ext.includes(extname(name))) {
      results.push(full);
    }
  }
  return results;
}

function getRelativeImportPath(filePath) {
  // Determine whether this is a lib file or routes/middleware/top-level
  const rel = relative(join(REPO, "artifacts/api-server/src"), filePath);
  const depth = rel.split("/").length - 1;
  if (depth === 0) return "./lib/authorship";  // src/*.ts
  if (rel.startsWith("lib/")) return "./authorship"; // src/lib/*.ts
  return "../lib/authorship"; // src/routes/*.ts, src/middleware/*.ts
}

let stamped = 0, skipped = 0, errors = 0;

// ── TypeScript files ──────────────────────────────────────────────────────
const tsFiles = [
  ...walk(join(REPO, "artifacts/api-server/src"), [".ts"]),
];

for (const file of tsFiles) {
  try {
    let content = readFileSync(file, "utf8");
    const rel   = relative(REPO, file);
    let changed = false;

    // 1. Add/replace header block
    if (!content.includes(AUTHORSHIP_MARKER)) {
      content = TS_HEADER(rel) + "\n\n" + content;
      changed = true;
    }

    // 2. Add anchor import (skip authorship.ts itself — it IS the source)
    if (!content.includes(ANCHOR_MARKER) && !file.endsWith("authorship.ts")) {
      const importPath = getRelativeImportPath(file);
      const anchor = `\n// ── Authorship anchor — non-strippable ──────────────────────────────────────\nimport { S1AF_ANCHOR as _S1AF_ANCHOR } from "${importPath}";\nvoid _S1AF_ANCHOR;\n`;

      // Insert after the last top-level import block
      const importEnd = content.lastIndexOf("\nimport ");
      if (importEnd !== -1) {
        // Find end of that import line
        const lineEnd = content.indexOf("\n", importEnd + 1);
        content = content.slice(0, lineEnd + 1) + anchor + content.slice(lineEnd + 1);
      } else {
        // No imports — add after header
        const headerEnd = content.indexOf("*/");
        if (headerEnd !== -1) {
          content = content.slice(0, headerEnd + 2) + "\n" + anchor + content.slice(headerEnd + 2);
        } else {
          content = anchor + content;
        }
      }
      changed = true;
    }

    if (changed) {
      writeFileSync(file, content, "utf8");
      console.log(`✓ TS  ${rel}`);
      stamped++;
    } else {
      console.log(`–    ${rel} (already stamped)`);
      skipped++;
    }
  } catch (e) {
    console.error(`✗ ERR ${file}: ${e.message}`);
    errors++;
  }
}

// ── Shell scripts ─────────────────────────────────────────────────────────
const shFiles = walk(join(REPO, "scripts"), [".sh"]);

for (const file of shFiles) {
  try {
    let content = readFileSync(file, "utf8");
    const rel   = relative(REPO, file);
    let changed = false;

    // Keep shebang on line 1
    let shebang = "";
    let body    = content;
    if (content.startsWith("#!")) {
      const nl = content.indexOf("\n");
      shebang  = content.slice(0, nl + 1);
      body     = content.slice(nl + 1);
    }

    // Add header after shebang if missing
    if (!content.includes(AUTHORSHIP_MARKER)) {
      body    = "\n" + SH_HEADER + "\n\n" + body;
      changed = true;
    }

    // Add readonly anchor near top of body (after first blank line following header)
    if (!content.includes("_S1AF_AUTHOR") && !content.includes("_S1AF_ANCHOR")) {
      // Insert after the header block (look for first empty line after header)
      const insertPos = body.indexOf("\n\n");
      if (insertPos !== -1) {
        body = body.slice(0, insertPos + 2) + SH_ANCHOR + body.slice(insertPos + 2);
      } else {
        body = SH_ANCHOR + body;
      }
      changed = true;
    }

    if (changed) {
      writeFileSync(file, shebang + body, "utf8");
      console.log(`✓ SH  ${rel}`);
      stamped++;
    } else {
      console.log(`–    ${rel} (already stamped)`);
      skipped++;
    }
  } catch (e) {
    console.error(`✗ ERR ${file}: ${e.message}`);
    errors++;
  }
}

console.log(`\n════════════════════════════════════`);
console.log(`Stamped : ${stamped}`);
console.log(`Skipped : ${skipped} (already had authorship)`);
console.log(`Errors  : ${errors}`);
console.log(`\n© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED`);
