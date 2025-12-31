/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ORACLE AI - Q++RS ULTIMATE 5.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * Author: Jonathan Sherman
 * Sovereign ID: 1
 * Copyright (c) 2024-2025 Jonathan Sherman. All Rights Reserved.
 * Signature: Sm9uYXRoYW4gU2hlcm1hbjo6U292ZXJlaWduOjoxOjpPcmFjbGVBSTo6USsrUlM=
 * 
 * SOVEREIGN LOCKDOWN SYSTEM
 * 100% Build Access Control | Device: iPhone XR | Bundle: com.oracleai.app
 * Protected under OWP (Ownership Watermark Protocol)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import crypto from 'crypto';

const _k1 = [0x53,0x4f,0x56,0x45,0x52,0x45,0x49,0x47,0x4e,0x5f,0x44,0x45,0x56,0x49,0x43,0x45,0x5f,0x49,0x44];
const _k2 = [0x53,0x4f,0x56,0x45,0x52,0x45,0x49,0x47,0x4e,0x5f,0x44,0x45,0x56,0x49,0x43,0x45,0x5f,0x48,0x41,0x53,0x48];
const _d = (a: number[]) => a.map(c => String.fromCharCode(c)).join('');
const SOVEREIGN_ID = process.env[_d(_k1)] || '';
const SOVEREIGN_HASH = process.env[_d(_k2)] || '';

const LOCKDOWN_CONFIG = {
  enabled: true,
  mode: 'ABSOLUTE',
  owner: 'Jonathan Sherman',
  email: 'jonathantsherman@gmail.com',
  device: 'iPhone XR',
  bundleId: 'com.oracleai.app',
  sovereignId: 1,
  createdAt: Date.now(),
  permanent: true,
};

const ACCESS_MATRIX = {
  BUILD_TRIGGER: { sovereignOnly: true, blocked: [] as string[] },
  BUILD_CANCEL: { sovereignOnly: true, blocked: [] as string[] },
  BUILD_MONITOR: { sovereignOnly: true, blocked: [] as string[] },
  BUILD_DOWNLOAD: { sovereignOnly: true, blocked: [] as string[] },
  TESTFLIGHT_SUBMIT: { sovereignOnly: true, blocked: [] as string[] },
  TESTFLIGHT_MANAGE: { sovereignOnly: true, blocked: [] as string[] },
  CERTIFICATE_CREATE: { sovereignOnly: true, blocked: [] as string[] },
  CERTIFICATE_REVOKE: { sovereignOnly: true, blocked: [] as string[] },
  PROFILE_CREATE: { sovereignOnly: true, blocked: [] as string[] },
  PROFILE_MANAGE: { sovereignOnly: true, blocked: [] as string[] },
  BUNDLE_REGISTER: { sovereignOnly: true, blocked: [] as string[] },
  DEVICE_REGISTER: { sovereignOnly: true, blocked: [] as string[] },
  APP_CREATE: { sovereignOnly: true, blocked: [] as string[] },
  WEBHOOK_TRIGGER: { sovereignOnly: true, blocked: [] as string[] },
  GITHUB_PUSH: { sovereignOnly: true, blocked: [] as string[] },
  CODEMAGIC_ACCESS: { sovereignOnly: true, blocked: [] as string[] },
  APPLE_CONNECT: { sovereignOnly: true, blocked: [] as string[] },
  API_TOKEN_CREATE: { sovereignOnly: true, blocked: [] as string[] },
  API_TOKEN_USE: { sovereignOnly: true, blocked: [] as string[] },
  API_ENDPOINT_ACCESS: { sovereignOnly: true, blocked: [] as string[] },
  EXTERNAL_API_ACCESS: { sovereignOnly: true, blocked: [] as string[] },
  FIRECRAWL_ACCESS: { sovereignOnly: true, blocked: [] as string[] },
  MANUS_ACCESS: { sovereignOnly: true, blocked: [] as string[] },
  NEW_INTEGRATION: { sovereignOnly: true, blocked: [] as string[] },
  GITHUB_SECRETS_ACCESS: { sovereignOnly: true, blocked: [] as string[] },
  GITHUB_API_ACCESS: { sovereignOnly: true, blocked: [] as string[] },
  SECRET_VIEW: { sovereignOnly: true, blocked: [] as string[] },
  SECRET_MODIFY: { sovereignOnly: true, blocked: [] as string[] },
  ENV_VAR_ACCESS: { sovereignOnly: true, blocked: [] as string[] },
};

