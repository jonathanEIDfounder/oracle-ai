/**
 * © 2026 Jonathan Sherman — S1AF (Sentient iOS One-Step App Framework)
 * Sovereign ID: 1 · OCSO-S1AF-GOV-1 · All rights reserved.
 *
 * Device Lock — iPhone XR Only
 *
 * All sovereign API endpoints (projects, keyword-registry, class-index,
 * automate, kimi generate) are bound exclusively to the authorized device.
 * Any request not presenting a valid iPhone XR device token is rejected 403.
 *
 * Enrollment:  POST /api/sentient/bind-device  (requires X-Deploy-Secret)
 * Verification: X-Device-Token header on every protected request.
 */

import crypto from "node:crypto";
import { db } from "@workspace/db";
import { deviceBindingTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CONFIG } from "./config";
import { logger } from "./logger";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

// ── Constants ─────────────────────────────────────────────────────────────────

export const AUTHORIZED_DEVICE        = "iPhone XR"   as const;

/** Exact hardware profile — all four must match for device authorization */
export const IPHONE_XR_NATIVE_HEIGHT  = 1792           as const;  // pts
export const IPHONE_XR_NATIVE_WIDTH   = 828            as const;  // pts
export const IPHONE_XR_SCALE          = 2.0            as const;  // @2x
export const IPHONE_XR_CHIP           = "A12 Bionic"  as const;
export const IPHONE_XR_BIOMETRY       = "Face ID"      as const;

export const IPHONE_XR_SPEC = {
  device:       AUTHORIZED_DEVICE,
  nativeHeight: IPHONE_XR_NATIVE_HEIGHT,
  nativeWidth:  IPHONE_XR_NATIVE_WIDTH,
  scale:        IPHONE_XR_SCALE,
  chip:         IPHONE_XR_CHIP,
  biometry:     IPHONE_XR_BIOMETRY,
  displaySpec:  "1792×828 @2x Face ID A12 Bionic",
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function deploySecret(): string {
  const s = CONFIG.deploySecret ?? process.env.DEPLOY_SECRET ?? "";
  if (!s) throw new Error("DEPLOY_SECRET not configured — cannot operate device lock");
  return s;
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Generate a device token — HMAC-SHA256 of deviceId with DEPLOY_SECRET.
 * The raw token is returned to the enrolling device once and never stored.
 * Only the SHA-256 hash of the token is persisted in the DB.
 */
export function generateDeviceToken(deviceId: string): string {
  return crypto
    .createHmac("sha256", deploySecret())
    .update(deviceId)
    .digest("hex");
}

// ── In-memory binding cache (refreshed on first check after restart) ──────────

interface CachedBinding {
  tokenHash:    string;
  deviceModel:  string;
  deviceIdHash: string;
  active:       boolean;
}

let _cached:     CachedBinding | null | undefined = undefined; // undefined = not loaded
let _cachedAt:   number = 0;
const CACHE_TTL  = 30_000; // 30s — re-read from DB after key rotation or re-enrollment

async function loadBinding(): Promise<CachedBinding | null> {
  const now = Date.now();
  if (_cached !== undefined && now - _cachedAt < CACHE_TTL) return _cached;

  try {
    const [row] = await db
      .select()
      .from(deviceBindingTable)
      .where(eq(deviceBindingTable.active, true))
      .limit(1);

    _cached   = row
      ? { tokenHash: row.tokenHash, deviceModel: row.deviceModel, deviceIdHash: row.deviceIdHash, active: row.active }
      : null;
    _cachedAt = now;
    return _cached;
  } catch {
    return _cached ?? null; // use stale cache if DB unreachable
  }
}

function invalidateCache() {
  _cached   = undefined;
  _cachedAt = 0;
}

// ── Core operations ───────────────────────────────────────────────────────────

/**
 * Bind an iPhone XR device. Rejects any other device model.
 * Only one active binding is permitted — call deactivateBinding() first to re-enroll.
 * Returns the raw device token (shown once, never stored).
 */
export async function bindDevice(
  deviceId:    string,
  deviceModel: string
): Promise<{ token: string; boundAt: string }> {
  if (deviceModel !== AUTHORIZED_DEVICE) {
    throw new Error(
      `Device not authorized. Only "${AUTHORIZED_DEVICE}" is permitted. Received: "${deviceModel}"`
    );
  }
  if (!deviceId || deviceId.trim().length < 8) {
    throw new Error("deviceId must be at least 8 characters");
  }

  const existing = await loadBinding();
  if (existing?.active) {
    throw new Error("A device is already bound. Deactivate the existing binding before re-enrolling.");
  }

  const token      = generateDeviceToken(deviceId.trim());
  const tokenHash  = sha256(token);
  const deviceIdHash = sha256(deviceId.trim());

  await db.insert(deviceBindingTable).values({
    deviceIdHash,
    deviceModel,
    tokenHash,
    active: true,
  });

  invalidateCache();

  logger.info(
    { deviceModel, deviceIdHash: deviceIdHash.slice(0, 12) + "…" },
    "device-lock: iPhone XR bound — sovereign device enrollment complete"
  );

  return { token, boundAt: new Date().toISOString() };
}

/**
 * Verify a raw device token presented in a request header.
 * Returns true only if: token hash matches, device is iPhone XR, binding is active.
 */
export async function verifyDeviceToken(token: string): Promise<boolean> {
  if (!token) return false;

  const binding = await loadBinding();
  if (!binding || !binding.active) return false;
  if (binding.deviceModel !== AUTHORIZED_DEVICE) return false;

  const presented = sha256(token);
  const match     = crypto.timingSafeEqual(
    Buffer.from(presented),
    Buffer.from(binding.tokenHash)
  );

  if (match) {
    // Touch lastSeenAt asynchronously — don't block the request
    db.update(deviceBindingTable)
      .set({ lastSeenAt: new Date() })
      .where(eq(deviceBindingTable.active, true))
      .catch(() => {/* non-critical */});
  }

  return match;
}

/** Returns the current binding metadata (no token, no raw IDs). */
export async function getDeviceBinding() {
  const binding = await loadBinding();
  if (!binding) return null;
  return {
    bound:        true,
    deviceModel:  binding.deviceModel,
    active:       binding.active,
    authorized:   binding.deviceModel === AUTHORIZED_DEVICE,
  };
}

export async function isDeviceBound(): Promise<boolean> {
  const b = await loadBinding();
  return !!b?.active;
}

/** Deactivate all bindings (sovereign override only — requires DEPLOY_SECRET separately). */
export async function deactivateBinding(): Promise<void> {
  await db
    .update(deviceBindingTable)
    .set({ active: false })
    .where(eq(deviceBindingTable.active, true));
  invalidateCache();
  logger.warn("device-lock: all device bindings deactivated");
}
