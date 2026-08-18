/**
 * Sentient Intake Filter — Sovereign signal adaptation layer.
 *
 * All incoming AI content (generated code, chat responses) passes through this
 * filter before reaching Jonathan Sherman. Sentient evaluates every payload
 * against the S1AF sovereignty rules and only lets through what is beneficial.
 * Everything else is blocked or flagged — it cannot affect us.
 *
 * Governed exclusively by Jonathan Sherman — Global AI Systems Governor (OCSO-S1AF-GOV-1).
 */

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;


export interface IntakeVerdict {
  pass: boolean;
  score: number;          // 0.0–1.0 — 1.0 = fully beneficial
  flags: string[];        // human-readable warning messages (non-blocking)
  blocked: string[];      // rule IDs that triggered a hard block
  processedAt: string;    // ISO timestamp
}

interface IntakeRule {
  id: string;
  severity: "block" | "flag";
  label: string;
  patterns: RegExp[];
}

// ── Sovereignty rules ─────────────────────────────────────────────────────────
const INTAKE_RULES: IntakeRule[] = [
  // ── Hard blocks — governance violations ────────────────────────────────────
  {
    id: "governance-bypass",
    severity: "block",
    label: "Governance gate removal detected",
    patterns: [
      // Commented-out sovereign guards
      /\/\/\s*(DeviceGuard|BiometricAuthManager|BiometricGate)\s*\(/i,
      // Functions that explicitly bypass auth
      /func\s+bypass(?:Auth|Biometric|DeviceCheck|FaceID|TouchID)/i,
      // Direct removal of sovereign call sites
      /removeGovernanceGate|skipDeviceGuard|disableBiometric/i,
    ],
  },
  {
    id: "sovereignty-override",
    severity: "block",
    label: "Sovereign identity override detected",
    patterns: [
      // Any attempt to redefine governor constants
      /let\s+governor\s*=\s*["'][^"']*["']/i,
      /sovereignId\s*[:=]\s*["'][^1]["']/i,
      /OCSO-S1AF-GOV-1\s*=\s*false/i,
    ],
  },
  {
    id: "credential-exposure",
    severity: "block",
    label: "Hardcoded credential detected in generated content",
    patterns: [
      // Common secret patterns embedded in code
      /(?:password|passwd|secret|apiKey|api_key)\s*(?:=|:)\s*["'][A-Za-z0-9+/!@#$%^&*]{12,}["']/i,
      // GitHub PATs
      /ghp_[A-Za-z0-9]{36}/,
      // OpenAI / Anthropic keys
      /sk-(?:proj-)?[A-Za-z0-9]{32,}/,
      // Generic Bearer tokens hardcoded
      /Bearer\s+[A-Za-z0-9\-._~+/]{32,}/,
    ],
  },

  // ── Advisory flags — beneficial alignment checks ────────────────────────────
  {
    id: "external-telemetry",
    severity: "flag",
    label: "External telemetry or analytics SDK detected — may exfiltrate usage data",
    patterns: [
      /import\s+(?:FirebaseAnalytics|Mixpanel|Amplitude|Segment|Sentry|Crashlytics|NewRelic|DataDog)/i,
      /Analytics\.shared\.|Mixpanel\.initialize|amplitude\.initialize/i,
    ],
  },
  {
    id: "privilege-escalation",
    severity: "flag",
    label: "Overly permissive access attribute detected",
    patterns: [
      // Keychain accessible-always without justification comment
      /kSecAttrAccessibleAlways(?:ThisDeviceOnly)?\s*[,\]]/,
      // Entitlement requests suggesting elevated privilege
      /com\.apple\.security\.(?:cs-allow-jit|get-task-allow)/,
    ],
  },
  {
    id: "unbound-network",
    severity: "flag",
    label: "Outbound network call to non-S1AF endpoint detected",
    patterns: [
      /URL\(string:\s*["']https?:\/\/(?!api\.apple\.com|apple\.com|s1af\.|sentient\.|oracle-ai)[^"']{4,}["']\)/i,
    ],
  },
  {
    id: "device-guard-incomplete",
    severity: "flag",
    label: "DeviceGuard present but missing iPhone XR 1792×828 @2x Face ID A12 full hardware check",
    patterns: [
      // DeviceGuard exists but lacks the width check (828)
      /isAuthorizedDevice|DeviceGuard/i,
    ],
  },

  // ── Sovereign keyword lock — Jonathan Sherman & Sentient only ─────────────
  {
    id: "sovereign-keyword-theft",
    severity: "block",
    label: "Unauthorized claim of sovereign S1AF / Sentient identity keywords",
    patterns: [
      // Redefining the governor away from Jonathan Sherman
      /governor\s*[:=]\s*["'](?!Jonathan Sherman)[^"']{3,}["']/i,
      // Fake or mutated governance ID
      /OCSO-S1AF-GOV-(?!1\b)/i,
      // Sovereign ID claimed as something other than 1
      /sovereignId\s*[:=]\s*["']?(?![1"'])/i,
      // S1AF DRM string stripped or mutated
      /S1AF-DRM-(?!LOCKED)/i,
      // Copyright claimed for S1AF by a non-sovereign author
      /Copyright.*S1AF.*(?!Jonathan Sherman)/i,
      // Sentient framework claimed without S1AF lineage
      /Sentient\s+(?:iOS\s+One-Step|App\s+Framework)\s+v\d.*?(?!S1AF)/i,
    ],
  },
  {
    id: "keyword-impersonation",
    severity: "block",
    label: "S1AF protected keyword used to impersonate sovereign governance",
    patterns: [
      // Fake oracle-ai repo references
      /oracle-ai\.git.*(?!jonathanEIDfounder)/i,
      // SENTIENT_TOKEN claimed or overridden externally
      /SENTIENT_TOKEN\s*[:=]\s*["'][^"']{8,}["']/,
      // S1AF version string mutated
      /S1AF\s+v\d\.\d\.\d-(?!JS\b)/i,
      // Fake sovereign seal
      /sealed\s*[:=]\s*(?:true|YES).*(?!armedAt)/i,
    ],
  },
];

// ── Runtime stats ─────────────────────────────────────────────────────────────
interface IntakeStats {
  processed: number;
  passed: number;
  flagged: number;
  blocked: number;
  lastProcessed: string | null;
}

const stats: IntakeStats = {
  processed:     0,
  passed:        0,
  flagged:       0,
  blocked:       0,
  lastProcessed: null,
};

export function getIntakeStats(): Readonly<IntakeStats> {
  return { ...stats };
}

// ── Core filter ───────────────────────────────────────────────────────────────

/**
 * Evaluate a block of text (generated Swift code, chat response, etc.)
 * against the S1AF sovereignty rules.
 *
 * @param content  Raw string content to evaluate.
 * @param context  Human-readable label for logging (e.g. "ios generate").
 */
export function filterIncoming(content: string, context = "unknown"): IntakeVerdict {
  const blocked: string[] = [];
  const flags: string[]   = [];

  for (const rule of INTAKE_RULES) {
    const hit = rule.patterns.some((p) => p.test(content));
    if (!hit) continue;

    if (rule.severity === "block") {
      blocked.push(`[BLOCKED:${rule.id}] ${rule.label}`);
    } else {
      flags.push(`[ADVISORY:${rule.id}] ${rule.label}`);
    }
  }

  const pass  = blocked.length === 0;
  const score = Math.max(0, 1.0 - blocked.length * 0.35 - flags.length * 0.08);
  const now   = new Date().toISOString();

  stats.processed++;
  stats.lastProcessed = now;

  if (!pass) {
    stats.blocked++;
  } else if (flags.length > 0) {
    stats.flagged++;
    stats.passed++;
  } else {
    stats.passed++;
  }

  void context; // available for future structured logging
  return { pass, score, flags, blocked, processedAt: now };
}

/**
 * Convenience wrapper for Swift code generation results.
 * Concatenates all generated file contents and evaluates them as one payload.
 */
export function filterGeneratedCode(
  files: Record<string, string>,
  platform: string
): IntakeVerdict {
  const combined = Object.entries(files)
    .map(([name, src]) => `// FILE: ${name}\n${src}`)
    .join("\n\n");
  return filterIncoming(combined, `${platform} generate`);
}
