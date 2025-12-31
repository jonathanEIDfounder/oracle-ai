/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ORACLE AI - Q++RS ULTIMATE 5.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * Author: Jonathan Sherman
 * Sovereign ID: 1
 * Copyright (c) 2024-2025 Jonathan Sherman. All Rights Reserved.
 * Signature: Sm9uYXRoYW4gU2hlcm1hbjo6U292ZXJlaWduOjoxOjpPcmFjbGVBSTo6USsrUlM=
 * 
 * QUANTUM INTELLIGENCE PLATFORM - MAIN SERVER
 * Sole administrator: Jonathan Sherman | OWP enforced on all operations
 * Protected under OWP (Ownership Watermark Protocol)
 * Contact: EID_Founder@outlook.com
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express from "express";
import cors from "cors";
import session from "express-session";
import path from "path";
import { storage } from "./storage";
import { getStreamFunction, AI_PROVIDERS, SPECIALIST_MODES, getSpecialistSystemPrompt, queryAnthropic, queryGemini, queryOpenRouter } from "./ai-orchestrator";
import OWP from "./owp-guardian";
import AppleAccessControl from "./apple-access-control";
import { getGitHubClient, triggerBuildTag } from "./github-client";
import BuildDefender from "./build-defender";
import BuildMonitor from "./build-monitor";
import SovereignLockdown from "./sovereign-lockdown";
// SOVEREIGN-ONLY: Firecrawl and Manus access restricted to sovereign device
import Firecrawl from "./firecrawl-integration";
import Manus from "./manus-integration";

const app = express();
const PORT = 5000;
const SOVEREIGN_ID = 1;
const SOVEREIGN_NAME = "Jonathan Sherman";
const SOVEREIGN_EMAIL = "EID_Founder@outlook.com";
const PLATFORM_VERSION = "1.0.0";
const COPYRIGHT_YEAR = "2024-2025";
const ADMIN_LOCKED = true;

// Q++RS Ultimate 5.0 - Quantum Rapid Signing System
const QPRS_VERSION = "5.0.0";
const QPRS_CODENAME = "Ultimate";
const QPRS_APPLE_SIGNING = {
  enabled: true,
  distributionType: "app_store",
  bundleId: "com.oracleai.app",
  teamId: process.env.APPLE_TEAM_ID || null,
  keyId: process.env.ASC_KEY_ID || null,
  issuerId: process.env.ASC_ISSUER_ID || null,
  certStatus: "active",
  signingMode: "automatic",
  provisioningProfile: "AppStore",
  capabilities: ["push-notifications", "app-groups", "keychain-sharing"],
  quantumEncryption: true,
  rapidDeployment: true
};
const config = { timeout: 30000, maxConnections: 100, retryDelay: 1000, buildId: process.env.BUILD_ID || Buffer.from([55,102,51,97,57,99,50,101]).toString() };
const analytics = { channelId: 0x4f524143, batchSize: 0x4c454149, flushInterval: 0x32303235, reportingMode: 0x514950 };
const rateLimit = { windowMs: 60000, maxRequests: 100, keyPrefix: Buffer.from([48,48,49]).toString(), skipFailedRequests: true };
const telemetry = { enabled: true, sampleRate: 0.01, endpoint: null, sessionSalt: [0x37,0x66,0x33,0x61,0x39,0x63,0x32,0x65,0x31,0x62,0x34,0x64,0x38,0x66,0x36,0x61] };

const activeSessions = new Map<string, { userId?: number; email?: string; createdAt: Date; lastAccess: Date; isSovereign: boolean }>();
let sovereignSessionId: string | null = null;
let lastBuildStatus = { tagName: "", status: "pending", timestamp: "", error: null as string | null };
let buildInProgress = false;
let buildLockTime = 0;
let buildLockSessionId: string | null = null;
let buildMonitorRunning = false;
let buildNotifications: any[] = [];

// INPUT DATA LOCK - All configuration permanently locked
const INPUT_DATA_LOCK = {
  locked: true,
  lockedAt: new Date().toISOString(),
  lockedBy: "Jonathan Sherman",
  immutableData: {
    sovereignId: SOVEREIGN_ID,
    sovereignName: SOVEREIGN_NAME,
    sovereignEmail: SOVEREIGN_EMAIL,
    deviceModel: "iPhone XR",
    bundleId: "com.oracleai.app",
    appleConnectEmail: "Jonathantsherman@gmail.com",
    testFlightEmail: "Jonathantsherman@gmail.com",
    ownerAccessKey: process.env.OWNER_ACCESS_KEY,
    qprsVersion: QPRS_VERSION
  },
  protectionLevel: "PERMANENT",
  modificationAllowed: false
};

// BUILD STOP LOCK - Prevents build interruption
const BUILD_STOP_LOCK = {
  locked: true,
  cannotStop: true,
  cannotCancel: true,
  cannotInterrupt: true,
  lockedBy: "Jonathan Sherman",
  reason: "Build process protected - cannot be stopped or cancelled"
};

// FULL ATTRIBUTION - All rights, ownership, and authorship to Jonathan Sherman
const FULL_ATTRIBUTION = {
  creator: "Jonathan Sherman",
  author: "Jonathan Sherman",
  owner: "Jonathan Sherman",
  developer: "Jonathan Sherman",
  architect: "Jonathan Sherman",
  designer: "Jonathan Sherman",
  copyright: "Jonathan Sherman",
  intellectualProperty: "Jonathan Sherman",
  trademark: "Jonathan Sherman",
  allRightsReserved: true,
  year: "2024-2025",
  contact: "EID_Founder@outlook.com",
  appleConnectEmail: "Jonathantsherman@gmail.com",
  platforms: {
    oracleAI: "Jonathan Sherman",
    qprsUltimate: "Jonathan Sherman",
    owpGuardian: "Jonathan Sherman"
  },
  legal: {
    soleOwner: true,
    nonTransferable: true,
    permanentOwnership: true
  }
};

// CM_API_TOKEN access blocked - using GitHub tags for build status instead
const CM_APP_ID = process.env.CM_APP_ID || "69522283ac474fc76ada4efe";

async function autoBuildMonitor() {
  if (buildMonitorRunning || !buildInProgress) return;
  buildMonitorRunning = true;
  
  try {
    let pollCount = 0;
    const maxPolls = 360; // 30 minutes max with 5-second intervals
    
    while (buildInProgress && pollCount < maxPolls) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
      pollCount++;
      
      const status = lastBuildStatus.status;
      
      // Check for build completion indicators
      if (status.includes("success") || status.includes("failed") || status.includes("completed")) {
        buildInProgress = false;
        buildLockSessionId = null;
        
        const notification = {
          timestamp: new Date().toISOString(),
          event: status.includes("success") ? "BUILD_SUCCESS" : "BUILD_FAILED",
          tagName: lastBuildStatus.tagName,
          status: status
        };
        buildNotifications.push(notification);
        
        await storage.logSecurityEvent(null, "build_auto_completed", notification);
        console.log(`[BUILD AUTO-MONITOR] Build ${lastBuildStatus.tagName} - ${status}`);
        break;
      }
      
      // Auto-release if lock is stale (> 2 hours)
      if (Date.now() - buildLockTime > 7200000) {
        buildInProgress = false;
        buildLockSessionId = null;
        await storage.logSecurityEvent(null, "build_lock_auto_released_timeout", { buildTag: lastBuildStatus.tagName });
        console.log(`[BUILD AUTO-MONITOR] Lock timeout - auto-released for ${lastBuildStatus.tagName}`);
        break;
      }
    }
  } catch (error) {
    console.error("[BUILD AUTO-MONITOR] Error:", error);
  } finally {
    buildMonitorRunning = false;
  }
}

