/**
 * © 2026 Jonathan Sherman — S1AF · Sentient iOS One-Step App Framework
 * Sovereign ID: 1 · OCSO-S1AF-GOV-1
 *
 * Formula route — resolves any app description into integrations + manifest.
 */

import { Router } from "express";
import { resolveFormula } from "../lib/formula";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "../lib/authorship";
void _S1AF_ANCHOR;

const router = Router();

// POST /formula/resolve
router.post("/formula/resolve", (req, res) => {
  const { appDescription, platform, requirements } = req.body as {
    appDescription?: string;
    platform?: string;
    requirements?: string;
  };

  if (!appDescription || typeof appDescription !== "string" || !appDescription.trim()) {
    res.status(400).json({ error: "appDescription is required" });
    return;
  }

  const desc = requirements
    ? `${appDescription.trim()}\n\nAdditional requirements: ${requirements.trim()}`
    : appDescription.trim();

  const result = resolveFormula(desc, platform ?? "iOS");
  res.json(result);
});

export default router;
