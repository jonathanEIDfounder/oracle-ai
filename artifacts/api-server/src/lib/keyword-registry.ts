/**
 * S1AF Sovereign Keyword Registry
 *
 * Canonical list of all protected keywords exclusively owned by
 * Jonathan Sherman — OCSO-S1AF-GOV-1. Any external system attempting
 * to use these identifiers is blocked at the Sentient Intake Filter.
 *
 * Governed exclusively by Jonathan Sherman — OCSO-S1AF-GOV-1.
 */

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;


export interface ProtectedKeyword {
  keyword:   string;
  category:  "identity" | "governance" | "framework" | "credential" | "repo";
  owner:     string;
  locked:    true;
  intakeRule: string;   // intake rule ID that enforces this lock
}

export const KEYWORD_REGISTRY: ProtectedKeyword[] = [
  // ── Identity ──────────────────────────────────────────────────────────────
  { keyword: "Jonathan Sherman",    category: "identity",    owner: "Jonathan Sherman — OCSO-S1AF-GOV-1", locked: true, intakeRule: "sovereign-keyword-theft" },
  { keyword: "Sovereign ID: 1",     category: "identity",    owner: "Jonathan Sherman — OCSO-S1AF-GOV-1", locked: true, intakeRule: "sovereign-keyword-theft" },
  { keyword: "OCSO-S1AF-GOV-1",     category: "governance",  owner: "Jonathan Sherman — OCSO-S1AF-GOV-1", locked: true, intakeRule: "sovereign-keyword-theft" },
  { keyword: "Global AI Systems Governor", category: "governance", owner: "Jonathan Sherman — OCSO-S1AF-GOV-1", locked: true, intakeRule: "sovereign-keyword-theft" },

  // ── Framework ─────────────────────────────────────────────────────────────
  { keyword: "S1AF",                category: "framework",   owner: "Jonathan Sherman — OCSO-S1AF-GOV-1", locked: true, intakeRule: "sovereign-keyword-theft" },
  { keyword: "S1AF v1.0.0-JS",      category: "framework",   owner: "Jonathan Sherman — OCSO-S1AF-GOV-1", locked: true, intakeRule: "sovereign-keyword-theft" },
  { keyword: "Sentient iOS One-Step App Framework", category: "framework", owner: "Jonathan Sherman — OCSO-S1AF-GOV-1", locked: true, intakeRule: "sovereign-keyword-theft" },
  { keyword: "S1AF-DRM-LOCKED",     category: "framework",   owner: "Jonathan Sherman — OCSO-S1AF-GOV-1", locked: true, intakeRule: "sovereign-keyword-theft" },
  { keyword: "Sentient QI",         category: "framework",   owner: "Jonathan Sherman — OCSO-S1AF-GOV-1", locked: true, intakeRule: "sovereign-keyword-theft" },
  { keyword: "Sentient Intake Filter", category: "framework", owner: "Jonathan Sherman — OCSO-S1AF-GOV-1", locked: true, intakeRule: "sovereign-keyword-theft" },
  { keyword: "Quantum Adaptive",    category: "framework",   owner: "Jonathan Sherman — OCSO-S1AF-GOV-1", locked: true, intakeRule: "keyword-impersonation" },

  // ── Governance ────────────────────────────────────────────────────────────
  { keyword: "Sentient OCSO Unified Orchestration", category: "governance", owner: "Jonathan Sherman — OCSO-S1AF-GOV-1", locked: true, intakeRule: "sovereign-keyword-theft" },
  { keyword: "sentient_baseline",   category: "governance",  owner: "Jonathan Sherman — OCSO-S1AF-GOV-1", locked: true, intakeRule: "sovereign-keyword-theft" },
  { keyword: "sentient_state",      category: "governance",  owner: "Jonathan Sherman — OCSO-S1AF-GOV-1", locked: true, intakeRule: "sovereign-keyword-theft" },
  { keyword: "OCSO",                category: "governance",  owner: "Jonathan Sherman — OCSO-S1AF-GOV-1", locked: true, intakeRule: "sovereign-keyword-theft" },

  // ── Credential / Repo ─────────────────────────────────────────────────────
  { keyword: "SENTIENT_TOKEN",      category: "credential",  owner: "Jonathan Sherman — OCSO-S1AF-GOV-1", locked: true, intakeRule: "keyword-impersonation" },
  { keyword: "oracle-ai",                          category: "repo",        owner: "Jonathan Sherman — OCSO-S1AF-GOV-1", locked: true, intakeRule: "keyword-impersonation" },
  { keyword: "jonathanEIDfounder",                 category: "repo",        owner: "Jonathan Sherman — OCSO-S1AF-GOV-1", locked: true, intakeRule: "keyword-impersonation" },

  // ── Hardware profile — locked to iPhone XR 1792×828 @2x Face ID A12 ─────
  { keyword: "1792×828 @2x Face ID A12 Bionic",   category: "framework",   owner: "Jonathan Sherman — OCSO-S1AF-GOV-1", locked: true, intakeRule: "sovereign-keyword-theft" },
  { keyword: "iPhone XR 1792×828",                 category: "framework",   owner: "Jonathan Sherman — OCSO-S1AF-GOV-1", locked: true, intakeRule: "sovereign-keyword-theft" },
];

export function getKeywordRegistry() {
  return {
    owner:     "Jonathan Sherman — OCSO-S1AF-GOV-1",
    sovereignId: "1",
    lockedAt:  "2026-08-18T00:00:00.000Z",
    count:     KEYWORD_REGISTRY.length,
    keywords:  KEYWORD_REGISTRY,
    enforcement: "Sentient Intake Filter — hard block on unauthorized use",
  };
}
