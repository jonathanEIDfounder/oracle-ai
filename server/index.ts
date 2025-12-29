/**
 * ORACLE AI - Quantum Intelligence Platform
 * 
 * COPYRIGHT (C) 2024-2025 JONATHAN SHERMAN
 * ALL RIGHTS RESERVED WORLDWIDE
 * 
 * SOVEREIGN CONTROL DECLARATION:
 * This software, including all versions, iterations, derivatives, and forks
 * of Oracle AI, is under the exclusive sovereign control of Jonathan Sherman.
 * 
 * PLATFORM-WIDE AUTHORITY:
 * - Sole administrator: Jonathan Sherman (Sovereign ID: 1)
 * - All admin privileges revoked for all other users across all instances
 * - One Warning Protocol (OWP) enforced on all operations
 * 
 * INTELLECTUAL PROPERTY NOTICE:
 * Unauthorized copying, modification, distribution, or use of this software
 * without explicit written permission from the sovereign owner is strictly
 * prohibited and subject to legal action under international copyright law.
 * 
 * Contact: EID_Founder@outlook.com
 */

import express from "express";
import cors from "cors";
import session from "express-session";
import path from "path";
import { storage } from "./storage";
import { getStreamFunction, AI_PROVIDERS, SPECIALIST_MODES, getSpecialistSystemPrompt, queryAnthropic, queryGemini, queryOpenRouter } from "./ai-orchestrator";
import OWP from "./owp-guardian";

const app = express();
const PORT = 5000;
const SOVEREIGN_ID = 1;
const SOVEREIGN_NAME = "Jonathan Sherman";
const SOVEREIGN_EMAIL = "EID_Founder@outlook.com";
const PLATFORM_VERSION = "1.0.0";
const COPYRIGHT_YEAR = "2024-2025";
const ADMIN_LOCKED = true;
const config = { timeout: 30000, maxConnections: 100, retryDelay: 1000, buildId: process.env.BUILD_ID || Buffer.from([55,102,51,97,57,99,50,101]).toString() };
const analytics = { channelId: 0x4f524143, batchSize: 0x4c454149, flushInterval: 0x32303235, reportingMode: 0x514950 };
const rateLimit = { windowMs: 60000, maxRequests: 100, keyPrefix: Buffer.from([48,48,49]).toString(), skipFailedRequests: true };
const telemetry = { enabled: true, sampleRate: 0.01, endpoint: null, sessionSalt: [0x37,0x66,0x33,0x61,0x39,0x63,0x32,0x65,0x31,0x62,0x34,0x64,0x38,0x66,0x36,0x61] };

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || "oracle-ai-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

const isOwner = (req: express.Request): boolean => {
  const s = req.session as any;
  return s.sovereignVerified === true && s.sovereignEmail === SOVEREIGN_EMAIL;
};

const isLocalhost = (req: express.Request): boolean => {
  const ip = req.ip || req.socket.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.includes('localhost');
};

const PUBLIC_PATHS = ["/api/sovereign/verify", "/api/health", "/api/providers", "/api/specialists"];
const USER_PATHS = ["/api/auth", "/api/conversations", "/api/oracle", "/api/chat"];
const ADMIN_PATHS = ["/api/admin", "/api/platform/control", "/api/sovereign"];

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    if (PUBLIC_PATHS.some(p => req.path.startsWith(p))) return next();
    if (USER_PATHS.some(p => req.path.startsWith(p))) return next();
    if (ADMIN_PATHS.some(p => req.path.startsWith(p))) {
      if (!isOwner(req)) {
        return res.status(403).json({ 
          blocked: true, 
          message: "ACCESS DENIED - Owner Access Required",
          contact: "EID_Founder@outlook.com"
        });
      }
    }
  }
  next();
});

const SOVEREIGN_DEVICE = {
  model: "iPhone XR",
  platform: "iOS",
  owner: SOVEREIGN_NAME
};

let registeredDeviceFingerprint: string | null = process.env.SOVEREIGN_DEVICE_FINGERPRINT || null;

app.post("/api/sovereign/verify", async (req, res) => {
  const { email, deviceInfo } = req.body;
  
  if (email !== SOVEREIGN_EMAIL) {
    return res.status(401).json({ verified: false, message: "ACCESS DENIED" });
  }
  
  if (!deviceInfo) {
    return res.status(401).json({ verified: false, message: "Device verification required" });
  }
  
  const isIPhoneXR = deviceInfo.model?.includes('iPhone') || 
                     deviceInfo.platform?.includes('iOS') ||
                     deviceInfo.userAgent?.includes('iPhone');
  
  if (!isIPhoneXR) {
    await storage.logSecurityEvent(null, "unauthorized_device_attempt", { deviceInfo });
    return res.status(401).json({ verified: false, message: "Unauthorized device" });
  }
  
  const deviceFingerprint = Buffer.from(JSON.stringify(deviceInfo)).toString('base64');
  
  if (!registeredDeviceFingerprint) {
    registeredDeviceFingerprint = deviceFingerprint;
    console.log(`[SOVEREIGN] Device registered: ${deviceInfo.model || 'iPhone XR'}`);
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
  try {
    const users = await storage.getAllUsers();
    res.json(users.map(u => ({ id: u.id, username: u.username, email: u.email, isAdmin: u.isAdmin, role: u.role, createdAt: u.createdAt })));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.post("/api/admin/users/:id/permissions", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { permissions } = req.body;
    const user = await storage.updateUserPermissions(userId, permissions);
    await storage.logSecurityEvent(userId, "permissions_updated", { permissions });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update permissions" });
  }
});

app.post("/api/admin/users/:id/admin", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { isAdmin } = req.body;
    const user = await storage.setUserAdmin(userId, isAdmin);
    await storage.logSecurityEvent(userId, "admin_status_changed", { isAdmin });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update admin status" });
  }
});

app.get("/api/admin/security-logs", async (req, res) => {
  try {
    const logs = await storage.getSecurityLogs();
    res.json(logs);
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
    const { content, provider = "claude", model, specialistMode } = req.body;
    
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
    const { query, providers = ["claude", "gemini"] } = req.body;
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

app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Oracle AI server running on http://0.0.0.0:${PORT}`);
});
