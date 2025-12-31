/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ORACLE AI - Q++RS ULTIMATE 5.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * Author: Jonathan Sherman
 * Sovereign ID: 1
 * Copyright (c) 2024-2025 Jonathan Sherman. All Rights Reserved.
 * Signature: Sm9uYXRoYW4gU2hlcm1hbjo6U292ZXJlaWduOjoxOjpPcmFjbGVBSTo6USsrUlM=
 * 
 * APPLE API ACCESS CONTROL SYSTEM
 * Exclusive Access: Jonathan Sherman's iPhone XR | Bundle: com.oracleai.app
 * Protected under OWP (Ownership Watermark Protocol)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import crypto from 'crypto';
import { OWP } from './owp-guardian';

const _q = [0x53,0x4f,0x56,0x45,0x52,0x45,0x49,0x47,0x4e,0x5f,0x44,0x45,0x56,0x49,0x43,0x45,0x5f,0x49,0x44];
const _r = [0x53,0x4f,0x56,0x45,0x52,0x45,0x49,0x47,0x4e,0x5f,0x44,0x45,0x56,0x49,0x43,0x45,0x5f,0x48,0x41,0x53,0x48];
const _d = (a: number[]) => a.reduce((s,c)=>s+String.fromCharCode(c^0x0),'');
const _0x7f = process.env[_d(_q)];
const _0x8a = process.env[_d(_r)];

const SOVEREIGN_DEVICE = {
  owner: 'Jonathan Sherman',
  email: 'jonathantsherman@gmail.com',
  appleConnectEmail: 'jonathantsherman@gmail.com',
  deviceModel: 'iPhone XR',
  bundleId: 'com.oracleai.app',
  deviceHash: _0x8a || '',
};

const APPLE_API_OPERATIONS = [
  'REGISTER_BUNDLE_ID',
  'CREATE_CERTIFICATE',
  'CREATE_PROVISIONING_PROFILE',
  'SUBMIT_TO_TESTFLIGHT',
  'REGISTER_DEVICE',
  'CREATE_APP',
  'GENERATE_JWT',
  'FETCH_SIGNING_FILES',
] as const;

type AppleOperation = typeof APPLE_API_OPERATIONS[number];

interface AppleAccessRequest {
  deviceId: string;
  deviceModel: string;
  bundleId: string;
  operation: AppleOperation;
  timestamp: number;
  signature: string;
}

interface AppleAccessLog {
  requestId: string;
  deviceId: string;
  operation: AppleOperation;
  timestamp: number;
  authorized: boolean;
  reason?: string;
}

const accessLogs: AppleAccessLog[] = [];
const blockedDevices: Set<string> = new Set();
let sovereignDeviceId: string | null = _0x7f || null;
let accessLocked = !_0x7f;

const APPLE_CONNECT_BINDING = {
  bound: !!_0x7f,
  deviceId: _0x7f || null,
  deviceHash: _0x8a || null,
  deviceModel: 'iPhone XR',
  serialBound: true,
  serialHash: _0x8a ? crypto.createHash('sha256').update(`${_0x7f}:iPhone XR:SERIAL_LOCK`).digest('hex') : null,
  boundAt: Date.now(),
  permanent: true,
  immutable: true,
  operations: {
    certificates: true,
    profiles: true,
    bundleIds: true,
    devices: true,
    apps: true,
    testflight: true,
    jwt: true,
  },
};

function validateDeviceBinding(deviceId: string): boolean {
  if (!APPLE_CONNECT_BINDING.bound) return false;
  if (!APPLE_CONNECT_BINDING.deviceId) return false;
  if (!APPLE_CONNECT_BINDING.serialBound) return false;
  if (deviceId !== APPLE_CONNECT_BINDING.deviceId) return false;
  const serialCheck = crypto.createHash('sha256').update(`${deviceId}:iPhone XR:SERIAL_LOCK`).digest('hex');
  return serialCheck === APPLE_CONNECT_BINDING.serialHash;
}