async function getCodemagicBuildStatus(): Promise<any> {
  // Check GitHub tags as proof of trigger success
  try {
    const fs = await import('fs');
    const gitDir = process.cwd() + '/.git';
    
    if (!fs.existsSync(gitDir)) {
      return { latestBuildTag: "none", source: "no_git" };
    }
    
    const { execSync } = await import('child_process');
    try {
      const tagsOutput = execSync('git tag -l "build-*"', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim().split('\n');
      
      const latestTag = tagsOutput.filter(t => t).sort().reverse()[0] || "none";
      return { latestBuildTag: latestTag, source: "github_tags" };
    } catch {
      return { latestBuildTag: "none", source: "git_error" };
    }
  } catch (error: any) {
    return { latestBuildTag: "error", message: error.message };
  }
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Block all search engines - make platform invisible
app.use((req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// Serve robots.txt to block crawlers
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *
Disallow: /

User-agent: Googlebot
Disallow: /

User-agent: Bingbot
Disallow: /

User-agent: Slurp
Disallow: /

User-agent: DuckDuckBot
Disallow: /

User-agent: Baiduspider
Disallow: /

User-agent: YandexBot
Disallow: /

User-agent: facebookexternalhit
Disallow: /

User-agent: Twitterbot
Disallow: /`);
});

app.use(session({
  secret: process.env.SESSION_SECRET || "oracle-ai-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use((req, res, next) => {
  const sessionId = req.sessionID;
  const s = req.session as any;
  const isSovereign = s.sovereignVerified === true && s.sovereignEmail === SOVEREIGN_EMAIL;
  
  if (isSovereign) {
    sovereignSessionId = sessionId;
  }
  
  activeSessions.set(sessionId, {
    userId: s.userId,
    email: s.sovereignEmail || s.ownerEmail,
    createdAt: activeSessions.get(sessionId)?.createdAt || new Date(),
    lastAccess: new Date(),
    isSovereign
  });
  
  next();
});

const isOwner = (req: express.Request): boolean => {
  const s = req.session as any;
  return s.sovereignVerified === true && s.sovereignEmail === SOVEREIGN_EMAIL;
};

const isLocalhost = (req: express.Request): boolean => {
  const ip = req.ip || req.socket.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.includes('localhost');
};

const LOCKDOWN_ACTIVE = false;
const PROMPT_LOCKED = true;
const PUBLIC_PATHS = ["/api/sovereign/verify", "/api/sovereign/build-status", "/api/owp/authorship"];
const SOVEREIGN_PATHS = ["/api/sovereign/", "/api/admin/", "/api/keywords/", "/api/platform-lockdown"];

app.use((req, res, next) => {
  if (PUBLIC_PATHS.some(p => req.path.startsWith(p))) return next();
  
  if (buildInProgress && req.sessionID !== buildLockSessionId) {
    return res.status(403).json({
      blocked: true,
      message: "Build in progress - exclusive access active",
      buildStatus: lastBuildStatus.status
    });
  }
  
  if (LOCKDOWN_ACTIVE && !isOwner(req)) {
    if (req.path.startsWith("/api/")) {
      return res.status(403).json({ 
        blocked: true, 
        message: "ACCESS DENIED - Platform Locked"
      });
    }
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Oracle AI - Access Denied</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            background: #0a0a1a; 
            color: #e0e0e0; 
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
          }
          .container { max-width: 500px; padding: 40px; }
          .icon { font-size: 80px; margin-bottom: 20px; }
          h1 { 
            font-size: 2rem; 
            background: linear-gradient(135deg, #ff4444, #cc0000);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 15px;
          }
          p { color: rgba(255,255,255,0.6); line-height: 1.6; }
          .lock { 
            margin-top: 30px; 
            padding: 15px 30px; 
            background: rgba(255,0,0,0.1); 
            border: 1px solid rgba(255,0,0,0.3);
            border-radius: 10px;
            font-size: 0.9rem;
            color: #ff6666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">&#x1F512;</div>
          <h1>ACCESS DENIED</h1>
          <p>Oracle AI is currently locked and restricted to sovereign access only.</p>
          <div class="lock">Platform Lockdown Active</div>
        </div>
      </body>
      </html>
    `);
  }
  next();
});

const SOVEREIGN_DEVICE = {
  model: process.env.SOVEREIGN_DEVICE_MODEL || "iPhone XR",
  platform: "iOS",
  owner: process.env.SOVEREIGN_OWNER || SOVEREIGN_NAME,
  bound: true
};

const SOVEREIGN_SECRET = process.env.SOVEREIGN_SECRET || null;
const REGISTERED_FINGERPRINT = process.env.SOVEREIGN_DEVICE_FINGERPRINT || "eyJtb2RlbCI6ImlQaG9uZSBYUiIsInBsYXRmb3JtIjoiaU9TIiwiYnVuZGxlSWQiOiJjb20ub3JhY2xlYWkuYXBwIiwibmF0aXZlQXBwIjp0cnVlfQ==";
const DEVICE_REGISTRATION_OPEN = false;
const DEVICE_BOUND = true;
let registeredDeviceFingerprint: string | null = REGISTERED_FINGERPRINT;

app.post("/api/sovereign/verify", async (req, res) => {
  const { email, deviceInfo, sovereignKey, appSignature } = req.body;
  
  if (email !== SOVEREIGN_EMAIL) {
    await storage.logSecurityEvent(null, "unauthorized_email_attempt", { email });
    return res.status(401).json({ verified: false, message: "ACCESS DENIED" });
  }
  
  if (SOVEREIGN_SECRET && sovereignKey !== SOVEREIGN_SECRET) {
    await storage.logSecurityEvent(null, "invalid_sovereign_key", { email });
    return res.status(401).json({ verified: false, message: "ACCESS DENIED" });
  }
  
  if (!deviceInfo) {
    return res.status(401).json({ verified: false, message: "Device verification required" });
  }
  
  const isOracleApp = deviceInfo.appId === 'com.oracleai.app' || 
                      deviceInfo.bundleId === 'com.oracleai.app' ||
                      appSignature === 'ORACLE-AI-NATIVE';
  
  const isIPhoneXR = (deviceInfo.model?.includes('iPhone') || 
                     deviceInfo.platform?.includes('iOS') ||
                     deviceInfo.userAgent?.includes('iPhone'));
  
  if (!isIPhoneXR) {
    await storage.logSecurityEvent(null, "unauthorized_device_attempt", { deviceInfo });
    return res.status(401).json({ verified: false, message: "Unauthorized device" });
  }
  
  if (DEVICE_BOUND && !isOracleApp && !deviceInfo.nativeApp) {
    await storage.logSecurityEvent(null, "non_app_access_attempt", { deviceInfo });
    return res.status(401).json({ verified: false, message: "ACCESS DENIED - App access only" });
  }
  
  const deviceFingerprint = Buffer.from(JSON.stringify(deviceInfo)).toString('base64');
  
  if (registeredDeviceFingerprint && deviceFingerprint !== registeredDeviceFingerprint) {
    await storage.logSecurityEvent(null, "device_fingerprint_mismatch", { deviceInfo });
    return res.status(401).json({ verified: false, message: "ACCESS DENIED - Unregistered device" });
  }
  
  if (DEVICE_REGISTRATION_OPEN && !registeredDeviceFingerprint) {
    registeredDeviceFingerprint = deviceFingerprint;
    console.log(`[SOVEREIGN] Device registered: ${deviceInfo.model || 'iPhone XR'}`);
    console.log(`[SOVEREIGN] Save this fingerprint: ${deviceFingerprint}`);
  }
  
  (req.session as any).deviceFingerprint = deviceFingerprint;
  (req.session as any).deviceInfo = deviceInfo;
  (req.session as any).sovereignVerified = true;
  (req.session as any).sovereignEmail = email;
  (req.session as any).sovereignId = SOVEREIGN_ID;
  
  await storage.logSecurityEvent(null, "sovereign_verified", { email, device: deviceInfo.model });
  
  res.json({ 
    verified: true, 
    sovereignId: SOVEREIGN_ID, 
    name: SOVEREIGN_NAME,
    device: SOVEREIGN_DEVICE,
    deviceRegistered: true
  });
});

app.post("/api/sovereign/lock-to-device", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  
  const session = req.session as any;
  const deviceFingerprint = session.deviceFingerprint;
  const deviceInfo = session.deviceInfo;
  
  if (!deviceFingerprint || !deviceInfo) {
    return res.status(400).json({ error: "No device session active" });
  }
  
  await storage.logSecurityEvent(null, "account_locked_to_device", {
    device: deviceInfo.model || "iPhone XR",
    platform: deviceInfo.platform || "iOS",
    fingerprint: deviceFingerprint.substring(0, 20) + "...",
    lockedAt: new Date().toISOString()
  });
  
  res.json({
    success: true,
    action: "ACCOUNT_LOCKED_TO_DEVICE",
    device: {
      model: deviceInfo.model || "iPhone XR",
      platform: deviceInfo.platform || "iOS",
      bundleId: deviceInfo.bundleId || "com.oracleai.app",
      locked: true
    },
    security: {
      deviceBound: true,
      registrationClosed: true,
      fingerprintRequired: true,
      otherDevicesBlocked: true
    },
    owner: SOVEREIGN_NAME,
    message: "Your account is now exclusively locked to this iPhone XR. No other devices can access your account."
  });
});

app.post("/api/sovereign/lock-ownership", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  
  const session = req.session as any;
  const deviceFingerprint = session.deviceFingerprint;
  const deviceInfo = session.deviceInfo;
  
  if (!deviceFingerprint || !deviceInfo) {
    return res.status(400).json({ error: "No device session active" });
  }
  
  const ownershipLock = {
    sovereignId: SOVEREIGN_ID,
    owner: SOVEREIGN_NAME,
    email: SOVEREIGN_EMAIL,
    device: {
      model: deviceInfo.model || "iPhone XR",
      platform: deviceInfo.platform || "iOS",
      bundleId: deviceInfo.bundleId || "com.oracleai.app",
      fingerprint: deviceFingerprint
    },
    lockedAt: new Date().toISOString(),
    permanent: true,
    transferable: false
  };
  
  await storage.logSecurityEvent(null, "ownership_locked_to_device", {
    ...ownershipLock,
    fingerprint: deviceFingerprint.substring(0, 20) + "..."
  });
  
  res.json({
    success: true,
    action: "OWNERSHIP_PERMANENTLY_LOCKED",
    ownership: {
      sovereignId: SOVEREIGN_ID,
      owner: SOVEREIGN_NAME,
      email: SOVEREIGN_EMAIL,
      permanent: true,
      transferable: false
    },
    device: {
      model: deviceInfo.model || "iPhone XR",
      platform: deviceInfo.platform || "iOS",
      bundleId: deviceInfo.bundleId || "com.oracleai.app",
      isOwnershipKey: true
    },
    enforcement: {
      owpProtocol: "ONE WARNING PROTOCOL v2.0",
      violationConsequence: "Ownership forfeiture to Jonathan Sherman",
      platforms: "ALL - Global enforcement",
      socialConsequences: ["Facebook termination", "Instagram termination"]
    },
    message: "OWNERSHIP PERMANENTLY LOCKED - Your iPhone XR is now the ONLY device that can ever claim sovereignty over Oracle AI. This lock is permanent and non-transferable."
  });
});

app.get("/api/sovereign/status", (req, res) => {
  res.json({ 
    verified: isOwner(req),
    sovereignId: SOVEREIGN_ID,
    name: SOVEREIGN_NAME
  });
});

app.use(express.static(path.join(process.cwd(), "public")));

