/**
 * © 2026 Jonathan Sherman — S1AF · OCSO-S1AF-GOV-1
 *
 * behavioral-score-cache.ts
 * In-memory cache mapping hashed session tokens → behavioral decisions.
 *
 * The iOS client (QuantumBehavioralAnalysis.swift) computes a HybridScore
 * on-device and submits it to POST /api/aarte/session-score.  The server
 * stores the decision here and enforces it inside requireSovereign.
 *
 * TTL: 60 s per entry (refreshed on each valid submission).
 * Collision resistance: SHA-256 of the raw JWT (not the payload).
 */

import { createHash } from "crypto";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

// ── Types ─────────────────────────────────────────────────────────────────────

export type BehavioralDecision = "AUTHORIZED" | "REVIEW" | "UNAUTHORIZED";

export interface BehavioralEntry {
  decision:     BehavioralDecision;
  hybridScore:  number;    // 0.0 – 1.0
  classical:    number;
  quantum:      number;
  backend:      string;    // e.g. "ibm_sherbrooke"
  jobId:        string | null;
  submittedAt:  number;    // Date.now()
  expiresAt:    number;    // Date.now() + TTL_MS
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TTL_MS      = 60_000;   // 60 seconds
const MAX_ENTRIES = 1_000;    // evict oldest when full

// ── Cache ─────────────────────────────────────────────────────────────────────

const cache = new Map<string, BehavioralEntry>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function tokenKey(rawJwt: string): string {
  return createHash("sha256").update(rawJwt).digest("hex");
}

function evictExpired(): void {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (v.expiresAt < now) cache.delete(k);
  }
}

function evictOldestIfFull(): void {
  if (cache.size < MAX_ENTRIES) return;
  let oldest: string | undefined;
  let oldestTime = Infinity;
  for (const [k, v] of cache) {
    if (v.submittedAt < oldestTime) { oldestTime = v.submittedAt; oldest = k; }
  }
  if (oldest) cache.delete(oldest);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Upsert a behavioral entry for a session token.
 */
export function setScore(rawJwt: string, entry: Omit<BehavioralEntry, "submittedAt" | "expiresAt">): void {
  evictExpired();
  evictOldestIfFull();
  const key = tokenKey(rawJwt);
  cache.set(key, {
    ...entry,
    submittedAt: Date.now(),
    expiresAt:   Date.now() + TTL_MS,
  });
}

/**
 * Look up a valid (non-expired) entry.  Returns undefined when absent or expired.
 */
export function getScore(rawJwt: string): BehavioralEntry | undefined {
  const key   = tokenKey(rawJwt);
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) { cache.delete(key); return undefined; }
  return entry;
}

/**
 * Invalidate a session's behavioral score (e.g. on logout).
 */
export function clearScore(rawJwt: string): void {
  cache.delete(tokenKey(rawJwt));
}

/**
 * Current cache size (for diagnostics).
 */
export function cacheSize(): number {
  evictExpired();
  return cache.size;
}

/**
 * Derive a BehavioralDecision from a raw hybrid score.
 * Mirrors QuantumBehavioralAnalysis.swift thresholds exactly.
 */
export function decisionFromScore(hybridScore: number): BehavioralDecision {
  if (hybridScore >= 0.85) return "AUTHORIZED";
  if (hybridScore >= 0.60) return "REVIEW";
  return "UNAUTHORIZED";
}