function generateDeviceHash(deviceId: string, deviceModel: string): string {
  const data = `${deviceId}:${deviceModel}:${SOVEREIGN_DEVICE.bundleId}:ORACLE_AI_SOVEREIGN`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

function generateRequestSignature(request: Omit<AppleAccessRequest, 'signature'>): string {
  const data = `${request.deviceId}:${request.operation}:${request.timestamp}:${SOVEREIGN_DEVICE.bundleId}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function registerSovereignDevice(deviceId: string, deviceModel: string): { success: boolean; message: string } {
  if (deviceModel !== SOVEREIGN_DEVICE.deviceModel) {
    const log: AppleAccessLog = {
      requestId: crypto.randomUUID(),
      deviceId,
      operation: 'REGISTER_BUNDLE_ID',
      timestamp: Date.now(),
      authorized: false,
      reason: `INVALID_DEVICE_MODEL: Expected ${SOVEREIGN_DEVICE.deviceModel}, got ${deviceModel}`,
    };
    accessLogs.push(log);
    blockedDevices.add(deviceId);
    
    console.log(`[APPLE ACCESS] BLOCKED: Device ${deviceId} (${deviceModel}) - Not iPhone XR`);
    return { success: false, message: 'ACCESS DENIED: Only iPhone XR is authorized' };
  }
  
  if (sovereignDeviceId && sovereignDeviceId !== deviceId) {
    console.log(`[APPLE ACCESS] BLOCKED: Attempt to register second device`);
    return { success: false, message: 'ACCESS DENIED: Sovereign device already registered' };
  }
  
  sovereignDeviceId = deviceId;
  SOVEREIGN_DEVICE.deviceHash = generateDeviceHash(deviceId, deviceModel);
  accessLocked = false;
  
  console.log(`[APPLE ACCESS] SOVEREIGN REGISTERED: ${deviceId} (${deviceModel})`);
  console.log(`[APPLE ACCESS] Owner: ${SOVEREIGN_DEVICE.owner}`);
  console.log(`[APPLE ACCESS] Apple API access UNLOCKED`);
  
  return { success: true, message: 'Sovereign device registered. Apple API access granted.' };
}

export function validateAppleAccess(request: AppleAccessRequest): { authorized: boolean; reason?: string } {
  const log: AppleAccessLog = {
    requestId: crypto.randomUUID(),
    deviceId: request.deviceId,
    operation: request.operation,
    timestamp: Date.now(),
    authorized: false,
  };
  
  // Check device binding first - Apple Connect is permanently bound
  if (!validateDeviceBinding(request.deviceId)) {
    log.reason = 'DEVICE_BINDING_FAILED';
    accessLogs.push(log);
    blockedDevices.add(request.deviceId);
    OWP.recordOWPViolation(request.deviceId, 'APPLE_CONNECT_BINDING_VIOLATION', 'Attempted access to bound Apple Connect');
    console.log(`[APPLE CONNECT] BINDING VIOLATION - Device not bound`);
    return { authorized: false, reason: 'Apple Connect permanently bound to sovereign device' };
  }

  // Check global kill switch
  if (OWP.isKillSwitchActive()) {
    log.reason = 'GLOBAL_KILL_SWITCH_ACTIVE';
    accessLogs.push(log);
    return { authorized: false, reason: 'System locked by sovereign' };
  }
  
  // Check if access is locked
  if (accessLocked) {
    log.reason = 'ACCESS_LOCKED_NO_SOVEREIGN';
    accessLogs.push(log);
    return { authorized: false, reason: 'Apple API locked - no sovereign device registered' };
  }
  
  // Check if device is blocked
  if (blockedDevices.has(request.deviceId)) {
    log.reason = 'DEVICE_BLOCKED';
    accessLogs.push(log);
    return { authorized: false, reason: 'Device permanently blocked' };
  }
  
  // Check if OWP has locked this device
  if (OWP.checkLocked(request.deviceId)) {
    log.reason = 'OWP_DEVICE_LOCKED';
    accessLogs.push(log);
    return { authorized: false, reason: 'Device locked by OWP violation' };
  }
  
  // Verify this is the sovereign device
  if (request.deviceId !== sovereignDeviceId) {
    log.reason = 'NOT_SOVEREIGN_DEVICE';
    accessLogs.push(log);
    blockedDevices.add(request.deviceId);
    
    // Record OWP violation for unauthorized Apple API access attempt
    OWP.recordOWPViolation(
      request.deviceId,
      'UNAUTHORIZED_APPLE_API_ACCESS',
      `Attempted ${request.operation} from non-sovereign device`,
    );
    
    console.log(`[APPLE ACCESS] VIOLATION: ${request.deviceId} attempted ${request.operation}`);
    return { authorized: false, reason: 'ACCESS DENIED: Only sovereign device can access Apple APIs' };
  }
  
  // Verify device model
  if (request.deviceModel !== SOVEREIGN_DEVICE.deviceModel) {
    log.reason = 'DEVICE_MODEL_MISMATCH';
    accessLogs.push(log);
    return { authorized: false, reason: 'Device model does not match registered sovereign' };
  }
  
  // Verify bundle ID
  if (request.bundleId !== SOVEREIGN_DEVICE.bundleId) {
    log.reason = 'BUNDLE_ID_MISMATCH';
    accessLogs.push(log);
    return { authorized: false, reason: 'Invalid bundle ID' };
  }
  
  // Verify signature
  const expectedSig = generateRequestSignature({
    deviceId: request.deviceId,
    deviceModel: request.deviceModel,
    bundleId: request.bundleId,
    operation: request.operation,
    timestamp: request.timestamp,
  });
  
  if (request.signature !== expectedSig) {
    log.reason = 'INVALID_SIGNATURE';
    accessLogs.push(log);
    return { authorized: false, reason: 'Invalid request signature' };
  }
  
  // Check timestamp (5 minute window)
  const now = Date.now();
  if (Math.abs(now - request.timestamp) > 5 * 60 * 1000) {
    log.reason = 'EXPIRED_REQUEST';
    accessLogs.push(log);
    return { authorized: false, reason: 'Request expired' };
  }
  
  // All checks passed
  log.authorized = true;
  accessLogs.push(log);
  
  console.log(`[APPLE ACCESS] AUTHORIZED: ${request.operation} from sovereign device`);
  return { authorized: true };
}

export function createAppleAccessRequest(
  deviceId: string,
  deviceModel: string,
  operation: AppleOperation
): AppleAccessRequest {
  const timestamp = Date.now();
  const partialRequest = {
    deviceId,
    deviceModel,
    bundleId: SOVEREIGN_DEVICE.bundleId,
    operation,
    timestamp,
  };
  
  return {
    ...partialRequest,
    signature: generateRequestSignature(partialRequest),
  };
}

export function lockAppleAccess(): { success: boolean } {
  accessLocked = true;
  console.log(`[APPLE ACCESS] LOCKED: All Apple API operations disabled`);
  return { success: true };
}

export function unlockAppleAccess(deviceId: string): { success: boolean; reason?: string } {
  if (deviceId !== sovereignDeviceId) {
    return { success: false, reason: 'Only sovereign device can unlock' };
  }
  accessLocked = false;
  console.log(`[APPLE ACCESS] UNLOCKED by sovereign`);
  return { success: true };
}

export function getAccessLogs(): AppleAccessLog[] {
  return [...accessLogs];
}

export function getBlockedDevices(): string[] {
  return Array.from(blockedDevices);
}

export function isAppleAccessLocked(): boolean {
  return accessLocked;
}

export function getSovereignStatus(): {
  registered: boolean;
  deviceModel: string;
  owner: string;
  accessLocked: boolean;
} {
  return {
    registered: sovereignDeviceId !== null,
    deviceModel: SOVEREIGN_DEVICE.deviceModel,
    owner: SOVEREIGN_DEVICE.owner,
    accessLocked,
  };
}

export function getAppleConnectBinding(): {
  bound: boolean;
  permanent: boolean;
  operations: typeof APPLE_CONNECT_BINDING.operations;
} {
  return {
    bound: APPLE_CONNECT_BINDING.bound,
    permanent: APPLE_CONNECT_BINDING.permanent,
    operations: { ...APPLE_CONNECT_BINDING.operations },
  };
}

export function isDeviceBound(deviceId: string): boolean {
  return validateDeviceBinding(deviceId);
}

// Server-side execution (for Codemagic builds)
export function authorizeServerBuild(buildToken: string): { authorized: boolean; reason?: string } {
  // Server builds are authorized if triggered by sovereign device
  // The build token is generated when sovereign triggers a build
  const expectedToken = crypto
    .createHash('sha256')
    .update(`${sovereignDeviceId}:${SOVEREIGN_DEVICE.deviceHash}:BUILD_AUTH`)
    .digest('hex');
  
  if (buildToken === expectedToken) {
    console.log(`[APPLE ACCESS] Server build AUTHORIZED`);
    return { authorized: true };
  }
  
  console.log(`[APPLE ACCESS] Server build DENIED - invalid token`);
  return { authorized: false, reason: 'Invalid build authorization token' };
}

export function generateBuildToken(deviceId: string): string | null {
  if (deviceId !== sovereignDeviceId) {
    return null;
  }
  
  return crypto
    .createHash('sha256')
    .update(`${deviceId}:${SOVEREIGN_DEVICE.deviceHash}:BUILD_AUTH`)
    .digest('hex');
}

export const AppleAccessControl = {
  SOVEREIGN_DEVICE,
  OPERATIONS: APPLE_API_OPERATIONS,
  registerSovereign: registerSovereignDevice,
  validate: validateAppleAccess,
  createRequest: createAppleAccessRequest,
  lock: lockAppleAccess,
  unlock: unlockAppleAccess,
  getLogs: getAccessLogs,
  getBlocked: getBlockedDevices,
  isLocked: isAppleAccessLocked,
  getStatus: getSovereignStatus,
  authorizeServerBuild,
  generateBuildToken,
  getBinding: getAppleConnectBinding,
  isDeviceBound,
};

export default AppleAccessControl;
