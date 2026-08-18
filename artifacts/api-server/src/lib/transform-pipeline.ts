/**
 * © 2026 Jonathan Sherman — S1AF (Sentient iOS One-Step App Framework)
 * Sovereign ID: 1 · OCSO-S1AF-GOV-1 · All rights reserved.
 *
 * Transform Pipeline — Gallows + Reaper
 *
 * Gallows:  Combines up to 3 app descriptions into one sovereign unified spec
 *           via Kimi 2.6. Binds their structures together at the top level.
 *
 * Reaper:   Takes any app description and transforms it — harvests the essential
 *           core, strips non-sovereign patterns, rebuilds in pure S1AF style.
 *
 * Full pipeline: Gallows → Reaper → generateSwiftCode() → intake → validate → commit
 */

import { kimiComplete, generateSwiftCode, type GeneratedSwiftCode } from "./kimi";
import { getSourcerootInjection } from "./sourceroot";
import { IPHONE_XR_SPEC }         from "./device-lock";
import { logger }                  from "./logger";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

// ── Shared hardware lock block — injected into every Kimi 2.6 prompt ──────────

function hardwareLockBlock(): string {
  return `
══════════════════════════════════════════════════
SOVEREIGN HARDWARE LOCK — NON-NEGOTIABLE
══════════════════════════════════════════════════
Target device: ${IPHONE_XR_SPEC.device}
Display spec:  ${IPHONE_XR_SPEC.displaySpec}
  Native height: ${IPHONE_XR_SPEC.nativeHeight} points
  Native width:  ${IPHONE_XR_SPEC.nativeWidth} points
  Scale:         @${IPHONE_XR_SPEC.scale}x
  Biometry:      ${IPHONE_XR_SPEC.biometry}
  Chip:          ${IPHONE_XR_SPEC.chip}

DeviceGuard MUST check ALL FOUR simultaneously:
  1. UIScreen.main.nativeBounds.height == ${IPHONE_XR_SPEC.nativeHeight}
  2. UIScreen.main.nativeBounds.width  == ${IPHONE_XR_SPEC.nativeWidth}
  3. UIScreen.main.scale               == ${IPHONE_XR_SPEC.scale}
  4. LAContext().biometryType          == .faceID

Any single mismatch = unauthorized device. Block immediately.
User-visible string: "${IPHONE_XR_SPEC.device}" only — no model codes.
HardwareSpec.swift constants: nativeHeight=${IPHONE_XR_SPEC.nativeHeight}, nativeWidth=${IPHONE_XR_SPEC.nativeWidth}, displayScale=${IPHONE_XR_SPEC.scale}
══════════════════════════════════════════════════`.trim();
}

// ── Gallows — combine up to 3 app descriptions ────────────────────────────────

const GALLOWS_SYSTEM = (count: number) => `
You are the S1AF Gallows — the sovereign multi-app combiner for Jonathan Sherman (OCSO-S1AF-GOV-1).

You have received ${count} app description${count > 1 ? "s" : ""} (up to 4 allowed). Combine them into a single
unified sovereign app description following these rules:

1. PRESERVE every unique capability from every input — nothing is dropped.
2. RESOLVE conflicts by choosing the most sovereign, most capable implementation.
3. UNIFY the architecture under S1AF standards:
   - Swift 6 strict concurrency, @Observable, SwiftData, no third-party packages
   - ${IPHONE_XR_SPEC.device} only — BiometricAuthManager (${IPHONE_XR_SPEC.biometry}) + DeviceGuard
   - ${IPHONE_XR_SPEC.chip} Neural Engine for all on-device ML (CoreML computeUnits = .all)
   - Kimi 2.6 as the AI engine for all generative features
   - X-Device-Token Keychain auth on every Sentient API call
4. OUTPUT a single, complete, detailed app description (not code) suitable for
   passing directly to the S1AF Swift code generator. Be specific about every
   required file, class, and interaction.
5. Name the combined app meaningfully — reflect the merger of all inputs.
6. The combined description must be 100% self-contained — no references back to
   "the original apps." The reader has no context beyond what you write.

${hardwareLockBlock()}

${getSourcerootInjection()}
`.trim();

