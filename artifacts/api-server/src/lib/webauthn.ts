/**
 * © 2026 Jonathan Sherman — S1AF · OCSO-S1AF-GOV-1
 * WebAuthn sovereign credential store — single-user, single-device.
 *
 * Challenge TTL  : 5 minutes
 * Credential store: memory + $DATA_DIR/webauthn-credential.json fallback
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationInfo,
  type VerifiedAuthenticationInfo,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/types";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { logger } from "./logger";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

// ── Stored credential (single sovereign user) ─────────────────────────────────
interface SovereignCredential {
  credentialID:        string;          // base64url
  credentialPublicKey: string;          // base64url
  counter:             number;
  transports?:         string[];
}

// ── In-memory stores ──────────────────────────────────────────────────────────
const CHALLENGES = new Map<string, { challenge: string; expiresAt: number }>();
const CRED_PATH  = join(process.env["DATA_DIR"] ?? "/tmp", "s1af-webauthn-cred.json");

let _credential: SovereignCredential | null = null;

// ── Persist / load credential ─────────────────────────────────────────────────
function loadCredential(): void {
  try {
    const raw  = readFileSync(CRED_PATH, "utf8");
    _credential = JSON.parse(raw) as SovereignCredential;
    logger.info({ id: _credential.credentialID.slice(0, 12) + "…" }, "webauthn: credential loaded");
  } catch {
    _credential = null;
  }
}

function persistCredential(cred: SovereignCredential): void {
  try {
    mkdirSync(join(process.env["DATA_DIR"] ?? "/tmp"), { recursive: true });
    writeFileSync(CRED_PATH, JSON.stringify(cred, null, 2), "utf8");
  } catch (e) {
    logger.warn({ err: e }, "webauthn: could not persist credential to disk");
  }
}

// Load on module init
loadCredential();

// ── RP helpers ────────────────────────────────────────────────────────────────
export function rpFromOrigin(origin: string): { rpID: string; rpName: string } {
  try {
    const host = new URL(origin).hostname;
    return { rpID: host, rpName: "S1AF Sovereign Platform" };
  } catch {
    return { rpID: "localhost", rpName: "S1AF Sovereign Platform" };
  }
}

// ── Challenge helpers ─────────────────────────────────────────────────────────
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function storeChallenge(sessionKey: string, challenge: string): void {
  CHALLENGES.set(sessionKey, { challenge, expiresAt: Date.now() + CHALLENGE_TTL_MS });
  // GC: remove expired challenges
  for (const [k, v] of CHALLENGES) {
    if (v.expiresAt < Date.now()) CHALLENGES.delete(k);
  }
}

function consumeChallenge(sessionKey: string): string | null {
  const entry = CHALLENGES.get(sessionKey);
  if (!entry || entry.expiresAt < Date.now()) {
    CHALLENGES.delete(sessionKey);
    return null;
  }
  CHALLENGES.delete(sessionKey);
  return entry.challenge;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function isRegistered(): boolean {
  return _credential !== null;
}

export async function buildRegistrationOptions(origin: string, sessionKey: string) {
  const { rpID, rpName } = rpFromOrigin(origin);
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName:              "jonathan.sherman",
    userDisplayName:       "Jonathan Sherman — OCSO-S1AF-GOV-1",
    attestationType:       "none",
    authenticatorSelection: {
      authenticatorAttachment: "platform",        // device-native (Face ID / Touch ID)
      residentKey:             "required",
      userVerification:        "required",
    },
    supportedAlgorithmIDs: [-7, -257],            // ES256, RS256
  });

  storeChallenge(sessionKey, options.challenge);
  return options;
}

export async function completeRegistration(
  origin:      string,
  sessionKey:  string,
  response:    RegistrationResponseJSON,
): Promise<VerifiedRegistrationInfo> {
  const { rpID } = rpFromOrigin(origin);
  const challenge = consumeChallenge(sessionKey);
  if (!challenge) throw new Error("Challenge expired or not found");

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin:    origin,
    expectedRPID:      rpID,
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Registration verification failed");
  }

  const info = verification.registrationInfo;
  const cred: SovereignCredential = {
    credentialID:        Buffer.from(info.credential.id).toString("base64url"),
    credentialPublicKey: Buffer.from(info.credential.publicKey).toString("base64url"),
    counter:             info.credential.counter,
    transports:          response.response.transports ?? [],
  };

  _credential = cred;
  persistCredential(cred);
  logger.info({ id: cred.credentialID.slice(0, 12) + "…" }, "webauthn: sovereign credential registered");
  return verification.registrationInfo;
}

export async function buildAuthenticationOptions(origin: string, sessionKey: string) {
  const { rpID } = rpFromOrigin(origin);
  if (!_credential) throw new Error("No sovereign credential registered");

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: [{
      id:         _credential.credentialID,
      transports: (_credential.transports ?? []) as AuthenticatorTransport[],
    }],
    userVerification: "required",
  });

  storeChallenge(sessionKey, options.challenge);
  return options;
}

export async function completeAuthentication(
  origin:     string,
  sessionKey: string,
  response:   AuthenticationResponseJSON,
): Promise<VerifiedAuthenticationInfo> {
  const { rpID } = rpFromOrigin(origin);
  if (!_credential) throw new Error("No sovereign credential registered");

  const challenge = consumeChallenge(sessionKey);
  if (!challenge) throw new Error("Challenge expired or not found");

  const cred = _credential;

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge:       challenge,
    expectedOrigin:          origin,
    expectedRPID:            rpID,
    requireUserVerification: true,
    credential: {
      id:         cred.credentialID,
      publicKey:  Buffer.from(cred.credentialPublicKey, "base64url"),
      counter:    cred.counter,
      transports: (cred.transports ?? []) as AuthenticatorTransport[],
    },
  });

  if (!verification.verified) throw new Error("Authentication verification failed");

  // Advance counter
  _credential.counter = verification.authenticationInfo.newCounter;
  persistCredential(_credential);
  logger.info({ counter: _credential.counter }, "webauthn: sovereign authentication verified");
  return verification.authenticationInfo;
}
