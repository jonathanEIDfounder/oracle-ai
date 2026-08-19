# Oracle AI

Quantum Intelligence Platform

---

## Deploy endpoint — HMAC authentication

The `POST /api/deploy/trigger` (and `GET /api/deploy/status`) endpoints are protected by **HMAC-SHA256 request signing**. The raw `DEPLOY_SECRET` never travels over the wire.

### Canonical string

```
${timestamp}\n${METHOD}\n${path}\n${sha256hex(rawBody)}
```

| Part | Details |
|------|---------|
| `timestamp` | Unix seconds (integer), sent as `X-Deploy-Timestamp` header |
| `METHOD` | Upper-case HTTP verb (`POST`, `GET`, …) |
| `path` | URL path without query string (e.g. `/api/deploy/trigger`) |
| `sha256hex(rawBody)` | Hex SHA-256 of the raw request body bytes (empty string → `sha256hex("")` when no body) |

Sign the canonical string with `HMAC-SHA256(DEPLOY_SECRET, canonical)` and send the lowercase hex digest as `X-Deploy-Signature`.

Replay window: **±300 seconds** (5 minutes). Requests outside this window are rejected with 401.

A legacy `X-Deploy-Token: <DEPLOY_SECRET>` header is also accepted for back-compat with older shell scripts, but the HMAC path is preferred.

---

## Running the HMAC auth tests

The Replit API server (`artifacts/api-server`) ships a Vitest test suite that covers the trigger endpoint's authentication:

```bash
# from the monorepo root
DEPLOY_SECRET=your-secret pnpm --filter @workspace/api-server run test

# or, from the artifact directory
cd artifacts/api-server
DEPLOY_SECRET=your-secret pnpm run test
```

The vitest config (`artifacts/api-server/vitest.config.ts`) sets `DEPLOY_SECRET=test-deploy-secret-ok` by default so tests run without any extra env vars in CI.

### What the HMAC tests assert

Located in `artifacts/api-server/src/routes/deploy.test.ts` under `POST /trigger — HMAC authentication (regression guard)`:

| Test | Expected status |
|------|-----------------|
| Correctly signed request | **not 401** (auth passes; handler may return 200/503 depending on PAT) |
| No auth headers at all | **401** |
| Signed with wrong secret | **401** |
| Timestamp > 5 min in the past (stale) | **401** |
| Valid timestamp but garbage signature | **401** |

These tests guard against regressions where middleware order changes (e.g. `express.json()` placed above the raw-body capture) silently break HMAC verification.

---

## Quick curl example

```bash
SECRET="your-deploy-secret"
TS=$(date +%s)
BODY='{"source":"oracle-ai-deploy"}'
BODY_HASH=$(printf '%s' "$BODY" | openssl dgst -sha256 -hex | awk '{print $2}')
CANON="${TS}\nPOST\n/api/deploy/trigger\n${BODY_HASH}"
SIG=$(printf '%b' "$CANON" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

curl -X POST https://your-server/api/deploy/trigger \
  -H "Content-Type: application/json" \
  -H "X-Deploy-Timestamp: $TS" \
  -H "X-Deploy-Signature: $SIG" \
  -d "$BODY"
```

The `Scripts/SiriDeploy/` directory contains a production shell script that follows this same pattern.