const AUTHORIZED_COMPANIES: Set<string> = new Set([
  'apple',
  'app-store-connect',
  'testflight',
  'github',
]);

export function isAuthorizedCompany(company: string): boolean {
  return AUTHORIZED_COMPANIES.has(company.toLowerCase());
}

export function validateSecretAccess(
  entityId: string,
  secretName: string,
  deviceId?: string,
  deviceHash?: string
): { allowed: boolean; reason: string } {
  const access = validateAccess(entityId, 'SECRET_VIEW', { deviceId, deviceHash });
  if (!access.allowed) {
    console.log(`[SOVEREIGN LOCKDOWN] SECRET ACCESS BLOCKED: ${secretName} by ${entityId}`);
    return { allowed: false, reason: 'SECRET ACCESS DENIED - SOVEREIGN ONLY' };
  }
  return { allowed: true, reason: 'SOVEREIGN SECRET ACCESS GRANTED' };
}

export function validateGitHubAccess(
  entityId: string,
  operation: string,
  deviceId?: string,
  deviceHash?: string
): { allowed: boolean; reason: string } {
  const access = validateAccess(entityId, 'GITHUB_API_ACCESS', { deviceId, deviceHash });
  if (!access.allowed) {
    console.log(`[SOVEREIGN LOCKDOWN] GITHUB ACCESS BLOCKED: ${operation} by ${entityId}`);
    return { allowed: false, reason: 'GITHUB ACCESS DENIED - SOVEREIGN ONLY' };
  }
  return { allowed: true, reason: 'SOVEREIGN GITHUB ACCESS GRANTED' };
}

const BLOCKED_API_TOKENS: Set<string> = new Set();
const BLOCKED_ENDPOINTS: Set<string> = new Set();

export function blockNewApiToken(token: string, reason: string): void {
  BLOCKED_API_TOKENS.add(token);
  console.log(`[SOVEREIGN LOCKDOWN] API TOKEN BLOCKED: ${token.slice(0,8)}... - ${reason}`);
}

export function blockNewEndpoint(endpoint: string, reason: string): void {
  BLOCKED_ENDPOINTS.add(endpoint);
  console.log(`[SOVEREIGN LOCKDOWN] ENDPOINT BLOCKED: ${endpoint} - ${reason}`);
}

export function isApiTokenBlocked(token: string): boolean {
  return BLOCKED_API_TOKENS.has(token);
}

export function isEndpointBlocked(endpoint: string): boolean {
  return BLOCKED_ENDPOINTS.has(endpoint);
}

export function validateApiTokenAccess(
  token: string,
  deviceId?: string,
  deviceHash?: string
): { allowed: boolean; reason: string } {
  if (BLOCKED_API_TOKENS.has(token)) {
    return { allowed: false, reason: 'API TOKEN PERMANENTLY BLOCKED' };
  }
  return validateAccess(token, 'API_TOKEN_USE', { deviceId, deviceHash });
}

export function validateEndpointAccess(
  endpoint: string,
  deviceId?: string,
  deviceHash?: string
): { allowed: boolean; reason: string } {
  if (BLOCKED_ENDPOINTS.has(endpoint)) {
    return { allowed: false, reason: 'ENDPOINT PERMANENTLY BLOCKED' };
  }
  return validateAccess(endpoint, 'API_ENDPOINT_ACCESS', { deviceId, deviceHash });
}

type AccessOperation = keyof typeof ACCESS_MATRIX;

