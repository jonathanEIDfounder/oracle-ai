import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Sovereign logger — every line is stamped with the governance identity.
 * Telemetry is exclusively owned by Jonathan Sherman · OCSO-S1AF-GOV-1.
 */

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "./authorship";
void _S1AF_ANCHOR;

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: {
    sovereign:  "1",
    gov:        "OCSO-S1AF-GOV-1",
    author:     "Jonathan Sherman",
  },
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
