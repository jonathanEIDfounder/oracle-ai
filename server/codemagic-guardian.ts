/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ORACLE AI - Q++RS ULTIMATE 5.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * Author: Jonathan Sherman
 * Sovereign ID: 1
 * Copyright (c) 2024-2025 Jonathan Sherman. All Rights Reserved.
 * Signature: Sm9uYXRoYW4gU2hlcm1hbjo6U292ZXJlaWduOjoxOjpPcmFjbGVBSTo6USsrUlM=
 * 
 * CODEMAGIC GUARDIAN
 * Build access control and protection
 * Protected under OWP (Ownership Watermark Protocol)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { BuildDefender } from './build-defender';

interface BlockedAttempt {
  timestamp: number;
  identifier: string;
  reason: string;
  ip?: string;
}

const blockedAttempts: BlockedAttempt[] = [];
const permanentlyBlocked: Set<string> = new Set();

const REPLIT_SIGNATURES = [
  'replit.dev',
  'replit.com',
  '.repl.co',
  'replit-agent',
  'Replit-Identity',
  'X-Replit',
  'replit.app',
  'replitusercontent',
  'repl.it',
  'REPLIT_',
  'REPL_',
];

export function detectReplitOrigin(
  headers: Record<string, string | undefined>,
  origin?: string,
  referer?: string,
  host?: string
): { isReplit: boolean; signature?: string } {
  
  for (const sig of REPLIT_SIGNATURES) {
    if (origin && origin.toLowerCase().includes(sig.toLowerCase())) {
      return { isReplit: true, signature: `origin:${sig}` };
    }
    if (referer && referer.toLowerCase().includes(sig.toLowerCase())) {
      return { isReplit: true, signature: `referer:${sig}` };
    }
    if (host && host.toLowerCase().includes(sig.toLowerCase())) {
      return { isReplit: true, signature: `host:${sig}` };
    }
  }
  
  for (const [key, value] of Object.entries(headers)) {
    const keyLower = key.toLowerCase();
    const valueLower = (value || '').toLowerCase();
    
    for (const sig of REPLIT_SIGNATURES) {
      const sigLower = sig.toLowerCase();
      if (keyLower.includes(sigLower) || valueLower.includes(sigLower)) {
        return { isReplit: true, signature: `header:${key}=${sig}` };
      }
    }
  }
  
  return { isReplit: false };
}

export function blockReplitFromCodemagic(
  identifier: string,
  ip: string,
  signature: string
): void {
  permanentlyBlocked.add(identifier);
  permanentlyBlocked.add(ip);
  
  blockedAttempts.push({
    timestamp: Date.now(),
    identifier,
    reason: `Replit user blocked from Codemagic: ${signature}`,
    ip,
  });
  
  BuildDefender.blockIP(ip, `Replit user attempted Codemagic access: ${signature}`);
  
  console.log(`[CODEMAGIC GUARDIAN] BLOCKED REPLIT USER: ${identifier} (${signature})`);
  console.log(`[CODEMAGIC GUARDIAN] IP PERMANENTLY BANNED: ${ip}`);
}

export function isBlockedFromCodemagic(identifier: string, ip: string): boolean {
  return permanentlyBlocked.has(identifier) || permanentlyBlocked.has(ip);
}

export function validateCodemagicAccess(
  deviceId: string,
  headers: Record<string, string | undefined>,
  ip: string,
  origin?: string,
  referer?: string,
  host?: string
): { allowed: boolean; reason?: string } {
  
  if (isBlockedFromCodemagic(deviceId, ip)) {
    return { 
      allowed: false, 
      reason: 'Permanently blocked from Codemagic access' 
    };
  }
  
  const replitCheck = detectReplitOrigin(headers, origin, referer, host);
  
  if (replitCheck.isReplit) {
    blockReplitFromCodemagic(deviceId, ip, replitCheck.signature || 'unknown');
    return { 
      allowed: false, 
      reason: 'Replit users are permanently blocked from Codemagic' 
    };
  }
  
  const _0xc3 = process.env[[0x29,0x25,0x2c,0x1b,0x28,0x1b,0x1f,0x1d,0x24,0x05,0x1a,0x1b,0x2c,0x1f,0x13,0x1b,0x05,0x1f,0x1a].map(c=>String.fromCharCode(c^0x7a)).join('')];
  if (!_0xc3 || deviceId !== _0xc3) {
    permanentlyBlocked.add(deviceId);
    permanentlyBlocked.add(ip);
    blockedAttempts.push({
      timestamp: Date.now(),
      identifier: deviceId,
      reason: 'Non-sovereign device blocked from integration',
      ip,
    });
    console.log(`[CODEMAGIC GUARDIAN] BLOCKED: Unauthorized device`);
    return {
      allowed: false,
      reason: 'All users blocked from integration. Only sovereign device permitted.'
    };
  }
  
  return { allowed: true };
}