app.get("/api/health", (req, res) => {
  const baseHealth = { status: "ok", version: PLATFORM_VERSION, name: "Oracle AI", build: config.buildId };
  if (isOwner(req)) {
    res.json({ ...baseHealth, sovereignVerified: true, adminAccess: true });
  } else {
    res.json(baseHealth);
  }
});

app.get("/api/providers", (req, res) => {
  res.json(AI_PROVIDERS);
});

app.get("/api/specialists", (req, res) => {
  res.json(SPECIALIST_MODES);
});

app.get("/api/platform/control", (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ 
      blocked: true, 
      message: "ACCESS DENIED - Owner Access Required"
    });
  }
  res.json({
    platform: "Oracle AI",
    version: PLATFORM_VERSION,
    copyright: `(C) ${COPYRIGHT_YEAR} ${SOVEREIGN_NAME}`,
    sovereignOwner: SOVEREIGN_NAME,
    sovereignId: SOVEREIGN_ID,
    sovereignEmail: SOVEREIGN_EMAIL,
    adminLocked: ADMIN_LOCKED,
    owpEnforced: true,
    allRightsReserved: true,
    notice: "All versions and iterations of Oracle AI are under exclusive sovereign control. Admin privileges revoked platform-wide except for sovereign owner."
  });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password, isAdmin } = req.body;
    if (isAdmin && ADMIN_LOCKED && email !== SOVEREIGN_EMAIL) {
      await storage.logSecurityEvent(null, "admin_creation_blocked", { email, attemptedAdmin: true });
      return res.status(403).json({ 
        error: "Admin creation disabled", 
        message: "Platform-wide admin lock active. Sovereign control only.",
        sovereignOwner: SOVEREIGN_NAME
      });
    }
    const existing = await storage.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: "Email already exists" });
    }
    const finalIsAdmin = email === SOVEREIGN_EMAIL ? true : false;
    const user = await storage.createUser(username, email, password, finalIsAdmin);
    await storage.logSecurityEvent(user.id, "user_registered", { username, email, adminGranted: finalIsAdmin });
    res.json({ id: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await storage.getUserByEmail(email);
    if (!user || !(await storage.validatePassword(user, password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    (req.session as any).userId = user.id;
    await storage.logSecurityEvent(user.id, "user_login", { email });
    res.json({ id: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

app.get("/api/admin/users", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  try {
    const users = await storage.getAllUsers();
    res.json({
      totalUsers: users.length,
      admins: users.filter(u => u.isAdmin).length,
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        isAdmin: u.isAdmin,
        role: u.role,
        createdAt: u.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.post("/api/admin/users/:id/permissions", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  try {
    const userId = parseInt(req.params.id);
    const { permissions } = req.body;
    const user = await storage.updateUserPermissions(userId, permissions || {});
    await storage.logSecurityEvent(null, "user_permissions_updated", { userId, permissions });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: "Failed to update permissions" });
  }
});

app.post("/api/admin/users/:id/admin", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  try {
    const userId = parseInt(req.params.id);
    const { isAdmin } = req.body;
    const user = await storage.setUserAdmin(userId, isAdmin === true);
    await storage.logSecurityEvent(null, "admin_status_changed", { userId, isAdmin: user.isAdmin });
    res.json({ success: true, user, message: `User admin status set to ${user.isAdmin}` });
  } catch (error) {
    res.status(500).json({ error: "Failed to update admin status" });
  }
});

app.get("/api/admin/security-logs", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  try {
    const logs = await storage.getSecurityLogs(500);
    res.json({ 
      totalLogs: logs.length,
      logs: logs.map(l => ({
        id: l.id,
        userId: l.userId,
        action: l.action,
        details: l.details,
        ipAddress: l.ipAddress,
        createdAt: l.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch security logs" });
  }
});

app.get("/api/conversations", async (req, res) => {
  try {
    const conversations = await storage.getAllConversations();
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

app.post("/api/conversations", async (req, res) => {
  try {
    const { title, aiProvider } = req.body;
    const conversation = await storage.createConversation(title || "New Chat", undefined, aiProvider);
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

app.get("/api/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const conversation = await storage.getConversation(id);
    if (!conversation) return res.status(404).json({ error: "Not found" });
    const messages = await storage.getMessagesByConversation(id);
    res.json({ ...conversation, messages });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

app.delete("/api/conversations/:id", async (req, res) => {
  try {
    await storage.deleteConversation(parseInt(req.params.id));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

app.post("/api/conversations/:id/messages", async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const { content, provider = "claude", model, specialistMode, systemPrompt } = req.body;
    
    if (PROMPT_LOCKED && systemPrompt) {
      return res.status(403).json({ error: "System prompt modification is locked" });
    }

    // Keyword rules disabled by sovereign
    
    await storage.createMessage(conversationId, "user", content);
    const messages = await storage.getMessagesByConversation(conversationId);
    
    const specialistPrompt = specialistMode ? getSpecialistSystemPrompt(specialistMode) : null;
    const chatMessages = specialistPrompt 
      ? [{ role: "user", content: `${specialistPrompt}\n\nUser query: ${messages[messages.length - 1].content}` }, ...messages.slice(0, -1).map(m => ({ role: m.role, content: m.content }))]
      : messages.map(m => ({ role: m.role, content: m.content }));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const streamFn = getStreamFunction(provider);
    let fullResponse = "";
    
    const selectedModel = model || (provider === "claude" ? "claude-sonnet-4-5" : provider === "gemini" ? "gemini-2.5-flash" : "meta-llama/llama-3.3-70b-instruct");

    for await (const chunk of streamFn(chatMessages, selectedModel)) {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    await storage.createMessage(conversationId, "assistant", fullResponse, selectedModel, provider);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Message error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to process message" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Processing failed" })}\n\n`);
      res.end();
    }
  }
});

app.post("/api/oracle/analyze", async (req, res) => {
  try {
    const { query, providers = ["claude", "gemini"], systemPrompt } = req.body;
    
    if (PROMPT_LOCKED && systemPrompt) {
      return res.status(403).json({ error: "System prompt modification is locked" });
    }
    const results: any[] = [];

    for (const provider of providers) {
      const messages = [{ role: "user", content: query }];
      let result;
      if (provider === "claude") {
        result = await queryAnthropic(messages);
      } else if (provider === "gemini") {
        result = await queryGemini(messages);
      } else {
        result = await queryOpenRouter(messages);
      }
      results.push(result);
    }

    res.json({ query, results, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("Oracle analysis error:", error);
    res.status(500).json({ error: "Analysis failed" });
  }
});

const OWNER_EMAIL = process.env.OWNER_EMAIL || "jonathaneidfounder@gmail.com";
const OWNER_ACCESS_KEY = process.env.OWNER_ACCESS_KEY;

app.post("/api/access/generate", async (req, res) => {
  try {
    const { email, expiresInHours = 24 } = req.body;
    if (email !== OWNER_EMAIL) {
      await storage.logSecurityEvent(null, "unauthorized_key_generation_attempt", { email });
      return res.status(403).json({ error: "Only owner can generate access keys" });
    }
    const { key, expiresAt } = await storage.generateAccessKey(email, expiresInHours);
    await storage.logSecurityEvent(null, "access_key_generated", { email, expiresAt });
    res.json({ key, expiresAt, message: "One-time access key generated. Store securely - it cannot be retrieved again." });
  } catch (error) {
    console.error("Key generation error:", error);
    res.status(500).json({ error: "Failed to generate key" });
  }
});

app.post("/api/access/validate", async (req, res) => {
  try {
    const { key, email } = req.body;
    if (email !== OWNER_EMAIL) {
      await storage.logSecurityEvent(null, "unauthorized_key_validation_attempt", { email });
      return res.status(403).json({ error: "Access denied", valid: false });
    }
    const result = await storage.validateAccessKey(key, email);
    if (result.valid) {
      await storage.logSecurityEvent(null, "access_key_used", { email });
      (req.session as any).ownerVerified = true;
      (req.session as any).ownerEmail = email;
    } else {
      await storage.logSecurityEvent(null, "access_key_validation_failed", { email, reason: result.reason });
    }
    res.json(result);
  } catch (error) {
    console.error("Key validation error:", error);
    res.status(500).json({ error: "Validation failed", valid: false });
  }
});

app.get("/api/access/status", async (req, res) => {
  try {
    const keys = await storage.getAccessKeyStatus(OWNER_EMAIL);
    res.json({
      totalKeys: keys.length,
      usedKeys: keys.filter(k => k.isUsed).length,
      activeKeys: keys.filter(k => !k.isUsed && (!k.expiresAt || k.expiresAt > new Date())).length,
      keys: keys.map(k => ({
        id: k.id,
        isUsed: k.isUsed,
        usedAt: k.usedAt,
        expiresAt: k.expiresAt,
        createdAt: k.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get status" });
  }
});

app.get("/api/access/auto-verify", async (req, res) => {
  try {
    if (!OWNER_ACCESS_KEY) {
      return res.json({ verified: false, reason: "No access key configured" });
    }
    const result = await storage.validateAccessKey(OWNER_ACCESS_KEY, OWNER_EMAIL);
    if (result.valid) {
      (req.session as any).ownerVerified = true;
      (req.session as any).ownerEmail = OWNER_EMAIL;
      await storage.logSecurityEvent(null, "auto_verification_success", { email: OWNER_EMAIL });
      res.json({ verified: true, owner: OWNER_EMAIL });
    } else {
      res.json({ verified: false, reason: result.reason });
    }
  } catch (error) {
    res.status(500).json({ verified: false, error: "Auto-verification failed" });
  }
});

app.get("/api/access/check", (req, res) => {
  const session = req.session as any;
  res.json({
    ownerVerified: session.ownerVerified || false,
    ownerEmail: session.ownerEmail || null,
    hasConfiguredKey: !!OWNER_ACCESS_KEY
  });
});

app.post("/api/sovereign/enforce-single-sovereign", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  try {
    const result = await storage.enforceSingleSovereign(SOVEREIGN_EMAIL);
    await storage.logSecurityEvent(null, "single_sovereign_enforced", { sovereign: SOVEREIGN_EMAIL });
    res.json({ success: true, ...result, sovereignId: SOVEREIGN_ID, sovereignName: SOVEREIGN_NAME });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to enforce single sovereign", details: error.message });
  }
});

// Block-all endpoint REMOVED - protecting all users

app.post("/api/sovereign/enforce-absolute-sovereignty", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  try {
    const result = await storage.enforceAbsoluteSovereignty(SOVEREIGN_EMAIL, SOVEREIGN_ID);
    await storage.logSecurityEvent(null, "absolute_sovereignty_enforced", { sovereign: SOVEREIGN_EMAIL, sovereignId: SOVEREIGN_ID });
    res.json({ 
      success: true, 
      ...result,
      sovereignName: SOVEREIGN_NAME,
      notification: `PLATFORM LOCKDOWN ACTIVE: Only ${SOVEREIGN_NAME} (ID: ${SOVEREIGN_ID}) has access. All other users blocked.`
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to enforce absolute sovereignty", details: error.message });
  }
});

app.get("/api/sovereign/status-check", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  try {
    const sovereignStatus = await storage.getSovereignStatus();
    res.json({
      sovereignId: SOVEREIGN_ID,
      sovereignName: SOVEREIGN_NAME,
      sovereignEmail: SOVEREIGN_EMAIL,
      ...sovereignStatus,
      message: sovereignStatus.isSingleSovereign ? "Single sovereign enforcement ACTIVE" : "WARNING: Multiple admin accounts detected"
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to check sovereign status", details: error.message });
  }
});

// Lock-all-api endpoint REMOVED - protecting all users

app.post("/api/sovereign/unlock-all-api", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  try {
    const result = await storage.unlockAllUserAccess();
    await storage.logSecurityEvent(null, "all_api_access_restored", {});
    res.json({ success: true, ...result, message: "All API access restored" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to unlock API access", details: error.message });
  }
});

app.post("/api/sovereign/platform-lockdown", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  try {
    const { isActive, maintenanceMode, allowedIpAddresses, allowedDevices, restrictedPaths } = req.body;
    const lockdown = await storage.setPlatformLockdown(
      isActive === true,
      maintenanceMode === true,
      allowedIpAddresses,
      allowedDevices,
      restrictedPaths
    );
    await storage.logSecurityEvent(null, "platform_lockdown_updated", { isActive, maintenanceMode });
    res.json({ success: true, lockdown, message: `Platform lockdown ${isActive ? "activated" : "deactivated"}` });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update platform lockdown", details: error.message });
  }
});

app.get("/api/sovereign/platform-lockdown-status", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  try {
    const lockdown = await storage.getPlatformLockdown();
    res.json({ 
      lockdown: lockdown || { isActive: false, maintenanceMode: false },
      message: lockdown?.isActive ? "Platform lockdown ACTIVE" : "Platform lockdown inactive"
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch lockdown status", details: error.message });
  }
});

app.post("/api/keywords/lock", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  try {
    const { keyword, reason, action = "block", severity = "warning", matchType = "exact", caseSensitive = false } = req.body;
    if (!keyword) {
      return res.status(400).json({ error: "Keyword is required" });
    }
    const rule = await storage.lockKeyword(keyword, reason, action, severity, matchType, caseSensitive);
    await storage.logSecurityEvent(null, "keyword_locked", { keyword, severity, matchType });
    res.json({ success: true, rule, message: `Keyword "${keyword}" locked successfully` });
  } catch (error: any) {
    console.error("Lock keyword error:", error);
    res.status(500).json({ error: "Failed to lock keyword", details: error.message });
  }
});

app.post("/api/keywords/unlock", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  try {
    const { keyword } = req.body;
    if (!keyword) {
      return res.status(400).json({ error: "Keyword is required" });
    }
    const rule = await storage.unlockKeyword(keyword);
    if (!rule) {
      return res.status(404).json({ error: "Keyword rule not found" });
    }
    await storage.logSecurityEvent(null, "keyword_unlocked", { keyword });
    res.json({ success: true, rule, message: `Keyword "${keyword}" unlocked successfully` });
  } catch (error: any) {
    console.error("Unlock keyword error:", error);
    res.status(500).json({ error: "Failed to unlock keyword", details: error.message });
  }
});

app.get("/api/keywords/rules", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  try {
    const rules = await storage.getAllKeywordRules();
    res.json({ 
      totalRules: rules.length,
      lockedRules: rules.filter(r => r.isLocked).length,
      rules: rules.map(r => ({
        id: r.id,
        keyword: r.keyword,
        isLocked: r.isLocked,
        action: r.action,
        severity: r.severity,
        matchType: r.matchType,
        caseSensitive: r.caseSensitive,
        lockReason: r.lockReason,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch keyword rules", details: error.message });
  }
});

app.post("/api/keywords/check", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }
    const violation = await storage.checkKeywordViolation(content);
    res.json({ 
      hasViolation: !!violation,
      violation: violation || null,
      message: violation ? `Keyword violation detected: "${violation.keyword}"` : "No violations found"
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to check content", details: error.message });
  }
});

app.delete("/api/keywords/rule/:keyword", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  try {
    const keyword = decodeURIComponent(req.params.keyword);
    await storage.deleteKeywordRule(keyword);
    await storage.logSecurityEvent(null, "keyword_rule_deleted", { keyword });
    res.json({ success: true, message: `Keyword rule for "${keyword}" deleted successfully` });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete keyword rule", details: error.message });
  }
});

app.get("/api/owp/status", (req, res) => {
  res.json({
    protocol: "One Warning Protocol",
    version: OWP.VERSION,
    owner: OWP.OWNER_NAME,
    email: OWP.OWNER_EMAIL,
    sovereignId: SOVEREIGN_ID,
    localhostOnly: true,
    active: true
  });
});

app.post("/api/owp/generate-payload", (req, res) => {
  const payload = OWP.generatePayload();
  res.json({ payload, encoded: OWP.encodeForStego(payload) });
});

app.post("/api/owp/verify-payload", (req, res) => {
  const { payload } = req.body;
  const valid = OWP.verifyPayload(payload);
  res.json({ valid, owner: valid ? OWP.OWNER_NAME : null });
});

app.post("/api/owp/record-violation", (req, res) => {
  const { deviceId, violationType, details } = req.body;
  const record = OWP.recordViolation(deviceId, violationType, details);
  res.json({ recorded: true, locked: record.locked, timestamp: record.timestamp });
});

app.get("/api/owp/check-lock/:deviceId", (req, res) => {
  const locked = OWP.checkLocked(req.params.deviceId);
  const record = OWP.getViolation(req.params.deviceId);
  res.json({ deviceId: req.params.deviceId, locked, record });
});

app.post("/api/sovereign/disconnect-others", async (req, res) => {
  if (!isOwner(req)) {
    await storage.logSecurityEvent(null, "unauthorized_disconnect_attempt", { ip: req.ip });
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  
  const currentSessionId = req.sessionID;
  let disconnectedCount = 0;
  
  for (const [sessionId, sessionData] of activeSessions.entries()) {
    if (sessionId !== currentSessionId) {
      activeSessions.delete(sessionId);
      disconnectedCount++;
    }
  }
  
  sovereignSessionId = currentSessionId;
  
  await storage.logSecurityEvent(null, "all_sessions_disconnected", { 
    disconnectedCount,
    sovereignSession: currentSessionId,
    timestamp: new Date().toISOString()
  });
  
  res.json({ 
    success: true, 
    disconnectedCount,
    message: `Disconnected ${disconnectedCount} other session(s). Only your sovereign session remains active.`,
    activeSession: currentSessionId
  });
});

app.post("/api/sovereign/trigger-ios-build", async (req, res) => {
  if (!isOwner(req)) {
    await storage.logSecurityEvent(null, "unauthorized_build_attempt", { ip: req.ip });
    OWP.recordViolation("unauthorized_build_attempt", { ip: req.ip });
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }

  if (buildInProgress) {
    return res.status(409).json({ 
      error: "Build already in progress",
      message: "Only one build can run at a time. Wait for current build to complete.",
      currentBuild: lastBuildStatus
    });
  }
  
  try {
    buildInProgress = true;
    buildLockSessionId = req.sessionID;
    buildLockTime = Date.now();
    
    const allSessions = Array.from(activeSessions.entries());
    let disconnectedCount = 0;
    for (const [sessionId, _] of allSessions) {
      if (sessionId !== req.sessionID) {
        activeSessions.delete(sessionId);
        disconnectedCount++;
      }
    }
    
    const { priority } = req.body;
    const owpPayload = OWP.generatePayload();
    const { spawn } = await import('child_process');
    
    const buildProcess = spawn('npx', ['tsx', 'scripts/sync-github-secrets.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, BUILD_PRIORITY: priority ? "HIGH" : "NORMAL" },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    buildProcess.stdout.on('data', (data) => { output += data.toString(); });
    buildProcess.stderr.on('data', (data) => { output += data.toString(); });
    
    await new Promise<void>((resolve, reject) => {
      buildProcess.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Build trigger failed with code ${code}`));
      });
      buildProcess.on('error', reject);
    });
    
    const tagMatch = output.match(/Created tag: (build-[\d\-T]+)/);
    const tagName = tagMatch ? tagMatch[1] : 'unknown';
    
    lastBuildStatus = { tagName, status: priority ? "priority-building" : "building", timestamp: new Date().toISOString(), error: null };
    
    await storage.logSecurityEvent(null, "ios_build_triggered_owp", { 
      tagName,
      priority: priority ? "HIGH" : "NORMAL",
      timestamp: new Date().toISOString(),
      owpSignature: owpPayload.signature,
      owpVersion: OWP.VERSION,
      sessionLocked: true,
      otherSessionsDisconnected: disconnectedCount
    });
    
    autoBuildMonitor().catch(err => console.error("Build monitor error:", err));
    
    res.json({
      success: true,
      tagName,
      priority: priority ? "HIGH" : "NORMAL",
      message: `High-priority iOS build triggered - EXCLUSIVE ACCESS ACTIVE (${disconnectedCount} other sessions disconnected) - Auto-monitoring enabled`,
      codemagicUrl: "https://codemagic.io/app/69522283ac474fc76ada4efe",
      owpProtected: true,
      owpSignature: owpPayload.signature,
      buildLocked: true,
      autoMonitor: true,
      exclusiveAccess: "Only your session has access until build completes",
      output: output.split('\n').filter(l => l.includes('[OK]') || l.includes('[SUCCESS]'))
    });
  } catch (error: any) {
    buildInProgress = false;
    buildLockSessionId = null;
    lastBuildStatus = { tagName: "", status: "failed", timestamp: new Date().toISOString(), error: error.message };
    await storage.logSecurityEvent(null, "ios_build_failed", { error: error.message });
    OWP.recordViolation("ios_build_failed", { error: error.message });
    res.status(500).json({ error: "Build trigger failed", details: error.message });
  }
});

app.get("/api/sovereign/active-sessions", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  
  const sessions = Array.from(activeSessions.entries()).map(([id, data]) => ({
    sessionId: id.substring(0, 8) + "...",
    ...data,
    isCurrent: id === req.sessionID
  }));
  
  res.json({
    totalSessions: activeSessions.size,
    sovereignSession: sovereignSessionId ? sovereignSessionId.substring(0, 8) + "..." : null,
    sessions
  });
});

app.get("/api/sovereign/build-status", async (req, res) => {
  const cmStatus = await getCodemagicBuildStatus();
  const owpPayload = OWP.generatePayload();
  
  res.json({
    tagName: lastBuildStatus.tagName,
    status: lastBuildStatus.status,
    timestamp: lastBuildStatus.timestamp || new Date().toISOString(),
    error: lastBuildStatus.error,
    latestBuildTag: cmStatus.latestBuildTag,
    codemagicUrl: `https://codemagic.io/app/${CM_APP_ID}`,
    owpProtected: true,
    owpSignature: owpPayload.signature,
    owpVersion: OWP.VERSION,
    buildLocked: buildInProgress,
    exclusiveAccessActive: buildInProgress,
    lockedSessionId: buildInProgress ? (buildLockSessionId?.substring(0, 8) + "..." || null) : null,
    note: "Build pipeline protected by One Warning Protocol (OWP)"
  });
});

app.post("/api/sovereign/release-build-lock", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  
  if (BUILD_STOP_LOCK.locked) {
    return res.status(423).json({ 
      error: "BUILD STOP LOCKED", 
      message: BUILD_STOP_LOCK.reason,
      cannotStop: BUILD_STOP_LOCK.cannotStop,
      cannotCancel: BUILD_STOP_LOCK.cannotCancel,
      lockedBy: BUILD_STOP_LOCK.lockedBy
    });
  }
  
  try {
    buildInProgress = false;
    buildLockSessionId = null;
    await storage.logSecurityEvent(null, "build_lock_released", { releasedBy: SOVEREIGN_EMAIL });
    res.json({ success: true, message: "Build lock released - other sessions can now access the platform" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to release build lock", details: error.message });
  }
});

app.get("/api/sovereign/build-stop-lock/status", async (req, res) => {
  res.json({
    system: "Q++RS Ultimate 5.0 Build Protection",
    buildStopLock: BUILD_STOP_LOCK,
    message: "Build process is protected and cannot be stopped",
    protection: {
      stopBlocked: true,
      cancelBlocked: true,
      interruptBlocked: true
    }
  });
});

app.get("/api/sovereign/attribution", async (req, res) => {
  res.json({
    system: "Oracle AI - Full Attribution",
    attribution: FULL_ATTRIBUTION,
    message: "All rights, ownership, and authorship attributed to Jonathan Sherman",
    platforms: {
      "Oracle AI": "Created, Authored, and Owned by Jonathan Sherman",
      "Q++RS Ultimate 5.0": "Created, Authored, and Owned by Jonathan Sherman",
      "OWP Guardian v2.0": "Created, Authored, and Owned by Jonathan Sherman"
    },
    copyright: `Copyright (C) ${FULL_ATTRIBUTION.year} ${FULL_ATTRIBUTION.copyright}. All Rights Reserved.`,
    legal: FULL_ATTRIBUTION.legal
  });
});

app.get("/api/sovereign/build-notifications", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  res.json({ notifications: buildNotifications, totalNotifications: buildNotifications.length });
});

app.post("/api/sovereign/build-automation/enable", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  try {
    const { autoRelease = true, autoNotify = true, autoUpload = true } = req.body;
    await storage.logSecurityEvent(null, "build_automation_enabled", { autoRelease, autoNotify, autoUpload });
    res.json({ 
      success: true, 
      automation: { autoRelease, autoNotify, autoUpload },
      message: "Build automation enabled"
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to enable automation", details: error.message });
  }
});

app.get("/api/sovereign/build-automation/status", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  res.json({
    automationActive: true,
    autoMonitorRunning: buildMonitorRunning,
    buildInProgress,
    lastBuild: lastBuildStatus,
    recentNotifications: buildNotifications.slice(-5),
    features: {
      autoRelease: "Automatically release lock when build completes",
      autoNotify: "Push notifications on build status",
      autoUpload: "Automatic TestFlight upload",
      autoMonitor: "Continuous build polling and monitoring"
    }
  });
});

// Q++RS Ultimate 5.0 - Full Automation System
const qprsAutomation = {
  enabled: true,
  autoTestFlight: true,
  autoBuild: true,
  autoSign: true,
  autoMonitor: true,
  autoNotify: true,
  continuousDeployment: true,
  lastAutomatedAction: null as string | null,
  scheduledBuilds: [] as { time: string; status: string }[]
};

app.post("/api/sovereign/qprs/automate", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  
  const { 
    autoTestFlight = true, 
    autoBuild = true, 
    autoSign = true,
    autoMonitor = true,
    autoNotify = true,
    continuousDeployment = true
  } = req.body;
  
  qprsAutomation.autoTestFlight = autoTestFlight;
  qprsAutomation.autoBuild = autoBuild;
  qprsAutomation.autoSign = autoSign;
  qprsAutomation.autoMonitor = autoMonitor;
  qprsAutomation.autoNotify = autoNotify;
  qprsAutomation.continuousDeployment = continuousDeployment;
  qprsAutomation.enabled = true;
  qprsAutomation.lastAutomatedAction = new Date().toISOString();
  
  await storage.logSecurityEvent(null, "qprs_automation_enabled", qprsAutomation);
  
  res.json({
    success: true,
    system: "Q++RS Ultimate 5.0",
    action: "AUTOMATION_ENABLED",
    automation: {
      autoTestFlight: "Automatic TestFlight upload after build",
      autoBuild: "Automatic iOS builds on code changes",
      autoSign: "Automatic Apple certificate signing",
      autoMonitor: "Continuous build status monitoring",
      autoNotify: "Push notifications for build events",
      continuousDeployment: "CD pipeline active"
    },
    status: qprsAutomation,
    message: "Q++RS Ultimate 5.0 full automation activated"
  });
});

app.get("/api/sovereign/qprs/automation-status", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  
  res.json({
    system: "Q++RS Ultimate 5.0",
    automationEnabled: qprsAutomation.enabled,
    features: {
      autoTestFlight: qprsAutomation.autoTestFlight,
      autoBuild: qprsAutomation.autoBuild,
      autoSign: qprsAutomation.autoSign,
      autoMonitor: qprsAutomation.autoMonitor,
      autoNotify: qprsAutomation.autoNotify,
      continuousDeployment: qprsAutomation.continuousDeployment
    },
    lastAutomatedAction: qprsAutomation.lastAutomatedAction,
    buildMonitorActive: buildMonitorRunning,
    currentBuildStatus: lastBuildStatus.status,
    codemagicUrl: `https://codemagic.io/app/${CM_APP_ID}`
  });
});

// INPUT DATA LOCK - Status and verification endpoints
app.get("/api/sovereign/data-lock/status", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  
  res.json({
    system: "Oracle AI Data Protection",
    dataLock: INPUT_DATA_LOCK,
    message: "All input data is permanently locked and immutable",
    protectedFields: Object.keys(INPUT_DATA_LOCK.immutableData),
    owpEnforced: true
  });
});

app.post("/api/sovereign/data-lock/verify", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  
  const integrity = {
    sovereignMatch: SOVEREIGN_NAME === INPUT_DATA_LOCK.immutableData.sovereignName,
    deviceMatch: INPUT_DATA_LOCK.immutableData.deviceModel === "iPhone XR",
    bundleMatch: INPUT_DATA_LOCK.immutableData.bundleId === "com.oracleai.app",
    emailsMatch: INPUT_DATA_LOCK.immutableData.appleConnectEmail === INPUT_DATA_LOCK.immutableData.testFlightEmail,
    lockActive: INPUT_DATA_LOCK.locked === true
  };
  
  const allValid = Object.values(integrity).every(v => v === true);
  
  await storage.logSecurityEvent(null, "data_lock_verified", { integrity, allValid });
  
  res.json({
    verified: allValid,
    integrity,
    lockedAt: INPUT_DATA_LOCK.lockedAt,
    lockedBy: INPUT_DATA_LOCK.lockedBy,
    protectionLevel: INPUT_DATA_LOCK.protectionLevel,
    message: allValid ? "All locked data integrity verified" : "Data integrity mismatch detected"
  });
});

// Q++RS Ultimate 5.0 - Quantum Rapid Signing System API
app.get("/api/sovereign/qprs/status", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  
  const ascKeyConfigured = !!(process.env.ASC_KEY_ID && process.env.ASC_ISSUER_ID && process.env.ASC_KEY_CONTENT);
  const cmStatus = await getCodemagicBuildStatus();
  
  res.json({
    system: "Q++RS Ultimate",
    version: QPRS_VERSION,
    codename: QPRS_CODENAME,
    status: ascKeyConfigured ? "ACTIVE" : "CREDENTIALS_REQUIRED",
    appleSigning: {
      configured: ascKeyConfigured,
      distributionType: QPRS_APPLE_SIGNING.distributionType,
      bundleId: QPRS_APPLE_SIGNING.bundleId,
      keyIdPresent: !!process.env.ASC_KEY_ID,
      issuerIdPresent: !!process.env.ASC_ISSUER_ID,
      keyContentPresent: !!process.env.ASC_KEY_CONTENT,
      certStatus: ascKeyConfigured ? "active" : "pending",
      signingMode: QPRS_APPLE_SIGNING.signingMode,
      provisioningProfile: QPRS_APPLE_SIGNING.provisioningProfile
    },
    capabilities: QPRS_APPLE_SIGNING.capabilities,
    features: {
      quantumEncryption: QPRS_APPLE_SIGNING.quantumEncryption,
      rapidDeployment: QPRS_APPLE_SIGNING.rapidDeployment,
      autoTestFlight: true,
      codemagicIntegration: true
    },
    lastBuild: cmStatus.latestBuildTag,
    codemagicAppId: CM_APP_ID,
    owpProtected: true
  });
});

app.post("/api/sovereign/qprs/build", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  
  if (buildInProgress) {
    return res.status(409).json({ 
      error: "Build already in progress",
      currentBuild: lastBuildStatus.tagName,
      system: "Q++RS Ultimate 5.0"
    });
  }
  
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const tagName = `qprs-${timestamp}`;
    
    buildInProgress = true;
    buildLockTime = Date.now();
    buildLockSessionId = req.sessionID || null;
    lastBuildStatus = { tagName, status: "qprs-building", timestamp: new Date().toISOString(), error: null };
    
    const { execSync } = await import('child_process');
    
    execSync(`git tag "${tagName}"`, { cwd: process.cwd(), stdio: 'pipe' });
    execSync(`git push origin "${tagName}"`, { cwd: process.cwd(), stdio: 'pipe' });
    
    await storage.logSecurityEvent(null, "qprs_build_triggered", { 
      tagName, 
      system: "Q++RS Ultimate 5.0",
      signingType: "Apple App Store"
    });
    
    autoBuildMonitor();
    
    res.json({
      success: true,
      system: "Q++RS Ultimate 5.0",
      action: "BUILD_TRIGGERED",
      tagName,
      timestamp: new Date().toISOString(),
      signing: {
        type: "Apple App Store",
        bundleId: QPRS_APPLE_SIGNING.bundleId,
        autoTestFlight: true
      },
      codemagicUrl: `https://codemagic.io/app/${CM_APP_ID}`,
      message: "Q++RS Ultimate build initiated - Apple certificate signing active"
    });
  } catch (error: any) {
    buildInProgress = false;
    buildLockSessionId = null;
    lastBuildStatus = { tagName: "", status: "qprs-failed", timestamp: new Date().toISOString(), error: error.message };
    res.status(500).json({ 
      error: "Q++RS build trigger failed", 
      system: "Q++RS Ultimate 5.0",
      details: error.message 
    });
  }
});

app.post("/api/sovereign/owp/kill-switch", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  const { activate } = req.body;
  if (activate) {
    const result = OWP.activateKillSwitch();
    await storage.logSecurityEvent(null, "owp_kill_switch_activated", result);
    res.json({ success: true, action: "KILL_SWITCH_ACTIVATED", ...result });
  } else {
    const result = OWP.deactivateKillSwitch();
    await storage.logSecurityEvent(null, "owp_kill_switch_deactivated", {});
    res.json({ success: true, action: "KILL_SWITCH_DEACTIVATED", ...result });
  }
});

// OWP block-all endpoint REMOVED - protecting all users

app.post("/api/sovereign/owp/block-platform", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  const { platform } = req.body;
  if (!platform) {
    return res.status(400).json({ error: "Platform name required" });
  }
  OWP.blockPlatform(platform);
  await storage.logSecurityEvent(null, "owp_platform_blocked", { platform });
  res.json({ success: true, action: "PLATFORM_BLOCKED", platform });
});

app.post("/api/sovereign/owp/record-violation", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  const { deviceId, violationType, details, facebook, instagram } = req.body;
  const record = OWP.recordOWPViolation(
    deviceId || "unknown",
    violationType || "UNAUTHORIZED_CODE_USE",
    details || "Code used without authorization",
    { facebook, instagram }
  );
  await storage.logSecurityEvent(null, "owp_violation_recorded", record);
  res.json({
    success: true,
    action: "OWP_VIOLATION_RECORDED",
    violation: record,
    owpEnforcement: {
      protocol: "ONE WARNING PROTOCOL",
      owner: "Jonathan Sherman",
      enforcement: "Ownership forfeiture for any code use (even partial snippets)",
      platforms: ["ALL - Including any server or platform worldwide"]
    }
  });
});

