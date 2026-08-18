/**
 * S1AF Code Entity Index — Sovereign Class & Module Registry
 *
 * Scans all TypeScript source files across the workspace and extracts
 * every significant code entity: classes, functions, interfaces, types,
 * React components, API routes, and database schemas.
 *
 * Governed exclusively by Jonathan Sherman — OCSO-S1AF-GOV-1.
 */

import fs   from "node:fs";
import path from "node:path";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

// ── Types ─────────────────────────────────────────────────────────────────────

export type EntityKind =
  | "class"
  | "abstract-class"
  | "function"
  | "async-function"
  | "component"
  | "interface"
  | "type"
  | "const"
  | "schema"
  | "route"
  | "enum";

export interface CodeEntity {
  kind:       EntityKind;
  name:       string;
  file:       string;           // workspace-relative path
  line:       number;
  exported:   boolean;
  extendsName?: string;         // for classes
  method?:    string;           // for routes: GET | POST | PUT | DELETE | PATCH
  path?:      string;           // for routes: /api/...
  package:    string;           // top-level package/artifact name
}

export interface ClassIndex {
  scannedAt:  string;
  totalFiles: number;
  entities:   CodeEntity[];
  byKind:     Record<EntityKind, number>;
  byPackage:  Record<string, number>;
}

// ── Scanner configuration ──────────────────────────────────────────────────────

const WORKSPACE = path.resolve(process.cwd(), "../..");

const SCAN_DIRS = [
  "artifacts/api-server/src",
  "artifacts/qi-platform/src",
  "artifacts/kimi-xcode-planner/src",
  "lib/api-client-react/src",
  "lib/db/src",
];

const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.d\.ts$/,
  /\/generated\//,
  /\/ui\//,        // shadcn UI primitives — too noisy
];

// ── Regex matchers ─────────────────────────────────────────────────────────────

