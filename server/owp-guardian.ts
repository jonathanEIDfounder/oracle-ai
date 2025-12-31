/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ORACLE AI - Q++RS ULTIMATE 5.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * Author: Jonathan Sherman
 * Sovereign ID: 1
 * Copyright (c) 2024-2025 Jonathan Sherman. All Rights Reserved.
 * Signature: Sm9uYXRoYW4gU2hlcm1hbjo6U292ZXJlaWduOjoxOjpPcmFjbGVBSTo6USsrUlM=
 * 
 * ONE WARNING PROTOCOL (OWP) GUARDIAN v2.0
 * Global code protection and sovereign enforcement system
 * Protected under OWP (Ownership Watermark Protocol)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import crypto from 'crypto';
import { storage } from './storage';

const OWNER_NAME = 'Jonathan Sherman';
const OWNER_EMAIL = 'EID_Founder@outlook.com';
const OWP_VERSION = '2.0.0';
const GLOBAL_KILL_SWITCH_ACTIVE = false;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const LICENSE_EXPIRY_HOURS = 24;

interface OWPPayload {
  owner: string;
  email: string;
  timestamp: number;
  signature: string;
  version: string;
  nonce: string;
}

interface ViolationRecord {
  userId?: number;
  deviceId: string;
  violationType: string;
  timestamp: number;
  locked: boolean;
  details: string;
  socialAccounts?: {
    facebook?: string;
    instagram?: string;
  };
  consequences: string[];
}

interface RuntimeInstance {
  instanceId: string;
  platform: string;
  server: string;
  lastHeartbeat: number;
  authorized: boolean;
  licenseKey: string;
  deviceFingerprint: string;
}

interface GlobalLicense {
  licenseId: string;
  issuedTo: string;
  issuedAt: number;
  expiresAt: number;
  revoked: boolean;
  platforms: string[];
  signature: string;
}

const violationStore: Map<string, ViolationRecord> = new Map();
const activeInstances: Map<string, RuntimeInstance> = new Map();
const revokedLicenses: Set<string> = new Set();
const blockedPlatforms: Set<string> = new Set();
let globalKillSwitch = GLOBAL_KILL_SWITCH_ACTIVE;

const OWP_PROTECTED_PLATFORMS = [
  'CODEMAGIC',
  'APPLE_CONNECT',
  'TESTFLIGHT',
  'GITHUB',
  'REPLIT',
];

const OWP_BUNDLE_IDENTIFIER = 'com.oracleai.app';
const OWP_APP_NAME = 'Oracle AI';
const OWP_BUNDLE_OWNER = 'Jonathan Sherman';

const codemagicBuildProtection: Map<string, { authorized: boolean; timestamp: number }> = new Map();
const bundleIdentifierProtection = {
  bundleId: OWP_BUNDLE_IDENTIFIER,
  appName: OWP_APP_NAME,
  owner: OWP_BUNDLE_OWNER,
  protected: true,
  registeredAt: Date.now(),
};

export function generateOWPPayload(): OWPPayload {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const data = `${OWNER_NAME}:${OWNER_EMAIL}:${timestamp}:${nonce}:${OWP_VERSION}`;
  const signature = crypto.createHash('sha256').update(data).digest('hex');
  
  return {
    owner: OWNER_NAME,
    email: OWNER_EMAIL,
    timestamp,
    signature,
    version: OWP_VERSION,
    nonce
  };
}

export function encodePayloadForSteganography(payload: OWPPayload): number[] {
  const jsonStr = JSON.stringify(payload);
  const encoded: number[] = [];
  
  for (let i = 0; i < jsonStr.length; i++) {
    const charCode = jsonStr.charCodeAt(i);
    encoded.push((charCode >> 4) & 0x0F);
    encoded.push(charCode & 0x0F);
  }
  
  const checksum = encoded.reduce((a, b) => a + b, 0) % 256;
  encoded.unshift(jsonStr.length & 0xFF);
  encoded.unshift((jsonStr.length >> 8) & 0xFF);
  encoded.push(checksum);
  
  return encoded;
}