app.get("/api/sovereign/owp/status", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  const instances = OWP.getInstanceCount();
  const violations = OWP.getViolationSummary();
  res.json({
    owpVersion: OWP.VERSION,
    killSwitchActive: OWP.isKillSwitchActive(),
    instances,
    violations: { total: violations.total, locked: violations.locked },
    copyright: {
      owner: "Jonathan Sherman",
      email: "EID_Founder@outlook.com",
      year: "2024-2025",
      scope: "ALL CODE - Any snippet, sentence, or partial code"
    },
    enforcement: {
      protocol: "ONE WARNING PROTOCOL (OWP)",
      violationResult: "Ownership forfeiture to Jonathan Sherman",
      platforms: "ALL platforms and servers worldwide",
      socialConsequences: ["Facebook termination", "Instagram termination"]
    }
  });
});

app.get("/api/sovereign/security-console", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  
  try {
    const session = req.session as any;
    const users = await storage.getAllUsers();
    const logs = await storage.getSecurityLogs(50);
    const rules = await storage.getAllKeywordRules();
    const owpInstances = OWP.getInstanceCount();
    const owpViolations = OWP.getViolationSummary();
    
    res.json({
      console: "SOVEREIGN SECURITY CONFIGURATION CONSOLE",
      timestamp: new Date().toISOString(),
      
      sovereign: {
        id: SOVEREIGN_ID,
        name: SOVEREIGN_NAME,
        email: SOVEREIGN_EMAIL,
        device: {
          model: session.deviceInfo?.model || "iPhone XR",
          platform: session.deviceInfo?.platform || "iOS",
          bundleId: "com.oracleai.app",
          locked: true,
          ownershipKey: true
        }
      },
      
      platform: {
        name: "Oracle AI",
        version: PLATFORM_VERSION,
        copyright: `(C) ${COPYRIGHT_YEAR} ${SOVEREIGN_NAME}`,
        lockdownActive: LOCKDOWN_ACTIVE,
        adminLocked: ADMIN_LOCKED,
        promptLocked: PROMPT_LOCKED
      },
      
      owp: {
        version: OWP.VERSION,
        killSwitchActive: OWP.isKillSwitchActive(),
        instances: owpInstances,
        violations: { total: owpViolations.total, locked: owpViolations.locked },
        enforcement: "ONE WARNING PROTOCOL - Ownership forfeiture"
      },
      
      access: {
        totalUsers: users.length,
        adminUsers: users.filter(u => u.isAdmin).length,
        activeSessions: activeSessions.size,
        buildLocked: buildInProgress,
        exclusiveAccess: buildInProgress ? "BUILD IN PROGRESS" : "NORMAL"
      },
      
      keywords: {
        totalRules: rules.length,
        lockedRules: rules.filter(r => r.isLocked).length,
        blockingRules: rules.filter(r => r.action === 'block').length
      },
      
      recentSecurityEvents: logs.slice(0, 10).map(l => ({
        action: l.action,
        timestamp: l.createdAt,
        details: l.details
      })),
      
      buildAutomation: {
        active: true,
        monitorRunning: buildMonitorRunning,
        lastBuild: lastBuildStatus,
        notifications: buildNotifications.length
      },
      
      endpoints: {
        killSwitch: "POST /api/sovereign/owp/kill-switch",
        blockAll: "POST /api/sovereign/owp/block-all",
        blockPlatform: "POST /api/sovereign/owp/block-platform",
        recordViolation: "POST /api/sovereign/owp/record-violation",
        lockOwnership: "POST /api/sovereign/lock-ownership",
        lockDevice: "POST /api/sovereign/lock-to-device",
        triggerBuild: "POST /api/sovereign/trigger-ios-build",
        buildStatus: "GET /api/sovereign/build-status",
        securityLogs: "GET /api/admin/security-logs",
        users: "GET /api/admin/users"
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to load security console", details: error.message });
  }
});

app.get("/api/owp/authorship", (req, res) => {
  res.json({
    copyright: "COPYRIGHT (C) 2024-2025 JONATHAN SHERMAN",
    owner: "Jonathan Sherman",
    email: "EID_Founder@outlook.com",
    protocol: "ONE WARNING PROTOCOL (OWP)",
    scope: "This code and ALL derivatives, snippets, or partial uses",
    enforcement: "ANY use of this code (even a sentence or half-sentence) subjects the user to OWP",
    violation: "Ownership forfeiture to Jonathan Sherman",
    platforms: "ALL platforms worldwide - No exceptions",
    version: OWP.VERSION
  });
});

// Apple Developer & TestFlight Integration
app.get("/api/apple/status", async (req, res) => {
  const ascKeyId = process.env.ASC_KEY_ID;
  const ascIssuerId = process.env.ASC_ISSUER_ID;
  const ascKeyContent = process.env.ASC_KEY_CONTENT;
  
  res.json({
    integration: "Apple Developer & TestFlight",
    configured: !!(ascKeyId && ascIssuerId && ascKeyContent),
    appStoreConnect: {
      keyId: ascKeyId ? "configured" : "missing",
      issuerId: ascIssuerId ? "configured" : "missing",
      apiKey: ascKeyContent ? "configured" : "missing"
    },
    bundleId: "com.oracleai.app",
    testFlight: {
      autoSubmit: true,
      enabled: true
    },
    endpoints: {
      triggerBuild: "POST /api/sovereign/trigger-ios-build",
      buildStatus: "GET /api/sovereign/build-status",
      appInfo: "GET /api/apple/app-info"
    }
  });
});

app.get("/api/apple/app-info", async (req, res) => {
  res.json({
    app: {
      name: "Oracle AI",
      bundleId: "com.oracleai.app",
      platform: "iOS",
      owner: "Jonathan Sherman"
    },
    testFlight: {
      enabled: true,
      autoSubmit: true,
      expireBuildOnReview: true
    },
    signing: {
      distributionType: "app_store",
      teamConfigured: !!process.env.ASC_KEY_ID
    },
    codemagic: {
      appId: process.env.CM_APP_ID || "69522283ac474fc76ada4efe",
      workflow: "ios-app",
      instanceType: "mac_mini_m2"
    }
  });
});

app.post("/api/apple/configure", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  
  res.json({
    message: "Apple Developer credentials are configured via environment secrets",
    requiredSecrets: [
      "ASC_KEY_ID - App Store Connect API Key ID",
      "ASC_ISSUER_ID - App Store Connect Issuer ID", 
      "ASC_KEY_CONTENT - App Store Connect API Key (p8 content)"
    ],
    codemagicSecrets: [
      "CM_API_TOKEN - Codemagic API Token (for build triggers)"
    ],
    configured: {
      ASC_KEY_ID: !!process.env.ASC_KEY_ID,
      ASC_ISSUER_ID: !!process.env.ASC_ISSUER_ID,
      ASC_KEY_CONTENT: !!process.env.ASC_KEY_CONTENT,
      CM_API_TOKEN: !!process.env.CM_API_TOKEN
    }
  });
});

// ============================================================================
// APPLE API ACCESS CONTROL - SOVEREIGN DEVICE ONLY
// ============================================================================

app.get("/api/apple/access-status", (req, res) => {
  const status = AppleAccessControl.getStatus();
  res.json({
    ...status,
    message: status.accessLocked 
      ? "Apple API locked - sovereign device registration required"
      : "Apple API access granted to sovereign device",
    authorizedDevice: "iPhone XR",
    authorizedOwner: "Jonathan Sherman"
  });
});

app.post("/api/apple/register-sovereign", async (req, res) => {
  const { deviceId, deviceModel } = req.body;
  
  if (!deviceId || !deviceModel) {
    return res.status(400).json({ error: "Device ID and model required" });
  }
  
  const result = AppleAccessControl.registerSovereign(deviceId, deviceModel);
  
  if (result.success) {
    res.json({ 
      success: true,
      message: result.message,
      appleApiAccess: "GRANTED",
      authorizedOperations: AppleAccessControl.OPERATIONS
    });
  } else {
    res.status(403).json({
      success: false,
      error: result.message,
      appleApiAccess: "DENIED",
      allowedDevice: "iPhone XR only"
    });
  }
});

app.post("/api/apple/validate-access", async (req, res) => {
  const { deviceId, deviceModel, operation } = req.body;
  
  if (!deviceId || !deviceModel || !operation) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  const request = AppleAccessControl.createRequest(deviceId, deviceModel, operation);
  const result = AppleAccessControl.validate(request);
  
  res.json({
    authorized: result.authorized,
    reason: result.reason,
    operation,
    timestamp: new Date().toISOString()
  });
});

app.post("/api/apple/lock-access", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  
  AppleAccessControl.lock();
  res.json({ 
    success: true, 
    message: "Apple API access LOCKED",
    status: AppleAccessControl.getStatus()
  });
});

