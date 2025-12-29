import express from "express";
import cors from "cors";
import session from "express-session";
import path from "path";
import { storage } from "./storage";
import { getStreamFunction, AI_PROVIDERS, queryAnthropic, queryGemini, queryOpenRouter } from "./ai-orchestrator";

const _ORACLEAI_CERT = { id: "ORACLEAI-2025-QIP-001", h: "7f3a9c2e1b4d8f6a0c5e9b3d7a1f4c8e", v: "1.0.0", t: 1735430400000 };
const _ORACLEAI_WATERMARK = { s1: "UVVBTlRVTS1JTlRFTExJR0VOQ0U=", s2: "T1JBQ0xFQUktMjAyNS1DRVJU", owp: true };
const _ORACLEAI_SIG = Buffer.from("ORACLEAI-2025-QIP-001-VERIFIED").toString("base64");
const app = express();
const PORT = 5000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

app.use(session({
  secret: process.env.SESSION_SECRET || "oracle-ai-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", version: "1.0.0", name: "Oracle AI", _c: "ORACLEAI-2025-QIP-001" });
});

app.get("/api/verify", (req, res) => {
  res.json({ 
    cert: _ORACLEAI_CERT.id, 
    hash: _ORACLEAI_CERT.h, 
    valid: true, 
    issued: new Date(_ORACLEAI_CERT.t).toISOString(),
    signature: _ORACLEAI_SIG,
    watermarks: _ORACLEAI_WATERMARK,
    protocol: "OWP",
    enforcement: "strict"
  });
});

app.get("/api/providers", (req, res) => {
  res.json(AI_PROVIDERS);
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password, isAdmin } = req.body;
    const existing = await storage.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: "Email already exists" });
    }
    const user = await storage.createUser(username, email, password, isAdmin);
    await storage.logSecurityEvent(user.id, "user_registered", { username, email });
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
    const { content, provider = "claude", model } = req.body;
    
    await storage.createMessage(conversationId, "user", content);
    const messages = await storage.getMessagesByConversation(conversationId);
    const chatMessages = messages.map(m => ({ role: m.role, content: m.content }));

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

app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Oracle AI server running on http://0.0.0.0:${PORT}`);
});
