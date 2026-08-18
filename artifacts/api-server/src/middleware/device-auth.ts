/**
 * © 2026 Jonathan Sherman — S1AF (Sentient iOS One-Step App Framework)
 * Sovereign ID: 1 · OCSO-S1AF-GOV-1 · All rights reserved.
 *
 * requireIphoneXR — Express middleware
 *
 * Reads X-Device-Token from the request header.
 * Verifies it against the stored iPhone XR binding.
 * Rejects with 403 if missing, unbound, or wrong device.
 */

import type { Request, Response, NextFunction } from "express";
import { verifyDeviceToken, isDeviceBound, AUTHORIZED_DEVICE } from "../lib/device-lock";
import { logger } from "../lib/logger";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "../lib/authorship";
void _S1AF_ANCHOR;

export async function requireIphoneXR(
  req:  Request,
  res:  Response,
  next: NextFunction
): Promise<void> {
  const token = (req.headers["x-device-token"] as string | undefined)?.trim();

  // ── No token presented ────────────────────────────────────────────────────
  if (!token) {
    const bound = await isDeviceBound();
    if (!bound) {
      // Not yet enrolled — return guidance
      res.status(403).json({
        error:    "device_not_enrolled",
        message:  `No ${AUTHORIZED_DEVICE} device is enrolled. POST /api/sentient/bind-device to enroll.`,
        device:   AUTHORIZED_DEVICE,
      });
    } else {
      res.status(401).json({
        error:   "device_token_required",
        message: `X-Device-Token header is required. Only ${AUTHORIZED_DEVICE} is authorized.`,
        device:  AUTHORIZED_DEVICE,
      });
    }
    return;
  }

  // ── Verify token ──────────────────────────────────────────────────────────
  const valid = await verifyDeviceToken(token);
  if (!valid) {
    logger.warn(
      { ip: req.ip, path: req.path, tokenPrefix: token.slice(0, 8) + "…" },
      `device-auth: REJECTED — invalid token or non-${AUTHORIZED_DEVICE} device`
    );
    res.status(403).json({
      error:   "device_unauthorized",
      message: `Access denied. Only ${AUTHORIZED_DEVICE} is authorized to access this resource.`,
      device:  AUTHORIZED_DEVICE,
    });
    return;
  }

  next();
}