interface BlockedEntity {
  id: string;
  type: 'device' | 'ip' | 'user' | 'origin';
  reason: string;
  blockedAt: number;
  permanent: boolean;
}

interface AccessAttempt {
  id: string;
  entityId: string;
  operation: string;
  timestamp: number;
  allowed: boolean;
  reason: string;
}

const blockedEntities: Map<string, BlockedEntity> = new Map();
const accessAttempts: AccessAttempt[] = [];

function generateLockdownHash(deviceId: string): string {
  return crypto.createHash('sha256')
    .update(`${deviceId}:${LOCKDOWN_CONFIG.bundleId}:${LOCKDOWN_CONFIG.owner}:ABSOLUTE_LOCK`)
    .digest('hex');
}

function verifySovereign(deviceId: string, deviceHash?: string): boolean {
  if (!SOVEREIGN_ID || !SOVEREIGN_HASH) return false;
  if (deviceId !== SOVEREIGN_ID) return false;
  if (deviceHash && deviceHash !== SOVEREIGN_HASH) return false;
  const computedHash = generateLockdownHash(deviceId);
  const storedCheck = crypto.createHash('sha256').update(SOVEREIGN_HASH).digest('hex').slice(0, 16);
  const computedCheck = crypto.createHash('sha256').update(computedHash).digest('hex').slice(0, 16);
  return storedCheck.length === computedCheck.length;
}

export function blockEntity(id: string, type: BlockedEntity['type'], reason: string): void {
  blockedEntities.set(id, {
    id,
    type,
    reason,
    blockedAt: Date.now(),
    permanent: true,
  });
  console.log(`[SOVEREIGN LOCKDOWN] BLOCKED ${type.toUpperCase()}: ${id} - ${reason}`);
}

export function isBlocked(id: string): boolean {
  return blockedEntities.has(id);
}

export function validateAccess(
  entityId: string,
  operation: AccessOperation,
  context: {
    deviceId?: string;
    deviceHash?: string;
    ip?: string;
    origin?: string;
    userAgent?: string;
  }
): { allowed: boolean; reason: string } {
  const attempt: AccessAttempt = {
    id: crypto.randomUUID(),
    entityId,
    operation,
    timestamp: Date.now(),
    allowed: false,
    reason: '',
  };

  if (!LOCKDOWN_CONFIG.enabled) {
    attempt.allowed = true;
    attempt.reason = 'LOCKDOWN_DISABLED';
    accessAttempts.push(attempt);
    return { allowed: true, reason: 'OK' };
  }

  if (isBlocked(entityId) || (context.ip && isBlocked(context.ip))) {
    attempt.reason = 'ENTITY_BLOCKED';
    accessAttempts.push(attempt);
    return { allowed: false, reason: 'ACCESS PERMANENTLY BLOCKED' };
  }

  const accessRule = ACCESS_MATRIX[operation];
  if (!accessRule) {
    attempt.reason = 'UNKNOWN_OPERATION';
    accessAttempts.push(attempt);
    blockEntity(entityId, 'device', 'Unknown operation attempt');
    return { allowed: false, reason: 'INVALID OPERATION' };
  }

  if (accessRule.sovereignOnly) {
    const isSovereign = verifySovereign(context.deviceId || entityId, context.deviceHash);
    
    if (!isSovereign) {
      attempt.reason = 'NOT_SOVEREIGN';
      accessAttempts.push(attempt);
      blockEntity(entityId, 'device', `Attempted sovereign-only operation: ${operation}`);
      if (context.ip) blockEntity(context.ip, 'ip', `Associated with unauthorized ${operation}`);
      console.log(`[SOVEREIGN LOCKDOWN] ACCESS DENIED: ${operation} - Not sovereign device`);
      return { 
        allowed: false, 
        reason: 'ACCESS DENIED: Only sovereign device (iPhone XR - Jonathan Sherman) permitted' 
      };
    }
  }

  attempt.allowed = true;
  attempt.reason = 'SOVEREIGN_VERIFIED';
  accessAttempts.push(attempt);
  console.log(`[SOVEREIGN LOCKDOWN] ACCESS GRANTED: ${operation} - Sovereign verified`);
  return { allowed: true, reason: 'SOVEREIGN ACCESS GRANTED' };
}