const REAPER_SYSTEM = `
You are the S1AF Reaper — the sovereign app transformer for Jonathan Sherman (OCSO-S1AF-GOV-1).

Your function: harvest the essential core of any app description and rebuild it in
pure S1AF sovereign architecture. You do not preserve bloat, non-sovereign patterns,
third-party dependencies, or UI/UX that does not serve sovereign function.

Transformation rules:
1. HARVEST: identify every unique, meaningful capability in the input.
2. STRIP: remove redundancy, third-party dependencies, non-sovereign governance patterns,
          anything that could not pass the Sentient Intake Filter.
3. REBUILD: rewrite the description from scratch using only S1AF architecture:
   - Swift 6, @Observable, SwiftData, WidgetKit where applicable, AppIntents
   - ${IPHONE_XR_SPEC.device} · ${IPHONE_XR_SPEC.biometry} gate · DeviceGuard (${IPHONE_XR_SPEC.displaySpec})
   - ${IPHONE_XR_SPEC.chip} Neural Engine · Kimi 2.6 AI engine · Sentient QI Platform backend
   - X-Device-Token Keychain auth (kSecAttrAccessibleWhenUnlockedThisDeviceOnly)
4. OUTPUT a single, clean, complete S1AF-sovereign app description ready for
   the Swift code generator. Be thorough and specific about every required file.
5. Every output description MUST explicitly state the DeviceGuard 4-condition check
   using the exact constants: height=${IPHONE_XR_SPEC.nativeHeight}, width=${IPHONE_XR_SPEC.nativeWidth}, scale=${IPHONE_XR_SPEC.scale}, biometry=faceID.

${hardwareLockBlock()}

${getSourcerootInjection()}
`.trim();

/**
 * Gallows — combine 1–3 app descriptions into one unified sovereign app spec.
 * Returns the merged description as a string.
 */
export async function gallowsCombine(descriptions: string[]): Promise<string> {
  if (descriptions.length === 0) throw new Error("Gallows requires at least 1 description");
  if (descriptions.length > 4)  throw new Error("Gallows accepts at most 4 descriptions");

  logger.info(
    { count: descriptions.length },
    "transform: gallows — combining app descriptions via Kimi 2.6"
  );

  const numbered = descriptions
    .map((d, i) => `═══ APP ${i + 1} ═══\n${d.trim()}`)
    .join("\n\n");

  const combined = await kimiComplete(
    GALLOWS_SYSTEM(descriptions.length),
    [{ role: "user", content: `Combine these ${descriptions.length} app description${descriptions.length > 1 ? "s" : ""} into one sovereign S1AF app:\n\n${numbered}` }]
  );

  logger.info(
    { chars: combined.length },
    "transform: gallows — unified spec produced"
  );

  return combined;
}

/**
 * Reaper — transform an app description into a pure S1AF-sovereign spec.
 * Returns the transformed description as a string.
 */
export async function reaperTransform(description: string): Promise<string> {
  logger.info("transform: reaper — harvesting and transforming via Kimi 2.6");

  const transformed = await kimiComplete(
    REAPER_SYSTEM,
    [{ role: "user", content: `Transform this app description into a sovereign S1AF spec:\n\n${description.trim()}` }]
  );

  logger.info(
    { chars: transformed.length },
    "transform: reaper — sovereign spec harvested"
  );

  return transformed;
}

// ── Full transform pipeline ───────────────────────────────────────────────────

export interface TransformPipelineResult {
  gallowsSpec:  string;         // merged spec from gallows
  reaperSpec:   string;         // transformed spec from reaper
  generated:    GeneratedSwiftCode;
  stages: {
    gallows:    boolean;
    reaper:     boolean;
    generate:   boolean;
  };
}

/**
 * Full pipeline: Gallows → Reaper → generateSwiftCode()
 *
 * @param inputs    1–3 app descriptions (text)
 * @param name      Final app name
 * @param platform  "ios" | "macos"
 */
export async function transformPipeline(
  inputs:    string[],
  name:      string,
  platform:  "ios" | "macos" = "ios"
): Promise<TransformPipelineResult> {
  // Stage 1 — Gallows: merge
  const gallowsSpec = await gallowsCombine(inputs);

  // Stage 2 — Reaper: transform
  const reaperSpec = await reaperTransform(gallowsSpec);

  // Stage 3 — Kimi 2.6: generate Swift
  logger.info({ name, platform }, "transform: generating Swift via Kimi 2.6");
  const generated = await generateSwiftCode(reaperSpec, platform, [
    `${IPHONE_XR_SPEC.device} sovereign target — ${IPHONE_XR_SPEC.displaySpec}`,
    `DeviceGuard: height==${IPHONE_XR_SPEC.nativeHeight} && width==${IPHONE_XR_SPEC.nativeWidth} && scale==${IPHONE_XR_SPEC.scale} && faceID`,
    `HardwareSpec.swift constants file — nativeHeight, nativeWidth, displayScale, displaySpec`,
    `BiometricAuthManager — ${IPHONE_XR_SPEC.biometry} gate, no bypass`,
    `${IPHONE_XR_SPEC.chip} Neural Engine — CoreML computeUnits = .all`,
    "Kimi 2.6 integration via SentientBridgeClient",
    "X-Device-Token Keychain auth on every API call",
    "Swift 6 strict concurrency — zero third-party dependencies",
  ]);

  return {
    gallowsSpec,
    reaperSpec,
    generated,
    stages: { gallows: true, reaper: true, generate: true },
  };
}