const MATCHERS: Array<{
  re:    RegExp;
  kind:  EntityKind | ((m: RegExpMatchArray) => EntityKind);
  name:  (m: RegExpMatchArray) => string;
  extra?: (m: RegExpMatchArray, entity: CodeEntity) => void;
}> = [
  // abstract class
  {
    re:    /^(export\s+)?abstract\s+class\s+(\w+)(?:\s+extends\s+(\w[\w<>,\s]*))?/,
    kind:  "abstract-class",
    name:  (m) => m[2],
    extra: (m, e) => { if (m[3]) e.extendsName = m[3].trim(); e.exported = !!m[1]; },
  },
  // class
  {
    re:    /^(export\s+)?class\s+(\w+)(?:\s+extends\s+(\w[\w<>,\s]*))?/,
    kind:  "class",
    name:  (m) => m[2],
    extra: (m, e) => { if (m[3]) e.extendsName = m[3].trim(); e.exported = !!m[1]; },
  },
  // enum
  {
    re:    /^(export\s+)?(?:const\s+)?enum\s+(\w+)/,
    kind:  "enum",
    name:  (m) => m[2],
    extra: (m, e) => { e.exported = !!m[1]; },
  },
  // interface
  {
    re:    /^export\s+interface\s+(\w+)/,
    kind:  "interface",
    name:  (m) => m[1],
    extra: (_m, e) => { e.exported = true; },
  },
  // type alias
  {
    re:    /^export\s+type\s+(\w+)\s*[=<]/,
    kind:  "type",
    name:  (m) => m[1],
    extra: (_m, e) => { e.exported = true; },
  },
  // async function
  {
    re:    /^(export\s+)?async\s+function\s+(\w+)/,
    kind:  "async-function",
    name:  (m) => m[2],
    extra: (m, e) => { e.exported = !!m[1]; },
  },
  // sync function
  {
    re:    /^(export\s+)?function\s+(\w+)/,
    kind:  "function",
    name:  (m) => m[2],
    extra: (m, e) => { e.exported = !!m[1]; },
  },
  // React component (exported const = arrow function in .tsx)
  {
    re:    /^export\s+(default\s+)?function\s+([A-Z]\w+)/,
    kind:  "component",
    name:  (m) => m[2],
    extra: (_m, e) => { e.exported = true; },
  },
  // exported const arrow React component (UpperCase in .tsx)
  {
    re:    /^export\s+(?:const|default)\s+([A-Z]\w+)\s*[:=]/,
    kind:  "component",
    name:  (m) => m[1],
    extra: (_m, e) => { e.exported = true; },
  },
  // exported const (lowercase — not component)
  {
    re:    /^export\s+const\s+([a-z_]\w+)\s*[:=]/,
    kind:  "const",
    name:  (m) => m[1],
    extra: (_m, e) => { e.exported = true; },
  },
  // Drizzle schema table
  {
    re:    /^export\s+const\s+(\w+Table)\s*=/,
    kind:  "schema",
    name:  (m) => m[1],
    extra: (_m, e) => { e.exported = true; },
  },
  // Express route handler
  {
    re:    /^\s*router\.(get|post|put|delete|patch)\s*\(\s*["'`](\/[^"'`]*)/,
    kind:  "route",
    name:  (m) => `${m[1].toUpperCase()} ${m[2]}`,
    extra: (m, e) => { e.method = m[1].toUpperCase(); e.path = m[2]; e.exported = false; },
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function packageName(relPath: string): string {
  const parts = relPath.split("/");
  if (parts[0] === "artifacts") return parts[1] ?? "unknown";
  if (parts[0] === "lib")       return `lib/${parts[1] ?? ""}`;
  return parts[0];
}

function collectFiles(dir: string): string[] {
  const abs = path.join(WORKSPACE, dir);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      const rel  = path.relative(WORKSPACE, full);
      if (EXCLUDE_PATTERNS.some((p) => p.test(rel))) continue;
      if (entry.isDirectory())                        { walk(full); continue; }
      if (/\.(tsx?|js)$/.test(entry.name))            out.push(rel);
    }
  };
  walk(abs);
  return out;
}

function isTsx(file: string): boolean {
  return file.endsWith(".tsx");
}

// ── Main scanner ──────────────────────────────────────────────────────────────

export function buildClassIndex(): ClassIndex {
  const entities: CodeEntity[] = [];
  let totalFiles = 0;

  const allFiles = SCAN_DIRS.flatMap(collectFiles);
  totalFiles = allFiles.length;

  for (const relFile of allFiles) {
    const abs = path.join(WORKSPACE, relFile);
    let lines: string[];
    try {
      lines = fs.readFileSync(abs, "utf-8").split("\n");
    } catch {
      continue;
    }

    const pkg = packageName(relFile);
    const tsx = isTsx(relFile);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trimEnd();
      if (!line.trim()) continue;

      for (const matcher of MATCHERS) {
        const m = line.match(matcher.re);
        if (!m) continue;

        const kind: EntityKind =
          typeof matcher.kind === "function" ? matcher.kind(m) :
          // upgrade function → component for .tsx files with UpperCase names
          matcher.kind === "function" && tsx && /^[A-Z]/.test(matcher.name(m))
            ? "component"
            : matcher.kind;

        // Skip schema matcher if not a schema file
        if (kind === "schema" && !relFile.includes("schema")) continue;
        // Skip route matcher if not a route file
        if (kind === "route" && !relFile.includes("routes/") && !relFile.includes("route")) continue;

        const entity: CodeEntity = {
          kind,
          name:     matcher.name(m),
          file:     relFile,
          line:     i + 1,
          exported: false,
          package:  pkg,
        };

        matcher.extra?.(m, entity);

        // Deduplicate within same file+name (component vs function ambiguity)
        const dup = entities.find(
          (e) => e.file === entity.file && e.name === entity.name && e.line === entity.line
        );
        if (!dup) entities.push(entity);
        break;
      }
    }
  }

  // Count by kind and package
  const byKind = {} as Record<EntityKind, number>;
  const byPackage: Record<string, number> = {};
  for (const e of entities) {
    byKind[e.kind]       = (byKind[e.kind] ?? 0) + 1;
    byPackage[e.package] = (byPackage[e.package] ?? 0) + 1;
  }

  return {
    scannedAt:  new Date().toISOString(),
    totalFiles,
    entities:   entities.sort((a, b) => a.package.localeCompare(b.package) || a.file.localeCompare(b.file) || a.line - b.line),
    byKind,
    byPackage,
  };
}