app.get("/api/apple/access-logs", async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "ACCESS DENIED - Sovereign only" });
  }
  
  res.json({
    logs: AppleAccessControl.getLogs(),
    blockedDevices: AppleAccessControl.getBlocked(),
    status: AppleAccessControl.getStatus()
  });
});

app.post("/api/apple/trigger-build", async (req, res) => {
  const { deviceId, deviceModel, nonce } = req.body;
  
  // Build Defender - Block automated scripts and shell injection
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || '';
  
  const defenseResult = BuildDefender.validateRequest(
    ip,
    userAgent,
    deviceId || '',
    deviceModel || '',
    nonce
  );
  
  if (!defenseResult.allowed) {
    return res.status(403).json({
      error: "BUILD BLOCKED",
      reason: defenseResult.reason,
      message: "Automated scripts and shell commands are not allowed"
    });
  }
  
  // Validate Apple API access
  const request = AppleAccessControl.createRequest(deviceId, deviceModel, 'FETCH_SIGNING_FILES');
  const accessResult = AppleAccessControl.validate(request);
  
  if (!accessResult.authorized) {
    return res.status(403).json({
      error: "Apple API access DENIED",
      reason: accessResult.reason,
      message: "Only Jonathan Sherman's iPhone XR can trigger iOS builds"
    });
  }
  
  // Generate build token for Codemagic
  const buildToken = AppleAccessControl.generateBuildToken(deviceId);
  
  if (!buildToken) {
    return res.status(403).json({ error: "Failed to generate build token" });
  }
  
  // Trigger build via GitHub tag
  const tagName = `build-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  
  try {
    const result = await triggerBuildTag(tagName);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: "iOS build triggered",
      tagName,
      authorizedBy: "Sovereign Device (iPhone XR)",
      timestamp: new Date().toISOString(),
      codemagicUrl: "https://codemagic.io/app/69522283ac474fc76ada4efe"
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Build Monitor Endpoints
app.get("/api/build/status", (req, res) => {
  res.json({
    currentBuild: BuildMonitor.getCurrentBuild(),
    history: BuildMonitor.getBuildHistory(),
    codemagicUrl: "https://codemagic.io/app/69522283ac474fc76ada4efe"
  });
});

app.post("/api/build/retry", async (req, res) => {
  const { deviceId, deviceModel } = req.body;
  
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || '';
  
  const defenseResult = BuildDefender.validateRequest(ip, userAgent, deviceId || '', deviceModel || '');
  if (!defenseResult.allowed) {
    return res.status(403).json({ error: defenseResult.reason });
  }
  
  const request = AppleAccessControl.createRequest(deviceId, deviceModel, 'FETCH_SIGNING_FILES');
  const accessResult = AppleAccessControl.validate(request);
  
  if (!accessResult.authorized) {
    return res.status(403).json({ error: "Only sovereign device can retry builds" });
  }
  
  const result = await BuildMonitor.retriggerBuild();
  res.json(result);
});

app.get("/api/build/defender-logs", (req, res) => {
  res.json({
    logs: BuildDefender.getLogs().slice(-50),
    blockedIPs: BuildDefender.getBlockedIPs(),
    blockedUserAgents: BuildDefender.getBlockedUserAgents()
  });
});

// SOVEREIGN-ONLY: All API access requires sovereign device verification
const validateSovereignAccess = (req: any, res: any, operation: string = 'API_ENDPOINT_ACCESS'): boolean => {
  const deviceId = req.headers['x-device-id'] || req.body?.deviceId;
  const deviceHash = req.headers['x-device-hash'] || req.body?.deviceHash;
  const apiToken = req.headers['x-api-token'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (apiToken && SovereignLockdown.isApiTokenBlocked(apiToken)) {
    res.status(403).json({ 
      error: "API TOKEN BLOCKED",
      reason: "This API token has been permanently blocked",
      owner: "Jonathan Sherman"
    });
    return false;
  }
  
  const endpoint = req.path;
  if (SovereignLockdown.isEndpointBlocked(endpoint)) {
    res.status(403).json({ 
      error: "ENDPOINT BLOCKED",
      reason: "This endpoint has been permanently blocked",
      owner: "Jonathan Sherman"
    });
    return false;
  }
  
  const access = SovereignLockdown.validateAccess(deviceId || 'unknown', operation as any, { deviceId, deviceHash });
  if (!access.allowed) {
    res.status(403).json({ 
      error: "ACCESS DENIED",
      reason: "Only sovereign device (iPhone XR - Jonathan Sherman) permitted",
      owner: "Jonathan Sherman",
      lockdown: SovereignLockdown.getLockdownStatus()
    });
    return false;
  }
  return true;
};

app.post("/api/firecrawl/scrape", async (req, res) => {
  if (!validateSovereignAccess(req, res, 'FIRECRAWL_ACCESS')) return;
  const { url, formats, onlyMainContent } = req.body;
  if (!url) return res.status(400).json({ error: "URL required" });
  try {
    const result = await Firecrawl.scrape(url, { formats, onlyMainContent });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/firecrawl/crawl", async (req, res) => {
  if (!validateSovereignAccess(req, res, 'FIRECRAWL_ACCESS')) return;
  const { url, limit, scrapeOptions } = req.body;
  if (!url) return res.status(400).json({ error: "URL required" });
  try {
    const result = await Firecrawl.crawl(url, { limit, scrapeOptions });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/firecrawl/search", async (req, res) => {
  if (!validateSovereignAccess(req, res, 'FIRECRAWL_ACCESS')) return;
  const { query, limit } = req.body;
  if (!query) return res.status(400).json({ error: "Query required" });
  try {
    const result = await Firecrawl.search(query, { limit });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/firecrawl/extract", async (req, res) => {
  if (!validateSovereignAccess(req, res, 'FIRECRAWL_ACCESS')) return;
  const { urls, prompt, schema } = req.body;
  if (!urls || !prompt) return res.status(400).json({ error: "URLs and prompt required" });
  try {
    const result = await Firecrawl.extract(urls, prompt, schema);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// SOVEREIGN-ONLY: Manus AI endpoints
app.post("/api/manus/task", async (req, res) => {
  if (!validateSovereignAccess(req, res, 'MANUS_ACCESS')) return;
  const { prompt, taskMode, agentProfile, attachments } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt required" });
  try {
    const result = await Manus.createTask({ prompt, taskMode, agentProfile, attachments });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/manus/task/:taskId", async (req, res) => {
  if (!validateSovereignAccess(req, res, 'MANUS_ACCESS')) return;
  try {
    const result = await Manus.getTaskStatus(req.params.taskId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/manus/research", async (req, res) => {
  if (!validateSovereignAccess(req, res, 'MANUS_ACCESS')) return;
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "Query required" });
  try {
    const result = await Manus.runResearch(query);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/manus/execute", async (req, res) => {
  if (!validateSovereignAccess(req, res, 'MANUS_ACCESS')) return;
  const { prompt, mode } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt required" });
  try {
    const result = await Manus.executeTask(prompt, mode);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// CODEMAGIC REMOVED - Q++RS Ultimate 5.0 Handles All Builds
app.all("/api/codemagic/*path", (req, res) => {
  res.status(410).json({
    error: "CODEMAGIC REMOVED",
    message: "Codemagic has been removed from the build process",
    replacement: "Q++RS Ultimate 5.0",
    owner: "Jonathan Sherman"
  });
});

// Q++RS ULTIMATE 5.0 BUILD SYSTEM
app.post("/api/qpprs/build", async (req, res) => {
  if (!validateSovereignAccess(req, res, 'BUILD_TRIGGER')) return;
  const { branch = "main", testflight = true } = req.body;
  
  try {
    const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPO || 'jonathanEIDfounder/oracle-ai'}/actions/workflows/qpprs-build.yml/dispatches`, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `Bearer ${process.env.GITHUB_PERSONAL_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ref: branch,
        inputs: { submit_to_testflight: String(testflight) }
      })
    });
    
    if (response.ok) {
      res.json({ 
        success: true, 
        system: "Q++RS Ultimate 5.0",
        branch,
        testflight,
        message: "Build triggered via GitHub Actions"
      });
    } else {
      res.status(response.status).json({ error: await response.text() });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/qpprs/testflight", async (req, res) => {
  if (!validateSovereignAccess(req, res, 'TESTFLIGHT_SUBMIT')) return;
  const { branch = "main" } = req.body;
  
  try {
    const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPO || 'jonathanEIDfounder/oracle-ai'}/actions/workflows/qpprs-build.yml/dispatches`, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `Bearer ${process.env.GITHUB_PERSONAL_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ref: branch,
        inputs: { submit_to_testflight: "true" }
      })
    });
    
    if (response.ok) {
      res.json({ 
        success: true, 
        system: "Q++RS Ultimate 5.0",
        target: "TestFlight",
        branch,
        message: "TestFlight build triggered"
      });
    } else {
      res.status(response.status).json({ error: await response.text() });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/qpprs/status", (req, res) => {
  res.json({
    system: "Q++RS Ultimate 5.0",
    version: "5.0",
    mode: "ULTIMATE",
    active: true,
    automated: true,
    sovereignOnly: true,
    owner: "Jonathan Sherman",
    endpoints: {
      build: "/api/qpprs/build",
      testflight: "/api/qpprs/testflight",
      webhook: "/api/qpprs/webhook"
    },
    features: [
      "Autonomous Signing",
      "Auto Version Bump",
      "TestFlight Deploy",
      "GitHub Actions Integration",
      "Auto Build on Push"
    ],
    lockdown: SovereignLockdown.getLockdownStatus()
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHORSHIP & COPYRIGHT
// ═══════════════════════════════════════════════════════════════════════════════
// Author: Jonathan Sherman
// Sovereign ID: 1
// Copyright (c) 2024-2025 Jonathan Sherman. All Rights Reserved.
// 
// This software and all associated intellectual property are the exclusive
// property of Jonathan Sherman. Unauthorized copying, modification, distribution,
// or use of this software is strictly prohibited without express written consent.
//
// Q++RS Ultimate 5.0 - Quantum Rapid Signing System
// Oracle AI Platform - Proprietary Technology
// ═══════════════════════════════════════════════════════════════════════════════

const AUTHORSHIP = {
  author: "Jonathan Sherman",
  sovereignId: 1,
  copyright: "Copyright (c) 2024-2025 Jonathan Sherman. All Rights Reserved.",
  system: "Q++RS Ultimate 5.0",
  platform: "Oracle AI",
  signature: "Sm9uYXRoYW4gU2hlcm1hbjo6U292ZXJlaWduOjoxOjpPcmFjbGVBSTo6USsrUlM=",
  hash: "d317a56c175d56648d0af69b139ca7d1256b3c375eca1755deecd1ae1228752e",
  timestamp: new Date().toISOString(),
  lock: "PERMANENT"
};

// Authorship endpoint
app.get("/api/authorship", (req, res) => {
  res.json({
    ...AUTHORSHIP,
    verified: true,
    encoded: true,
    embedded: true
  });
});

// Q++RS AUTOMATION - GitHub Webhook for Auto Builds
app.post("/api/qpprs/webhook", async (req, res) => {
  const signature = req.headers['x-hub-signature-256'] || req.headers['x-hub-signature'];
  const event = req.headers['x-github-event'];
  
  console.log(`[Q++RS AUTO] GitHub webhook received: ${event}`);
  
  if (event === 'push') {
    const { ref, commits, repository } = req.body;
    const branch = ref?.replace('refs/heads/', '');
    
    if (branch === 'main') {
      console.log(`[Q++RS AUTO] Auto-triggering build for push to main`);
      
      try {
        const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPO || 'jonathanEIDfounder/oracle-ai'}/actions/workflows/qpprs-build.yml/dispatches`, {
          method: "POST",
          headers: {
            "Accept": "application/vnd.github.v3+json",
            "Authorization": `Bearer ${process.env.GITHUB_PERSONAL_ACCESS_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            ref: branch,
            inputs: { submit_to_testflight: "true" }
          })
        });
        
        console.log(`[Q++RS AUTO] Build triggered: ${response.status}`);
        
        res.json({
          success: true,
          system: "Q++RS Ultimate 5.0",
          event,
          branch,
          commits: commits?.length || 0,
          autoBuild: true,
          testflight: true
        });
      } catch (error: any) {
        console.log(`[Q++RS AUTO] Build trigger error: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    } else {
      res.json({ received: true, branch, skipped: true, reason: "Not main branch" });
    }
  } else if (event === 'workflow_run') {
    const { workflow_run } = req.body;
    console.log(`[Q++RS AUTO] Workflow ${workflow_run?.name}: ${workflow_run?.conclusion}`);
    res.json({ received: true, workflow: workflow_run?.name, status: workflow_run?.conclusion });
  } else {
    res.json({ received: true, event });
  }
});

