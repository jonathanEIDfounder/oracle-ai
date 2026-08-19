/**
 * © 2026 Jonathan Sherman — S1AF · OCSO-S1AF-GOV-1
 * aarte.ts — Apple AI Runtime & Tactical Engine (TypeScript mirror)
 *
 * Mirrors AppleAIDecisionEngine.swift exactly so the server and Swift package
 * stay in lock-step.  Pure functions — no I/O, no side-effects.
 */

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;


// ── Types ─────────────────────────────────────────────────────────────────────

export type Decision = "proceed" | "retry" | "review" | "abort";

export interface AarteAnalysis {
  decision:       Decision;
  shouldDeploy:   boolean;
  optimalBackend: string;
  timestamp:      string;
  inputs: {
    hadBuildLog:   boolean;
    testCount:     number;
    backendCount:  number;
  };
}

// ── analyzeBuildLog ───────────────────────────────────────────────────────────
// 4-priority heuristic matching the Swift implementation exactly:
//   1. abort  — errors, build failures, code-signing issues
//   2. retry  — timeouts, network failures, transient kills
//   3. review — warnings, skips, deprecations
//   4. proceed — explicit success markers
//   fallback  → review

export function analyzeBuildLog(buildOutput: string): Decision {
  const log = buildOutput.toLowerCase();

  // 1 — Abort
  const abortPatterns = [
    "build failed", "compilation failed", "error: ", "❌", "fatal error",
    "linker command failed", "code signing failed", "provisioning profile",
    "no such module", "undefined symbol",
  ];
  for (const p of abortPatterns) {
    if (log.includes(p)) return "abort";
  }
  if (/test suite .+ failed/.test(log)) return "abort";

  // 2 — Retry
  const retryPatterns = [
    "timeout", "timed out", "connection refused", "network error",
    "could not connect", "temporary failure", "exit code 143",
  ];
  for (const p of retryPatterns) {
    if (log.includes(p)) return "retry";
  }

  // 3 — Review
  const reviewPatterns = [
    "warning: ", "⚠️", "⚠", "skipped", "deprecated", "test skipped", "xctskip",
  ];
  for (const p of reviewPatterns) {
    if (log.includes(p)) return "review";
  }

  // 4 — Proceed
  const proceedPatterns = [
    "build succeeded", "** build succeeded **", "all tests passed", "✓", "✅",
  ];
  for (const p of proceedPatterns) {
    if (log.includes(p)) return "proceed";
  }
  if (/test suite .+ passed/.test(log)) return "proceed";

  return "review";
}

// ── shouldAutoDeploy ──────────────────────────────────────────────────────────
// Returns true when pass-rate ≥ threshold (default 1.0 = 100 %).

export function shouldAutoDeploy(
  testResults: Record<string, boolean>,
  threshold = 1.0,
): boolean {
  const values = Object.values(testResults);
  if (values.length === 0) return false;
  const passing = values.filter(Boolean).length;
  return passing / values.length >= threshold;
}

// ── predictOptimalBackend ─────────────────────────────────────────────────────
// Picks the backend with the lowest queue depth.
// `margin` (default 2) adds hysteresis — only switches when the challenger
// beats the current best by more than margin slots.

export function predictOptimalBackend(
  backends: Record<string, number>,
  margin = 2,
): string {
  const entries = Object.entries(backends);
  if (entries.length === 0) return "";

  let bestName  = "";
  let bestDepth = Infinity;

  for (const [name, depth] of entries) {
    if (!bestName) {
      bestName  = name;
      bestDepth = depth;
    } else if (depth < bestDepth - margin) {
      bestName  = name;
      bestDepth = depth;
    } else if (depth === bestDepth && name < bestName) {
      bestName = name;
    }
  }
  return bestName;
}

// ── analyzeAll ────────────────────────────────────────────────────────────────
// Convenience function used by the /aarte/analyze route.

export function analyzeAll(
  buildLog: string,
  testResults: Record<string, boolean>,
  backends: Record<string, number>,
): AarteAnalysis {
  return {
    decision:       analyzeBuildLog(buildLog),
    shouldDeploy:   shouldAutoDeploy(testResults),
    optimalBackend: predictOptimalBackend(backends),
    timestamp:      new Date().toISOString(),
    inputs: {
      hadBuildLog:  buildLog.length > 0,
      testCount:    Object.keys(testResults).length,
      backendCount: Object.keys(backends).length,
    },
  };
}
