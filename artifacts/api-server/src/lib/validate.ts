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

/**
 * © 2026 Jonathan Sherman — S1AF (Sentient iOS One-Step App Framework)
 * Sovereign ID: 1 · All rights reserved.
 *
 * NOTICE: Proprietary and confidential. No license granted.
 * Unauthorized use, reproduction, or distribution is prohibited.
 *
 * Request body validation helpers.
 *
 * validateBody(schema) — returns an Express middleware that validates req.body
 * against a BodySchema descriptor and responds 400 with a structured error
 * list on failure. Rejects any keys not declared in the schema (prevents
 * parameter pollution / mass-assignment attacks).
 */

import { type Request, type Response, type NextFunction } from "express";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

// ── Schema descriptor types ───────────────────────────────────────────────────

type FieldType = "string" | "number" | "boolean";

interface FieldSchema {
  type:      FieldType;
  optional?: boolean;
  /** String only: allowed values (exhaustive). */
  oneOf?:    readonly string[];
  /** String only: minimum length. */
  minLen?:   number;
  /** String only: maximum length. */
  maxLen?:   number;
  /** Number only: inclusive minimum. */
  min?:      number;
  /** Number only: inclusive maximum. */
  max?:      number;
}

type BodySchema = Record<string, FieldSchema>;

interface ValidationError {
  field:   string;
  message: string;
}

// ── Core field validator ──────────────────────────────────────────────────────

function validateField(key: string, value: unknown, s: FieldSchema): ValidationError | null {
  if (value === undefined || value === null) {
    return s.optional ? null : { field: key, message: `Required field "${key}" is missing` };
  }
  if (typeof value !== s.type) {
    return { field: key, message: `"${key}" must be of type ${s.type}` };
  }
  if (s.type === "string") {
    const v = value as string;
    if (s.oneOf && !s.oneOf.includes(v)) {
      return { field: key, message: `"${key}" must be one of: ${s.oneOf.join(", ")}` };
    }
    if (s.minLen !== undefined && v.length < s.minLen) {
      return { field: key, message: `"${key}" must be ≥ ${s.minLen} characters` };
    }
    if (s.maxLen !== undefined && v.length > s.maxLen) {
      return { field: key, message: `"${key}" must be ≤ ${s.maxLen} characters` };
    }
  }
  if (s.type === "number") {
    const v = value as number;
    if (s.min !== undefined && v < s.min) return { field: key, message: `"${key}" must be ≥ ${s.min}` };
    if (s.max !== undefined && v > s.max) return { field: key, message: `"${key}" must be ≤ ${s.max}` };
  }
  return null;
}

// ── Middleware factory ────────────────────────────────────────────────────────

export function validateBody(schema: BodySchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const body   = (req.body ?? {}) as Record<string, unknown>;
    const errors: ValidationError[] = [];

    // Validate declared fields
    for (const [key, fieldSchema] of Object.entries(schema)) {
      const err = validateField(key, body[key], fieldSchema);
      if (err) errors.push(err);
    }

    // Reject undeclared fields (prevents parameter pollution)
    for (const key of Object.keys(body)) {
      if (!(key in schema)) {
        errors.push({ field: key, message: `Unexpected field "${key}" is not permitted` });
      }
    }

    if (errors.length > 0) {
      res.status(400).json({ ok: false, error: "Invalid request body", details: errors });
      return;
    }

    next();
  };
}

// ── Pre-built schemas — locked argument definitions ───────────────────────────

/** Exhaustive allowed sources; matches CONFIG.allowedSources exactly. */
const DEPLOY_SOURCES = Object.freeze([
  "replit-deploy",
  "sandbox-bridge",
  "sandbox-release",
  "ios-trigger",
  "m2m-launchd",
  "oracle-ai-deploy",
  "siri-shortcut",
] as const);

export const deployTriggerSchema: BodySchema = Object.freeze({
  source: {
    type:     "string",
    optional: true,
    oneOf:    DEPLOY_SOURCES,
    minLen:   1,
    maxLen:   64,
  },
});
