#!/usr/bin/env bash
# ================================================================
# S1AF — Manual Obfuscation Automation Script
# © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1
#
# Calls POST /api/assets/quantum-icon/automate on the local
# (or remote) Sentient API server, downloads the 3-layer
# obfuscated setup script, verifies its SHA-256 fingerprint,
# and saves it to ./dist/setup-icon-obf.sh
#
# Usage:
#   bash scripts/manual-obfuscate.sh                  # local dev
#   bash scripts/manual-obfuscate.sh https://your-domain.replit.dev
#   bash scripts/manual-obfuscate.sh <api-base> <xcassets-path>
# ================================================================
set -euo pipefail

readonly _S1AF_AUTHOR="© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"
# ── Config ──────────────────────────────────────────────────────
DEVICE_TOKEN="${DEVICE_TOKEN:-f679ab7288b11a59ffc8ea43687b5ec6dfec3db86e8dbf017b471c7a2a00dc4d}"
API_BASE="${1:-http://localhost:8080/api}"
XCASSETS="${2:-QuantumAdaptive/Assets.xcassets/AppIcon.appiconset}"
OUT_DIR="dist"
OUT_FILE="${OUT_DIR}/setup-icon-obf.sh"
META_FILE="${OUT_DIR}/setup-icon-obf.meta.json"

mkdir -p "${OUT_DIR}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  S1AF Manual Obfuscation — OCSO-S1AF-GOV-1"
echo "  API base : ${API_BASE}"
echo "  xcassets : ${XCASSETS}"
echo "  Output   : ${OUT_FILE}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Call the automate endpoint ───────────────────────────────────
echo ""
echo "→  Calling POST ${API_BASE}/assets/quantum-icon/automate ..."

RESPONSE=$(curl -sf \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Device-Token: ${DEVICE_TOKEN}" \
  -d "{\"xcassets\":\"${XCASSETS}\",\"apiBase\":\"${API_BASE}\"}" \
  "${API_BASE}/assets/quantum-icon/automate")

# ── Parse JSON + write file atomically via Python ────────────────
# Save response to tmp file so Python can read it without heredoc/pipe conflict
TMP_RESP=$(mktemp)
TMP_PY=$(mktemp --suffix=.py)
echo "${RESPONSE}" > "${TMP_RESP}"

cat > "${TMP_PY}" << 'PYEOF'
import json, sys, hashlib

resp_file, out_file = sys.argv[1], sys.argv[2]
with open(resp_file) as f:
    data = json.load(f)

if not data.get("ok"):
    print("ERR:" + data.get("error", "unknown error"))
    sys.exit(1)

script = data["script"]
with open(out_file, "w", newline="") as f:
    f.write(script)

local_fp = hashlib.sha256(script.encode()).hexdigest()
print("FINGERPRINT=" + data["fingerprint"])
print("LOCAL_FP="    + local_fp)
print("LAYERS="      + str(data["layers"]))
print("ACCOUNT="     + data["accountLock"])
print("GENERATED="   + data["generatedAt"])
PYEOF

PARSE_OUT=$(python3 "${TMP_PY}" "${TMP_RESP}" "${OUT_FILE}")
rm -f "${TMP_RESP}" "${TMP_PY}"

# Check for parse/write errors
if echo "${PARSE_OUT}" | grep -q "^ERR:"; then
  ERR=$(echo "${PARSE_OUT}" | sed 's/^ERR://')
  echo "✗  Server returned error: ${ERR}" >&2
  exit 1
fi

eval "${PARSE_OUT}"   # sets FINGERPRINT LOCAL_FP LAYERS ACCOUNT GENERATED
chmod +x "${OUT_FILE}"

# ── Write metadata ────────────────────────────────────────────────
cat > "${META_FILE}" <<METAEOF
{
  "fingerprint":    "${FINGERPRINT}",
  "localSha256":    "${LOCAL_FP}",
  "layers":         ${LAYERS},
  "accountLock":    "${ACCOUNT}",
  "generatedAt":    "${GENERATED}",
  "apiBase":        "${API_BASE}",
  "xcassets":       "${XCASSETS}",
  "output":         "${OUT_FILE}"
}
METAEOF

# ── Report ────────────────────────────────────────────────────────
echo ""
echo "✓  Script written  → ${OUT_FILE}"
echo "✓  Metadata        → ${META_FILE}"
echo ""
echo "  Layers          : ${LAYERS} (XOR-fragment · base64-fragment · eval-core)"
echo "  Account lock    : ${ACCOUNT}"
echo "  Generated at    : ${GENERATED}"
echo "  Server SHA-256  : ${FINGERPRINT}"
echo "  Local  SHA-256  : ${LOCAL_FP}"
echo ""

if [ "${FINGERPRINT}" = "${LOCAL_FP}" ]; then
  echo "✓  FINGERPRINT VERIFIED — script integrity confirmed"
else
  echo "✗  FINGERPRINT MISMATCH — possible tampering" >&2
  exit 2
fi

echo ""
echo "  Run it:"
echo "    bash ${OUT_FILE}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
