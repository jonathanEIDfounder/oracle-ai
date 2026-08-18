/**
 * © 2026 Jonathan Sherman — S1AF (Sentient iOS One-Step App Framework)
 * Sovereign ID: 1 · OCSO-S1AF-GOV-1 · All rights reserved.
 *
 * Static asset routes — serve sovereign app assets (icons, images)
 * These routes are PUBLIC — no device token required (icons are referenced
 * in generated Xcode projects and must be downloadable during CI/CD).
 *
 * GET /api/assets/quantum-icon        — QuantumAdaptive 1024×1024 transparent PNG
 * GET /api/assets/quantum-icon/raw    — same, forces download
 */

import { Router, type Request, type Response } from "express";
import path   from "path";
import fs     from "fs";
import { logger }                   from "../lib/logger";
import { generateObfuscatedScript } from "../lib/script-obfuscate";
import { requireIphoneXR }          from "../middleware/device-auth";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "../lib/authorship";
void _S1AF_ANCHOR;

// Enrolled device token — used as the obfuscation source value
const ENROLLED_TOKEN  = "f679ab7288b11a59ffc8ea43687b5ec6dfec3db86e8dbf017b471c7a2a00dc4d";
// API base falls back to env var so it stays correct across deployments
function getApiBase(): string {
  return process.env.SENTIENT_API_BASE
    ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost:8080"}/api`;
}

const router = Router();

// __dirname in dist/ → go up one level to api-server root → assets/
const ICON_PATH = path.resolve(__dirname, "../assets/QuantumAdaptive_AppIcon.png");

function iconExists(): boolean {
  return fs.existsSync(ICON_PATH);
}

// GET /api/assets/quantum-icon — serve the 1024×1024 transparent PNG
router.get("/assets/quantum-icon", (_req: Request, res: Response) => {
  if (!iconExists()) {
    logger.warn("assets: quantum-icon not found");
    res.status(404).json({ ok: false, error: "App icon not found" });
    return;
  }
  res.setHeader("Content-Type",  "image/png");
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  res.setHeader("X-Icon-Spec",   "1024x1024 transparent PNG - QuantumAdaptive - Jonathan Sherman");
  res.sendFile(ICON_PATH);
});

// GET /api/assets/quantum-icon/raw — force-download
router.get("/assets/quantum-icon/raw", (_req: Request, res: Response) => {
  if (!iconExists()) {
    res.status(404).json({ ok: false, error: "App icon not found" });
    return;
  }
  res.setHeader("Content-Type",        "image/png");
  res.setHeader("Content-Disposition", 'attachment; filename="AppIcon-1024.png"');
  res.sendFile(ICON_PATH);
});

// GET /api/assets/quantum-icon/contents-json — AppIcon.appiconset/Contents.json
router.get("/assets/quantum-icon/contents-json", (_req: Request, res: Response) => {
  const jsonPath = path.resolve(__dirname, "../assets/AppIcon.appiconset.Contents.json");
  if (!fs.existsSync(jsonPath)) {
    res.status(404).json({ ok: false, error: "Contents.json not found" });
    return;
  }
  res.setHeader("Content-Type",        "application/json");
  res.setHeader("Content-Disposition", 'attachment; filename="Contents.json"');
  res.setHeader("Cache-Control",       "public, max-age=86400, immutable");
  res.sendFile(jsonPath);
});

// GET /api/assets/quantum-icon/setup-sh — plaintext script — device-locked
router.get("/assets/quantum-icon/setup-sh", requireIphoneXR, (_req: Request, res: Response) => {
  const shPath = path.resolve(__dirname, "../assets/setup-icon.sh");
  if (!fs.existsSync(shPath)) {
    res.status(404).json({ ok: false, error: "setup-icon.sh not found" });
    return;
  }
  res.setHeader("Content-Type",        "text/x-sh");
  res.setHeader("Content-Disposition", 'attachment; filename="setup-icon.sh"');
  res.sendFile(shPath);
});