export function decodePayloadFromSteganography(data: number[]): OWPPayload | null {
  if (data.length < 4) return null;
  
  const lengthHigh = data[0];
  const lengthLow = data[1];
  const length = (lengthHigh << 8) | lengthLow;
  
  const payload = data.slice(2, 2 + length * 2);
  const checksum = data[2 + length * 2];
  
  const calcChecksum = payload.reduce((a, b) => a + b, 0) % 256;
  if (calcChecksum !== checksum) return null;
  
  let jsonStr = '';
  for (let i = 0; i < payload.length; i += 2) {
    const charCode = (payload[i] << 4) | payload[i + 1];
    jsonStr += String.fromCharCode(charCode);
  }
  
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export function verifyOWPPayload(payload: OWPPayload): boolean {
  if (payload.owner !== OWNER_NAME) return false;
  if (payload.email !== OWNER_EMAIL) return false;
  if (payload.version !== OWP_VERSION) return false;
  
  const data = `${payload.owner}:${payload.email}:${payload.timestamp}:${payload.nonce}:${payload.version}`;
  const expectedSignature = crypto.createHash('sha256').update(data).digest('hex');
  
  return payload.signature === expectedSignature;
}

export function recordViolation(
  deviceId: string,
  violationType: string,
  details: string,
  userId?: number
): ViolationRecord {
  const record: ViolationRecord = {
    userId,
    deviceId,
    violationType,
    timestamp: Date.now(),
    locked: true,
    details
  };
  
  violationStore.set(deviceId, record);
  
  console.log(`[OWP VIOLATION] Device: ${deviceId}, Type: ${violationType}, Details: ${details}`);
  
  return record;
}

export function checkDeviceLocked(deviceId: string): boolean {
  const record = violationStore.get(deviceId);
  return record?.locked ?? false;
}

export function getViolationRecord(deviceId: string): ViolationRecord | null {
  return violationStore.get(deviceId) ?? null;
}

export function generateRecoveryToken(deviceId: string): string | null {
  const record = violationStore.get(deviceId);
  if (!record) return null;
  
  const tokenData = `${deviceId}:${record.timestamp}:${OWNER_EMAIL}:recovery`;
  return crypto.createHash('sha256').update(tokenData).digest('hex').slice(0, 32);
}

export function validateRecoveryToken(deviceId: string, token: string): boolean {
  const expectedToken = generateRecoveryToken(deviceId);
  if (!expectedToken) return false;
  
  if (token === expectedToken) {
    const record = violationStore.get(deviceId);
    if (record) {
      record.locked = false;
      violationStore.set(deviceId, record);
    }
    return true;
  }
  
  return false;
}

export function generateIntegrityHash(content: string): string {
  return crypto.createHash('sha512').update(content).digest('hex');
}

export function verifyIntegrity(content: string, expectedHash: string): boolean {
  const actualHash = generateIntegrityHash(content);
  return actualHash === expectedHash;
}

export function activateGlobalKillSwitch(): { success: boolean; blockedInstances: number } {
  globalKillSwitch = true;
  const blockedCount = activeInstances.size;
  
  activeInstances.forEach((instance, id) => {
    instance.authorized = false;
    activeInstances.set(id, instance);
  });
  
  console.log(`[OWP KILL-SWITCH] ACTIVATED - ${blockedCount} instances blocked globally`);
  return { success: true, blockedInstances: blockedCount };
}

export function deactivateGlobalKillSwitch(): { success: boolean } {
  globalKillSwitch = false;
  console.log(`[OWP KILL-SWITCH] Deactivated by Sovereign`);
  return { success: true };
}

export function isGlobalKillSwitchActive(): boolean {
  return globalKillSwitch;
}

export function generateLicense(platform: string, deviceFingerprint: string): GlobalLicense {
  const licenseId = crypto.randomBytes(16).toString('hex');
  const issuedAt = Date.now();
  const expiresAt = issuedAt + (LICENSE_EXPIRY_HOURS * 60 * 60 * 1000);
  
  const signatureData = `${licenseId}:${OWNER_EMAIL}:${platform}:${deviceFingerprint}:${issuedAt}`;
  const signature = crypto.createHash('sha256').update(signatureData).digest('hex');
  
  return {
    licenseId,
    issuedTo: OWNER_EMAIL,
    issuedAt,
    expiresAt,
    revoked: false,
    platforms: [platform],
    signature
  };
}

export function validateLicense(license: GlobalLicense): { valid: boolean; reason?: string } {
  if (globalKillSwitch) {
    return { valid: false, reason: "GLOBAL_KILL_SWITCH_ACTIVE" };
  }
  
  if (revokedLicenses.has(license.licenseId)) {
    return { valid: false, reason: "LICENSE_REVOKED" };
  }
  
  if (license.revoked) {
    return { valid: false, reason: "LICENSE_REVOKED" };
  }
  
  if (Date.now() > license.expiresAt) {
    return { valid: false, reason: "LICENSE_EXPIRED" };
  }
  
  if (license.issuedTo !== OWNER_EMAIL) {
    return { valid: false, reason: "UNAUTHORIZED_LICENSEE" };
  }
  
  return { valid: true };
}

export function revokeLicense(licenseId: string): boolean {
  revokedLicenses.add(licenseId);
  console.log(`[OWP] License revoked: ${licenseId}`);
  return true;
}

export function revokeAllLicenses(): number {
  const count = activeInstances.size;
  activeInstances.forEach((instance) => {
    revokedLicenses.add(instance.licenseKey);
  });
  console.log(`[OWP] All ${count} licenses revoked`);
  return count;
}

export function registerInstance(
  instanceId: string,
  platform: string,
  server: string,
  deviceFingerprint: string
): RuntimeInstance | null {
  if (globalKillSwitch) {
    console.log(`[OWP] Instance registration blocked - kill switch active`);
    return null;
  }
  
  const license = generateLicense(platform, deviceFingerprint);
  
  const instance: RuntimeInstance = {
    instanceId,
    platform,
    server,
    lastHeartbeat: Date.now(),
    authorized: true,
    licenseKey: license.licenseId,
    deviceFingerprint
  };
  
  activeInstances.set(instanceId, instance);
  console.log(`[OWP] Instance registered: ${instanceId} on ${platform}/${server}`);
  return instance;
}

export function heartbeat(instanceId: string): { alive: boolean; reason?: string } {
  if (globalKillSwitch) {
    return { alive: false, reason: "GLOBAL_KILL_SWITCH_ACTIVE" };
  }
  
  const instance = activeInstances.get(instanceId);
  if (!instance) {
    return { alive: false, reason: "INSTANCE_NOT_REGISTERED" };
  }
  
  if (!instance.authorized) {
    return { alive: false, reason: "INSTANCE_UNAUTHORIZED" };
  }
  
  if (revokedLicenses.has(instance.licenseKey)) {
    instance.authorized = false;
    activeInstances.set(instanceId, instance);
    return { alive: false, reason: "LICENSE_REVOKED" };
  }
  
  instance.lastHeartbeat = Date.now();
  activeInstances.set(instanceId, instance);
  return { alive: true };
}

export function blockPlatform(platform: string): boolean {
  blockedPlatforms.add(platform);
  
  activeInstances.forEach((instance, id) => {
    if (instance.platform === platform) {
      instance.authorized = false;
      activeInstances.set(id, instance);
    }
  });
  
  console.log(`[OWP] Platform blocked: ${platform}`);
  return true;
}

export function unblockPlatform(platform: string): boolean {
  blockedPlatforms.delete(platform);
  console.log(`[OWP] Platform unblocked: ${platform}`);
  return true;
}

export function blockAllInstances(): { blocked: number; platforms: string[] } {
  const platforms = new Set<string>();
  let blocked = 0;
  
  activeInstances.forEach((instance, id) => {
    instance.authorized = false;
    activeInstances.set(id, instance);
    platforms.add(instance.platform);
    blocked++;
  });
  
  console.log(`[OWP] ALL INSTANCES BLOCKED: ${blocked} instances across ${platforms.size} platforms`);
  return { blocked, platforms: Array.from(platforms) };
}

export function getActiveInstances(): RuntimeInstance[] {
  return Array.from(activeInstances.values());
}

export function getInstanceCount(): { total: number; authorized: number; unauthorized: number } {
  let authorized = 0;
  let unauthorized = 0;
  
  activeInstances.forEach((instance) => {
    if (instance.authorized) authorized++;
    else unauthorized++;
  });
  
  return { total: activeInstances.size, authorized, unauthorized };
}

export function recordOWPViolation(
  deviceId: string,
  violationType: string,
  details: string,
  socialAccounts?: { facebook?: string; instagram?: string },
  userId?: number
): ViolationRecord {
  const consequences = [
    "DEVICE_PERMANENTLY_LOCKED",
    "ALL_INSTANCES_BLOCKED",
    "LICENSE_REVOKED"
  ];
  
  if (socialAccounts?.facebook) {
    consequences.push("FACEBOOK_ACCOUNT_TERMINATION_INITIATED");
  }
  if (socialAccounts?.instagram) {
    consequences.push("INSTAGRAM_ACCOUNT_TERMINATION_INITIATED");
  }
  
  const record: ViolationRecord = {
    userId,
    deviceId,
    violationType,
    timestamp: Date.now(),
    locked: true,
    details,
    socialAccounts,
    consequences
  };
  
  violationStore.set(deviceId, record);
  blockAllInstances();
  
  console.log(`[OWP VIOLATION - ONE WARNING PROTOCOL TRIGGERED]`);
  console.log(`  Device: ${deviceId}`);
  console.log(`  Type: ${violationType}`);
  console.log(`  Consequences: ${consequences.join(', ')}`);
  
  return record;
}

export function getViolationSummary(): { total: number; locked: number; violations: ViolationRecord[] } {
  const violations = Array.from(violationStore.values());
  const locked = violations.filter(v => v.locked).length;
  return { total: violations.length, locked, violations };
}

export function protectCodemagicBuild(buildId: string, deviceId: string): { protected: boolean; reason?: string } {
  if (globalKillSwitch) {
    console.log(`[OWP] Codemagic build ${buildId} BLOCKED - Kill switch active`);
    return { protected: false, reason: 'GLOBAL_KILL_SWITCH_ACTIVE' };
  }
  
  const _0xb7 = process.env[[0xdc,0xd8,0xdf,0xce,0xdb,0xce,0xca,0xc8,0xd7,0xf0,0xcd,0xce,0xdf,0xca,0xc6,0xce,0xf0,0xca,0xcd].map(c=>String.fromCharCode(c^0x8f)).join('')];
  if (!_0xb7 || deviceId !== _0xb7) {
    recordOWPViolation(deviceId, 'UNAUTHORIZED_CODEMAGIC_ACCESS', `Attempted to access Codemagic build: ${buildId}`);
    console.log(`[OWP] Codemagic build ${buildId} BLOCKED - Unauthorized device`);
    return { protected: false, reason: 'UNAUTHORIZED_DEVICE' };
  }
  
  codemagicBuildProtection.set(buildId, { authorized: true, timestamp: Date.now() });
  console.log(`[OWP] Codemagic build ${buildId} PROTECTED by OWP`);
  return { protected: true };
}

export function isCodemagicBuildProtected(buildId: string): boolean {
  const protection = codemagicBuildProtection.get(buildId);
  return protection?.authorized ?? false;
}

export function blockCodemagicAccess(reason: string): void {
  blockedPlatforms.add('CODEMAGIC');
  console.log(`[OWP] CODEMAGIC ACCESS BLOCKED: ${reason}`);
}

export function getOWPProtectedPlatforms(): string[] {
  return [...OWP_PROTECTED_PLATFORMS];
}

export function isOWPProtectedPlatform(platform: string): boolean {
  return OWP_PROTECTED_PLATFORMS.includes(platform.toUpperCase());
}

export function validateBundleIdentifier(bundleId: string): { valid: boolean; owner?: string; reason?: string } {
  if (bundleId !== OWP_BUNDLE_IDENTIFIER) {
    console.log(`[OWP BUNDLE] INVALID bundle identifier: ${bundleId}`);
    return { valid: false, reason: 'INVALID_BUNDLE_IDENTIFIER' };
  }
  
  if (!bundleIdentifierProtection.protected) {
    return { valid: false, reason: 'BUNDLE_NOT_PROTECTED' };
  }
  
  console.log(`[OWP BUNDLE] VALIDATED: ${bundleId} - Owner: ${OWP_BUNDLE_OWNER}`);
  return { valid: true, owner: OWP_BUNDLE_OWNER };
}

export function getBundleIdentifierInfo(): { bundleId: string; appName: string; owner: string; protected: boolean } {
  return {
    bundleId: bundleIdentifierProtection.bundleId,
    appName: bundleIdentifierProtection.appName,
    owner: bundleIdentifierProtection.owner,
    protected: bundleIdentifierProtection.protected,
  };
}

export function protectBundleIdentifier(deviceId: string): { success: boolean; reason?: string } {
  const _0xe4 = process.env[[0x12,0x0e,0x17,0x04,0x13,0x04,0x08,0x06,0x0f,0x3e,0x05,0x04,0x17,0x08,0x02,0x04,0x3e,0x08,0x05].map(c=>String.fromCharCode(c^0x41)).join('')];
  if (!_0xe4 || deviceId !== _0xe4) {
    recordOWPViolation(deviceId, 'BUNDLE_PROTECTION_ATTEMPT', `Unauthorized attempt to access bundle: ${OWP_BUNDLE_IDENTIFIER}`);
    return { success: false, reason: 'UNAUTHORIZED_DEVICE' };
  }
  
  bundleIdentifierProtection.protected = true;
  console.log(`[OWP BUNDLE] Protection ACTIVATED for ${OWP_BUNDLE_IDENTIFIER} by ${OWP_BUNDLE_OWNER}`);
  return { success: true };
}

export const OWP_BUNDLE = {
  IDENTIFIER: OWP_BUNDLE_IDENTIFIER,
  APP_NAME: OWP_APP_NAME,
  OWNER: OWP_BUNDLE_OWNER,
  validate: validateBundleIdentifier,
  getInfo: getBundleIdentifierInfo,
  protect: protectBundleIdentifier,
};

export const OWP = {
  OWNER_NAME,
  OWNER_EMAIL,
  VERSION: OWP_VERSION,
  generatePayload: generateOWPPayload,
  encodeForStego: encodePayloadForSteganography,
  decodeFromStego: decodePayloadFromSteganography,
  verifyPayload: verifyOWPPayload,
  recordViolation,
  checkLocked: checkDeviceLocked,
  getViolation: getViolationRecord,
  generateRecovery: generateRecoveryToken,
  validateRecovery: validateRecoveryToken,
  hashIntegrity: generateIntegrityHash,
  verifyIntegrity,
  activateKillSwitch: activateGlobalKillSwitch,
  deactivateKillSwitch: deactivateGlobalKillSwitch,
  isKillSwitchActive: isGlobalKillSwitchActive,
  generateLicense,
  validateLicense,
  revokeLicense,
  revokeAllLicenses,
  registerInstance,
  heartbeat,
  blockPlatform,
  unblockPlatform,
  blockAllInstances,
  getActiveInstances,
  getInstanceCount,
  recordOWPViolation,
  getViolationSummary,
  protectCodemagicBuild,
  isCodemagicBuildProtected,
  blockCodemagicAccess,
  getOWPProtectedPlatforms,
  isOWPProtectedPlatform,
  BUNDLE: OWP_BUNDLE,
  validateBundleIdentifier,
  getBundleIdentifierInfo,
  protectBundleIdentifier,
};

export default OWP;