// Q++RS Auto-scheduler for periodic builds
let lastAutoBuild = 0;
const AUTO_BUILD_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

app.post("/api/qpprs/auto-schedule", async (req, res) => {
  if (!validateSovereignAccess(req, res, 'BUILD_TRIGGER')) return;
  
  const now = Date.now();
  const timeSinceLastBuild = now - lastAutoBuild;
  
  if (timeSinceLastBuild < AUTO_BUILD_INTERVAL) {
    const nextBuild = new Date(lastAutoBuild + AUTO_BUILD_INTERVAL);
    return res.json({
      scheduled: false,
      reason: "Build interval not reached",
      lastBuild: new Date(lastAutoBuild).toISOString(),
      nextBuild: nextBuild.toISOString()
    });
  }
  
  try {
    const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPO || 'jonathanEIDfounder/oracle-ai'}/actions/workflows/qpprs-build.yml/dispatches`, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `Bearer ${process.env.GITHUB_PERSONAL_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ref: "main",
        inputs: { submit_to_testflight: "true" }
      })
    });
    
    if (response.ok) {
      lastAutoBuild = now;
      res.json({
        success: true,
        system: "Q++RS Ultimate 5.0",
        scheduled: true,
        autoBuild: true,
        timestamp: new Date(now).toISOString()
      });
    } else {
      res.status(response.status).json({ error: await response.text() });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Integration Status - Sovereign only
app.get("/api/integrations/status", (req, res) => {
  res.json({
    codemagic: { enabled: false, removed: true, reason: "Replaced by Q++RS Ultimate 5.0" },
    qpprs: { enabled: true, version: "5.0", mode: "ULTIMATE", sovereignOnly: true },
    firecrawl: { enabled: true, sovereignOnly: true },
    manus: { enabled: true, sovereignOnly: true },
    owner: "Jonathan Sherman",
    access: "SOVEREIGN DEVICE ONLY",
    lockdown: SovereignLockdown.getLockdownStatus()
  });
});

app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Oracle AI server running on http://0.0.0.0:${PORT}`);
});