// GET /api/assets/quantum-icon/setup-sh-obfuscated — 3-layer obfuscated setup script
// Locked to iPhone XR device token. Generates fresh on every request.
router.get("/assets/quantum-icon/setup-sh-obfuscated", requireIphoneXR, (req: Request, res: Response) => {
  try {
    const apiBase = getApiBase();
    const result  = generateObfuscatedScript(ENROLLED_TOKEN, apiBase);

    logger.info(
      { fingerprint: result.fingerprint, layers: result.layers, account: result.accountLock },
      "assets: obfuscated setup script generated"
    );

    res.setHeader("Content-Type",          "text/x-sh");
    res.setHeader("Content-Disposition",   'attachment; filename="setup-icon-obf.sh"');
    res.setHeader("X-S1AF-Fingerprint",    result.fingerprint);
    res.setHeader("X-S1AF-Layers",         String(result.layers));
    res.setHeader("X-S1AF-Account",        result.accountLock);
    res.setHeader("Cache-Control",         "no-store");
    res.send(result.script);
  } catch (err) {
    logger.error({ err }, "assets: obfuscated script generation failed");
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "obfuscation failed" });
  }
});

// GET /api/assets/quantum-icon/obfuscated-meta — fingerprint + layer metadata
router.get("/assets/quantum-icon/obfuscated-meta", requireIphoneXR, (req: Request, res: Response) => {
  try {
    const apiBase = getApiBase();
    const result  = generateObfuscatedScript(ENROLLED_TOKEN, apiBase);
    res.json({
      ok:             true,
      fingerprint:    result.fingerprint,
      layers:         result.layers,
      accountLock:    result.accountLock,
      tokenFragments: result.tokenFragments,
      urlFragments:   result.urlFragments,
      endpoint:       "/api/assets/quantum-icon/setup-sh-obfuscated",
      requiresDevice: true,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "obfuscation failed" });
  }
});

// POST /api/assets/quantum-icon/automate — manual obfuscation run, device-locked
// Body (all optional): { token, apiBase, xcassets }
// Returns: full script + fingerprint + layer metadata
router.post("/assets/quantum-icon/automate", requireIphoneXR, (req: Request, res: Response) => {
  try {
    const {
      token    = ENROLLED_TOKEN,
      apiBase  = getApiBase(),
      xcassets = "QuantumAdaptive/Assets.xcassets/AppIcon.appiconset",
    } = (req.body ?? {}) as { token?: string; apiBase?: string; xcassets?: string };

    const result = generateObfuscatedScript(token, apiBase, xcassets);

    logger.info(
      { fingerprint: result.fingerprint, layers: result.layers, xcassets },
      "assets: manual automation — obfuscated script generated"
    );

    res.json({
      ok:             true,
      script:         result.script,
      fingerprint:    result.fingerprint,
      layers:         result.layers,
      accountLock:    result.accountLock,
      tokenFragments: result.tokenFragments,
      urlFragments:   result.urlFragments,
      xcassets,
      apiBase,
      generatedAt:    new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "assets: manual automation failed");
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "obfuscation failed" });
  }
});

// GET /api/assets/quantum-icon/meta — icon metadata (for generated project scripts)
router.get("/assets/quantum-icon/meta", (_req: Request, res: Response) => {
  res.json({
    ok:           true,
    exists:       iconExists(),
    icon:         "/api/assets/quantum-icon",
    iconRaw:      "/api/assets/quantum-icon/raw",
    contentsJson: "/api/assets/quantum-icon/contents-json",
    setupScript:  "/api/assets/quantum-icon/setup-sh",
    filename:     "AppIcon-1024.png",
    size:         "1024x1024",
    format:       "PNG",
    alpha:        true,
    placement:    "Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png",
    contentsPlacement: "Assets.xcassets/AppIcon.appiconset/Contents.json",
  });
});

export default router;
