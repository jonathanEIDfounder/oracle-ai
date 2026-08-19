#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# test-hmac-live.sh — End-to-end HMAC deploy auth smoke test
# © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 · Sovereign ID: 1
#
# Sends a properly-signed HMAC request to /api/deploy/trigger on the running
# Replit API server and confirms the response is NOT 401.
#
# Usage:
#   bash scripts/test-hmac-live.sh [BASE_URL]
#
#   BASE_URL defaults to http://localhost:${PORT:-3001}
#
# Requirements: curl, openssl, python3 (or jq for pretty output)
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

readonly _S1AF_AUTHOR="© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"
BASE_URL="${1:-http://localhost:${PORT:-3001}}"
ENDPOINT="${BASE_URL}/api/deploy/trigger"

# ── 1. Load DEPLOY_SECRET ─────────────────────────────────────────────────────
if [[ -z "${DEPLOY_SECRET:-}" ]]; then
  echo "✗  DEPLOY_SECRET is not set in the environment."
  echo "   Export it before running this script:"
  echo "   export DEPLOY_SECRET=<your-secret>"
  exit 1
fi

if [[ "${#DEPLOY_SECRET}" -lt 8 ]]; then
  echo "✗  DEPLOY_SECRET is too short (< 8 chars). Refusing to test with a weak secret."
  exit 1
fi

# ── 2. Build canonical string + signature ────────────────────────────────────
BODY='{"source":"test-hmac-live-s1af"}'
TS="$(date +%s)"
METHOD="POST"
PATH_PART="/api/deploy/trigger"

BODY_HASH="$(printf '%s' "$BODY" | openssl dgst -sha256 | awk '{print $NF}')"
CANON="${TS}
${METHOD}
${PATH_PART}
${BODY_HASH}"

SIG="$(printf '%s' "$CANON" | openssl dgst -sha256 -hmac "$DEPLOY_SECRET" | awk '{print $NF}')"

echo ""
echo "  ┌──────────────────────────────────────────────────────────────┐"
echo "  │  S1AF HMAC Deploy Auth — Live Smoke Test                     │"
echo "  ├──────────────────────────────────────────────────────────────┤"
printf "  │  Endpoint : %-51s│\n" "$ENDPOINT"
printf "  │  Timestamp: %-51s│\n" "$TS"
printf "  │  Body-SHA : %-51s│\n" "${BODY_HASH:0:51}"
printf "  │  Signature: %-51s│\n" "${SIG:0:51}"
echo "  └──────────────────────────────────────────────────────────────┘"
echo ""

# ── 3. Send the HMAC-signed request ──────────────────────────────────────────
# Do NOT use -f/--fail: it makes curl exit non-zero for 4xx/5xx before
# writing %{http_code} to the capture var.  Use plain -s and always exit 0.
HTTP_STATUS="$(curl -s -o /tmp/hmac-test-body.json -w "%{http_code}" \
  -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "X-Deploy-Timestamp: ${TS}" \
  -H "X-Deploy-Signature: ${SIG}" \
  -d "$BODY" 2>/dev/null)"

RESP_BODY="$(cat /tmp/hmac-test-body.json 2>/dev/null || echo '{}')"

echo "  HTTP status: ${HTTP_STATUS}"
echo "  Response   : ${RESP_BODY}"
echo ""

# ── 4. Evaluate result ────────────────────────────────────────────────────────
if [[ "$HTTP_STATUS" -eq 401 ]]; then
  # Distinguish HMAC failure from sovereign-gate rejection.
  # A sovereign_required error means HMAC auth passed but the sovereign
  # biometric middleware fired afterward — that is expected in production
  # and confirms the HMAC layer works correctly.
  if echo "$RESP_BODY" | python3 -c \
      "import json,sys; d=json.load(sys.stdin); exit(0 if d.get('error')=='sovereign_required' else 1)" 2>/dev/null; then
    echo "  ✓  PASSED — HMAC signature accepted. Blocked by sovereign gate (expected)."
    echo "     The deploy endpoint is protected by requireSovereign after HMAC auth."
    echo "     A biometric session token is required for full dispatch in production."
    exit 0
  fi
  echo "  ✗  FAILED — server returned 401 Unauthorized."
  echo "     The HMAC signature was rejected. Check:"
  echo "     • DEPLOY_SECRET matches what the server has configured."
  echo "     • captureRawBody middleware runs before express.json() on the server."
  echo "     • Clock skew between client and server is < 5 minutes."
  exit 1
fi

if [[ "$HTTP_STATUS" -eq 500 ]]; then
  echo "  ✗  FAILED — server returned 500."
  echo "     This usually means captureRawBody middleware is missing on the server."
  echo "     Fix: ensure raw-body capture runs before express.json() in server/index.ts."
  exit 1
fi

if [[ "$HTTP_STATUS" -eq 503 ]]; then
  echo "  ✓  PASSED — auth accepted (503 = no GitHub PAT configured, which is expected)."
  echo "     HMAC signature was verified correctly. Deploy endpoint is reachable."
  exit 0
fi

if [[ "$HTTP_STATUS" -eq 200 ]]; then
  echo "  ✓  PASSED — deploy triggered successfully (200 OK)."
  exit 0
fi

if [[ "$HTTP_STATUS" -eq 429 ]]; then
  echo "  ⚠  Rate-limited (429) — auth passed but too many requests this minute."
  echo "     Wait 60 seconds and retry."
  exit 0
fi

echo "  ⚠  Unexpected status ${HTTP_STATUS} — check the server logs."
exit 1
