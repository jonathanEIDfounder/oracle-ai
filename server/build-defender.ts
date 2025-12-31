/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ORACLE AI - Q++RS ULTIMATE 5.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * Author: Jonathan Sherman
 * Sovereign ID: 1
 * Copyright (c) 2024-2025 Jonathan Sherman. All Rights Reserved.
 * Signature: Sm9uYXRoYW4gU2hlcm1hbjo6U292ZXJlaWduOjoxOjpPcmFjbGVBSTo6USsrUlM=
 * 
 * BUILD DEFENDER SYSTEM
 * Defends against: Script attacks, injection, unauthorized triggers
 * Protected under OWP (Ownership Watermark Protocol)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import crypto from 'crypto';

interface RequestFingerprint {
  ip: string;
  userAgent: string;
  timestamp: number;
  nonce: string;
}

interface DefenseLog {
  timestamp: number;
  type: string;
  blocked: boolean;
  reason: string;
  fingerprint: Partial<RequestFingerprint>;
}

const blockedIPs: Set<string> = new Set();
const blockedUserAgents: Set<string> = new Set();
const requestHistory: Map<string, number[]> = new Map();
const usedNonces: Set<string> = new Set();
const defenseLogs: DefenseLog[] = [];

const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5;
const NONCE_EXPIRY = 300000; // 5 minutes

const BLOCKED_PATTERNS = [
  /curl/i,
  /wget/i,
  /python-requests/i,
  /httpie/i,
  /postman/i,
  /insomnia/i,
  /axios/i,
  /node-fetch/i,
  /got\//i,
  /scrapy/i,
  /selenium/i,
  /phantomjs/i,
  /headless/i,
  /bot/i,
  /spider/i,
  /crawler/i,
  /replit/i,
  /Replit/i,
  /REPLIT/i,
];

const BLOCKED_REPLIT_PATTERNS = [
  /replit\.dev/i,
  /replit\.com/i,
  /\.repl\.co/i,
  /replit-agent/i,
  /Replit-Identity/i,
  /X-Replit/i,
];

const blockedReplitUsers: Set<string> = new Set();

const ALLOWED_USER_AGENTS = [
  /^OracleAI\/\d+\.\d+/,
  /^Mozilla.*iPhone.*Safari/,
  /^CFNetwork/,
  /^Darwin/,
];

const SHELL_INJECTION_PATTERNS = [
  /[;&|`$(){}[\]<>\\]/,
  /\beval\b/i,
  /\bexec\b/i,
  /\bsystem\b/i,
  /\bspawn\b/i,
  /\bchild_process\b/i,
  /\brequire\b.*\(/,
  /\bimport\b.*\(/,
  /\b__proto__\b/,
  /\bconstructor\b/,
  /\bprototype\b/,
];

function logDefense(type: string, blocked: boolean, reason: string, fingerprint: Partial<RequestFingerprint>) {
  const log: DefenseLog = {
    timestamp: Date.now(),
    type,
    blocked,
    reason,
    fingerprint,
  };
  defenseLogs.push(log);
  
  if (defenseLogs.length > 1000) {
    defenseLogs.shift();
  }
  
  if (blocked) {
    console.log(`[BUILD DEFENDER] BLOCKED: ${type} - ${reason}`);
  }
}

export function isBlockedUserAgent(userAgent: string): boolean {
  if (!userAgent) return true;
  
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(userAgent)) {
      return true;
    }
  }
  
  if (blockedUserAgents.has(userAgent)) {
    return true;
  }
  
  return false;
}

export function isAllowedUserAgent(userAgent: string): boolean {
  if (!userAgent) return false;
  
  for (const pattern of ALLOWED_USER_AGENTS) {
    if (pattern.test(userAgent)) {
      return true;
    }
  }
  
  return false;
}

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const history = requestHistory.get(ip) || [];
  
  const recentRequests = history.filter(t => now - t < RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  recentRequests.push(now);
  requestHistory.set(ip, recentRequests);
  
  return true;
}

export function validateNonce(nonce: string): boolean {
  if (!nonce || nonce.length < 16) {
    return false;
  }
  
  if (usedNonces.has(nonce)) {
    return false;
  }
  
  usedNonces.add(nonce);
  
  setTimeout(() => {
    usedNonces.delete(nonce);
  }, NONCE_EXPIRY);
  
  return true;
}

export function generateNonce(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function detectShellInjection(input: string): boolean {
  if (!input) return false;
  
  for (const pattern of SHELL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }
  
  return false;
}

export function sanitizeInput(input: string): string {
  if (!input) return '';
  
  return input
    .replace(/[;&|`$(){}[\]<>\\]/g, '')
    .replace(/\.\./g, '')
    .trim()
    .slice(0, 256);
}