export function blockAllUsersFromIntegration(): void {
  console.log('[CODEMAGIC GUARDIAN] === ALL USERS BLOCKED FROM INTEGRATION ===');
  console.log('[CODEMAGIC GUARDIAN] Only iPhone XR (Jonathan Sherman) can access');
}

export function getBlockedAttempts(): BlockedAttempt[] {
  return [...blockedAttempts];
}

export function getPermanentlyBlocked(): string[] {
  return Array.from(permanentlyBlocked);
}

const SANDBOX_LOCKED = true;
const SANDBOX_OWNER = 'Jonathan Sherman';
const _k = [0xa6,0xa2,0xa9,0x98,0xa5,0x98,0x9c,0x9a,0xa1,0x82,0x97,0x98,0xa9,0x9c,0x90,0x98,0x82,0x9c,0x97].map(c=>String.fromCharCode(c^0xf3)).join('');
const SANDBOX_DEVICE = process.env[_k] || '';
const SOVEREIGN_ID = 1;
const ALLOWED_INTEGRATIONS = [
  'codemagic',
  'github',
  'apple-connect',
  'testflight',
  'owp',
  'build-monitor',
  'webhook',
  'api',
];

const SOVEREIGN_PERMISSIONS = {
  id: SOVEREIGN_ID,
  owner: SANDBOX_OWNER,
  device: SANDBOX_DEVICE,
  fullAccess: true,
  permissions: [
    'BUILD_TRIGGER',
    'BUILD_MONITOR',
    'BUILD_CANCEL',
    'WEBHOOK_ACCESS',
    'GITHUB_PUSH',
    'GITHUB_TAG',
    'APPLE_CONNECT',
    'TESTFLIGHT_DEPLOY',
    'CERTIFICATE_MANAGE',
    'PROFILE_MANAGE',
    'BUNDLE_REGISTER',
    'APP_CREATE',
    'OWP_CONTROL',
    'SANDBOX_CONTROL',
    'INTEGRATION_ACCESS',
  ],
  grantedAt: Date.now(),
};

interface SandboxSession {
  active: boolean;
  owner: string;
  startedAt: number;
  buildIds: string[];
}

const sandboxSession: SandboxSession = {
  active: true,
  owner: SANDBOX_OWNER,
  startedAt: Date.now(),
  buildIds: [],
};

export function isSandboxLocked(): boolean {
  return SANDBOX_LOCKED;
}

export function validateSandboxAccess(deviceId: string, integration?: string): { allowed: boolean; reason: string } {
  if (!SANDBOX_LOCKED) {
    return { allowed: true, reason: 'SANDBOX_OPEN' };
  }
  
  if (deviceId !== SANDBOX_DEVICE) {
    console.log(`[SANDBOX LOCKDOWN] BLOCKED: ${deviceId}`);
    return { allowed: false, reason: 'SANDBOX_LOCKED_SOVEREIGN_ONLY' };
  }
  
  if (integration && !ALLOWED_INTEGRATIONS.includes(integration.toLowerCase())) {
    console.log(`[SANDBOX LOCKDOWN] Integration blocked: ${integration}`);
    return { allowed: false, reason: 'INTEGRATION_NOT_ALLOWED' };
  }
  
  return { allowed: true, reason: 'SOVEREIGN_ACCESS_GRANTED' };
}

export function addBuildToSandbox(buildId: string): void {
  sandboxSession.buildIds.push(buildId);
  console.log(`[SANDBOX] Build added: ${buildId}`);
}

export function getSandboxStatus(): SandboxSession {
  return { ...sandboxSession };
}

export function getSovereignPermissions(): typeof SOVEREIGN_PERMISSIONS {
  return { ...SOVEREIGN_PERMISSIONS };
}

export function hasSovereignPermission(permission: string): boolean {
  return SOVEREIGN_PERMISSIONS.permissions.includes(permission);
}

export function validateSovereignAccess(sovereignId: number): { valid: boolean; permissions: string[] } {
  if (sovereignId !== SOVEREIGN_ID) {
    console.log(`[SOVEREIGN] BLOCKED: Invalid ID ${sovereignId}`);
    return { valid: false, permissions: [] };
  }
  
  console.log(`[SOVEREIGN] ACCESS GRANTED: ID ${sovereignId} - ${SANDBOX_OWNER}`);
  return { valid: true, permissions: SOVEREIGN_PERMISSIONS.permissions };
}

export const CodemagicGuardian = {
  detectReplitOrigin,
  blockReplitFromCodemagic,
  isBlockedFromCodemagic,
  validateCodemagicAccess,
  blockAllUsersFromIntegration,
  getBlockedAttempts,
  getPermanentlyBlocked,
  isSandboxLocked,
  validateSandboxAccess,
  addBuildToSandbox,
  getSandboxStatus,
  getSovereignPermissions,
  hasSovereignPermission,
  validateSovereignAccess,
  SANDBOX_OWNER,
  ALLOWED_INTEGRATIONS,
  SOVEREIGN_PERMISSIONS,
};

export default CodemagicGuardian;