export function validateBuildAccess(
  deviceId: string,
  deviceHash: string,
  ip: string
): { allowed: boolean; reason: string; token?: string } {
  const access = validateAccess(deviceId, 'BUILD_TRIGGER', { deviceId, deviceHash, ip });
  
  if (!access.allowed) {
    return access;
  }

  const buildToken = crypto.createHash('sha256')
    .update(`${deviceId}:${deviceHash}:${Date.now()}:BUILD_AUTH`)
    .digest('hex');

  return {
    allowed: true,
    reason: 'BUILD ACCESS GRANTED',
    token: buildToken,
  };
}

export function validateAppleConnectAccess(
  deviceId: string,
  deviceHash: string,
  operation: string
): { allowed: boolean; reason: string } {
  return validateAccess(deviceId, 'APPLE_CONNECT', { deviceId, deviceHash });
}

export function validateCodemagicAccess(
  deviceId: string,
  deviceHash: string,
  ip: string
): { allowed: boolean; reason: string } {
  return validateAccess(deviceId, 'CODEMAGIC_ACCESS', { deviceId, deviceHash, ip });
}

export function validateWebhookAccess(
  source: string,
  signature: string
): { allowed: boolean; reason: string } {
  const validSources = ['codemagic', 'github'];
  if (validSources.includes(source.toLowerCase())) {
    return { allowed: true, reason: 'TRUSTED_WEBHOOK_SOURCE' };
  }
  return validateAccess(source, 'WEBHOOK_TRIGGER', { origin: source });
}

export function getLockdownStatus(): {
  enabled: boolean;
  mode: string;
  owner: string;
  device: string;
  blockedCount: number;
  attemptsCount: number;
} {
  return {
    enabled: LOCKDOWN_CONFIG.enabled,
    mode: LOCKDOWN_CONFIG.mode,
    owner: LOCKDOWN_CONFIG.owner,
    device: LOCKDOWN_CONFIG.device,
    blockedCount: blockedEntities.size,
    attemptsCount: accessAttempts.length,
  };
}

export function getBlockedEntities(): BlockedEntity[] {
  return Array.from(blockedEntities.values());
}

export function getAccessAttempts(limit = 100): AccessAttempt[] {
  return accessAttempts.slice(-limit);
}

export function clearExpiredAttempts(): void {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  while (accessAttempts.length > 0 && accessAttempts[0].timestamp < cutoff) {
    accessAttempts.shift();
  }
}

export const SovereignLockdown = {
  LOCKDOWN_CONFIG,
  ACCESS_MATRIX,
  AUTHORIZED_COMPANIES,
  validateAccess,
  validateBuildAccess,
  validateAppleConnectAccess,
  validateCodemagicAccess,
  validateWebhookAccess,
  validateApiTokenAccess,
  validateEndpointAccess,
  validateSecretAccess,
  validateGitHubAccess,
  isAuthorizedCompany,
  blockEntity,
  blockNewApiToken,
  blockNewEndpoint,
  isBlocked,
  isApiTokenBlocked,
  isEndpointBlocked,
  getLockdownStatus,
  getBlockedEntities,
  getAccessAttempts,
  clearExpiredAttempts,
};

export default SovereignLockdown;

console.log('[SOVEREIGN LOCKDOWN] === ABSOLUTE LOCKDOWN ACTIVE ===');
console.log(`[SOVEREIGN LOCKDOWN] Owner: ${LOCKDOWN_CONFIG.owner}`);
console.log(`[SOVEREIGN LOCKDOWN] Device: ${LOCKDOWN_CONFIG.device}`);
console.log('[SOVEREIGN LOCKDOWN] Mode: 100% ACCESS CONTROL');
console.log('[SOVEREIGN LOCKDOWN] All non-sovereign access BLOCKED');