export function blockIP(ip: string, reason: string): void {
  blockedIPs.add(ip);
  logDefense('IP_BLOCKED', true, reason, { ip });
}

export function blockUserAgent(userAgent: string, reason: string): void {
  blockedUserAgents.add(userAgent);
  logDefense('USER_AGENT_BLOCKED', true, reason, { userAgent });
}

export function isIPBlocked(ip: string): boolean {
  return blockedIPs.has(ip);
}

export function isReplitUser(headers: Record<string, string | undefined>, origin?: string, referer?: string): boolean {
  for (const [key, value] of Object.entries(headers)) {
    if (/replit/i.test(key) || (value && /replit/i.test(value))) {
      return true;
    }
    for (const pattern of BLOCKED_REPLIT_PATTERNS) {
      if (pattern.test(key) || (value && pattern.test(value))) {
        return true;
      }
    }
  }
  
  if (origin) {
    for (const pattern of BLOCKED_REPLIT_PATTERNS) {
      if (pattern.test(origin)) {
        return true;
      }
    }
  }
  
  if (referer) {
    for (const pattern of BLOCKED_REPLIT_PATTERNS) {
      if (pattern.test(referer)) {
        return true;
      }
    }
  }
  
  return false;
}

export function blockReplitUser(identifier: string, reason: string): void {
  blockedReplitUsers.add(identifier);
  logDefense('REPLIT_USER_BLOCKED', true, reason, { userAgent: identifier });
  console.log(`[BUILD DEFENDER] REPLIT USER PERMANENTLY BLOCKED: ${identifier}`);
}

export function isReplitUserBlocked(identifier: string): boolean {
  return blockedReplitUsers.has(identifier);
}

export interface DefenseResult {
  allowed: boolean;
  reason?: string;
  nonce?: string;
}

export function validateBuildRequest(
  ip: string,
  userAgent: string,
  deviceId: string,
  deviceModel: string,
  nonce?: string
): DefenseResult {
  
  if (isIPBlocked(ip)) {
    logDefense('BUILD_REQUEST', false, 'IP blocked', { ip });
    return { allowed: false, reason: 'Access denied' };
  }
  
  if (isBlockedUserAgent(userAgent)) {
    logDefense('BUILD_REQUEST', false, 'Blocked user agent pattern', { userAgent, ip });
    blockIP(ip, 'Used automated tool');
    return { allowed: false, reason: 'Automated scripts not allowed' };
  }
  
  if (!checkRateLimit(ip)) {
    logDefense('BUILD_REQUEST', false, 'Rate limit exceeded', { ip });
    return { allowed: false, reason: 'Too many requests. Try again later.' };
  }
  
  if (detectShellInjection(deviceId) || detectShellInjection(deviceModel)) {
    logDefense('BUILD_REQUEST', false, 'Shell injection detected', { ip, userAgent });
    blockIP(ip, 'Shell injection attempt');
    return { allowed: false, reason: 'Invalid request' };
  }
  
  if (nonce && !validateNonce(nonce)) {
    logDefense('BUILD_REQUEST', false, 'Invalid or reused nonce', { ip });
    return { allowed: false, reason: 'Invalid request token' };
  }
  
  const newNonce = generateNonce();
  logDefense('BUILD_REQUEST', true, 'Request validated', { ip });
  
  return { allowed: true, nonce: newNonce };
}

export function getDefenseLogs(): DefenseLog[] {
  return [...defenseLogs];
}

export function getBlockedIPs(): string[] {
  return Array.from(blockedIPs);
}

export function getBlockedUserAgents(): string[] {
  return Array.from(blockedUserAgents);
}

export function clearBlocks(): void {
  blockedIPs.clear();
  blockedUserAgents.clear();
}

export const BuildDefender = {
  validateRequest: validateBuildRequest,
  isBlockedUserAgent,
  isAllowedUserAgent,
  checkRateLimit,
  validateNonce,
  generateNonce,
  detectShellInjection,
  sanitizeInput,
  blockIP,
  blockUserAgent,
  isIPBlocked,
  isReplitUser,
  blockReplitUser,
  isReplitUserBlocked,
  getLogs: getDefenseLogs,
  getBlockedIPs,
  getBlockedUserAgents,
  clearBlocks,
};

export default BuildDefender;
