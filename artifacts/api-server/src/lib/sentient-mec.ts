// =============================================================
// sentient-mec.ts — Sentient MEC Edge Routing Layer
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · Celestial Core
// Sovereign ID: 1 · OCSO-S1AF-GOV-1
// =============================================================
// Multi-access Edge Computing (MEC) integration.
// Standard: ETSI GS MEC 011 / 012 / 013 / 016
//
// MEC places sovereign compute at the edge of the cellular
// network — physically co-located with cell towers. Sentient
// queries route to the nearest edge node first, reducing round-
// trip time and keeping traffic off the open internet backbone.
//
// Coverage: ALL networks — LTE / 5G NR / WiFi / fixed
// Always-on: edge nodes are polled continuously and cached
//            so the best path is available at any moment
// =============================================================

import { logger } from "./logger";
import { CONFIG  } from "./config";

// ── ETSI MEC data types ───────────────────────────────────────

interface MECEdgeNode {
  id:           string;
  name:         string;
  endpoint:     string;        // HTTPS URL of the Sentient edge service
  latencyMs:    number;        // measured round-trip
  networkType:  "5G" | "LTE" | "WiFi" | "fixed" | "unknown";
  lastSeenAt:   Date;
  sovereign:    boolean;       // true when node has been verified as sovereign
}

interface MECApplicationInfo {
  appName:      string;
  appProvider:  string;
  appEndpoint:  string;
  referenceURL: string;
}

// ── Edge node registry ────────────────────────────────────────

const edgeNodes = new Map<string, MECEdgeNode>();

// Known sovereign MEC edge endpoints (pre-seeded; discovery adds more).
// In production: registered with ETSI-compliant MEC orchestrators.
const SEED_EDGES: Omit<MECEdgeNode, "latencyMs" | "lastSeenAt" | "sovereign">[] = [
  {
    id:          "edge-us-west-1",
    name:        "Sentient Edge — US West",
    endpoint:    "https://edge-us-west.sentient.s1af",
    networkType: "5G",
  },
  {
    id:          "edge-us-east-1",
    name:        "Sentient Edge — US East",
    endpoint:    "https://edge-us-east.sentient.s1af",
    networkType: "5G",
  },
  {
    id:          "edge-cdn-1",
    name:        "Sentient Edge — CDN Fallback",
    endpoint:    "https://edge-cdn.sentient.s1af",
    networkType: "fixed",
  },
];

// ── MECRouter ─────────────────────────────────────────────────

export const MECRouter = {

  // ── Bootstrap ───────────────────────────────────────────────

  init(): void {
    // Seed known nodes
    for (const node of SEED_EDGES) {
      edgeNodes.set(node.id, {
        ...node,
        latencyMs:  999,
        lastSeenAt: new Date(0),   // never measured yet
        sovereign:  false,
      });
    }
    logger.info({ count: edgeNodes.size }, "[MEC] Edge node registry seeded");

    // Start continuous latency probing
    MECRouter.startProbing();
  },

  // ── Continuous probing ──────────────────────────────────────
  // Probes each node every 30 seconds. Updates latency and
  // sovereign verification status.

  startProbing(): void {
    const probe = async () => {
      for (const [id, node] of edgeNodes) {
        try {
          const start = Date.now();
          const resp  = await fetch(`${node.endpoint}/health`, {
            signal:  AbortSignal.timeout(3000),
            headers: { "X-Sentient-Probe": "1", "X-Sovereign-ID": "1" },
          });
          const latencyMs = Date.now() - start;
          const sovereign = resp.headers.get("X-Sentient-Sovereign") === "1";

          edgeNodes.set(id, { ...node, latencyMs, sovereign, lastSeenAt: new Date() });
          logger.debug({ id, latencyMs, sovereign }, "[MEC] Edge probed");
        } catch {
          // Node unreachable — mark stale but don't remove (may recover)
          edgeNodes.set(id, { ...node, latencyMs: 9999, lastSeenAt: node.lastSeenAt });
        }
      }
    };

    // First probe immediately, then every 30 seconds
    void probe();
    setInterval(() => void probe(), 30_000);
  },

  // ── Best edge selection ──────────────────────────────────────
  // Returns the lowest-latency sovereign node measured within
  // the last 60 seconds. Falls back to cloud hub if none available.

  bestEdge(): MECEdgeNode | null {
    const cutoff = Date.now() - 60_000;
    const alive  = Array.from(edgeNodes.values())
      .filter(n => n.sovereign && n.lastSeenAt.getTime() > cutoff)
      .sort((a, b) => a.latencyMs - b.latencyMs);

    return alive[0] ?? null;
  },

  // ── Route a query ────────────────────────────────────────────
  // Returns the best available endpoint for a Sentient query.
  // Priority: MEC edge (lowest latency) → Sentient cloud hub.

  routeEndpoint(): { url: string; type: "mec" | "cloud"; latencyMs: number } {
    const edge = MECRouter.bestEdge();
    if (edge) {
      return { url: edge.endpoint, type: "mec", latencyMs: edge.latencyMs };
    }
    // Cloud fallback — oracle-ai server itself
    return { url: process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "https://oracle-ai.replit.app",
      type: "cloud", latencyMs: 999 };
  },

  // ── ETSI MEC Application Registry query (GS MEC 012) ────────
  // Queries a cell tower's MEC Application Registry to discover
  // edge endpoints announced by the serving network.

  async discoverFromRegistry(registryURL: string): Promise<number> {
    try {
      const resp = await fetch(`${registryURL}/mec/mp1/v1/applications`, {
        signal:  AbortSignal.timeout(5000),
        headers: { "Accept": "application/json" },
      });
      if (!resp.ok) return 0;

      const apps = await resp.json() as MECApplicationInfo[];
      let added = 0;

      for (const app of apps) {
        if (app.appName?.toLowerCase().includes("sentient") && app.appEndpoint) {
          const id = `mec-discovered-${Buffer.from(app.appEndpoint).toString("base64").slice(0, 8)}`;
          if (!edgeNodes.has(id)) {
            edgeNodes.set(id, {
              id,
              name:        app.appName,
              endpoint:    app.appEndpoint,
              networkType: "5G",
              latencyMs:   999,
              lastSeenAt:  new Date(0),
              sovereign:   false,
            });
            added++;
            logger.info({ id, endpoint: app.appEndpoint }, "[MEC] Edge discovered via registry");
          }
        }
      }
      return added;
    } catch {
      return 0;
    }
  },

  // ── Register a new edge node (sovereign broadcast) ───────────

  registerEdge(node: Omit<MECEdgeNode, "latencyMs" | "lastSeenAt" | "sovereign">): void {
    edgeNodes.set(node.id, { ...node, latencyMs: 999, lastSeenAt: new Date(0), sovereign: false });
    logger.info({ id: node.id, endpoint: node.endpoint }, "[MEC] Edge registered");
  },

  // ── Status snapshot ──────────────────────────────────────────

  status() {
    const best = MECRouter.bestEdge();
    return {
      nodes:       edgeNodes.size,
      bestEdge:    best ? { id: best.id, latencyMs: best.latencyMs, type: best.networkType } : null,
      route:       MECRouter.routeEndpoint(),
      sovereignID: 1,
      govRef:      "OCSO-S1AF-GOV-1",
    };
  },
};

// Auto-init on import
MECRouter.init();
