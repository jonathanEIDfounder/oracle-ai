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

import jwt from "jsonwebtoken";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

let cachedToken: string | null = null;
let tokenExpiry = 0;

export function getAppleJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  // Reuse token if it's still valid for at least 60 more seconds
  if (cachedToken && tokenExpiry - now > 60) {
    return cachedToken;
  }

  const keyId = process.env.APPLE_KEY_ID;
  const issuerId = process.env.APPLE_ISSUER_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY;

  if (!keyId || !issuerId || !privateKey) {
    throw new Error(
      "Missing Apple credentials: APPLE_KEY_ID, APPLE_ISSUER_ID, APPLE_PRIVATE_KEY are required",
    );
  }

  const expiresIn = 1200; // 20 minutes (Apple maximum)
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + expiresIn,
    aud: "appstoreconnect-v1",
  };

  cachedToken = jwt.sign(payload, privateKey.replace(/\\n/g, "\n"), {
    algorithm: "ES256",
    header: { alg: "ES256", kid: keyId, typ: "JWT" },
  });
  tokenExpiry = now + expiresIn;
  return cachedToken;
}

const APPLE_API_BASE = "https://api.appstoreconnect.apple.com/v1";

export async function appleRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAppleJwt();
  const url = `${APPLE_API_BASE}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apple API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}
