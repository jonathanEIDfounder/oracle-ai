import crypto from 'crypto';
import { storage } from './storage';

const OWNER_NAME = 'Jonathan Sherman';
const OWNER_EMAIL = 'EID_Founder@outlook.com';
const OWP_VERSION = '1.0.0';

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
}

const violationStore: Map<string, ViolationRecord> = new Map();

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
  verifyIntegrity
};

export default OWP;
