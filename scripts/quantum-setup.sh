#!/usr/bin/env bash
# =============================================================
# quantum-setup.sh — IBM Quantum API Token → macOS Keychain
# Author: Jonathan Sherman
# Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
# Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
# =============================================================
#
# Stores your IBM Quantum API token in the macOS Keychain and
# optionally exports it to the AARTE cipherstore for Linux use.
#
# Usage:
#   bash scripts/quantum-setup.sh                   # interactive
#   bash scripts/quantum-setup.sh --clear           # remove stored token
#   bash scripts/quantum-setup.sh --verify          # test the stored token
#   bash scripts/quantum-setup.sh --show            # print obfuscated token
#   IBM_QUANTUM_TOKEN=mytoken bash scripts/quantum-setup.sh --save
# =============================================================

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
KEYCHAIN_SERVICE="com.s1af.aarte.quantum"
KEYCHAIN_ACCOUNT="ibm-quantum-token"
IBM_QUANTUM_API="https://auth.quantum-computing.ibm.com/api/users/loginWithToken"
CIPHER_DIR="${HOME}/.s1af-cipher"
TOKEN_ENC_FILE="${CIPHER_DIR}/quantum-token.enc"

BOLD="\033[1m"; RESET="\033[0m"
GREEN="\033[32m"; RED="\033[31m"; YELLOW="\033[33m"; CYAN="\033[36m"
ok()   { echo -e "  ${GREEN}✓${RESET}  $*"; }
fail() { echo -e "  ${RED}✗${RESET}  $*"; }
info() { echo -e "  ${CYAN}→${RESET}  $*"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $*"; }

# ── macOS check ───────────────────────────────────────────────────────────────
if [[ "$(uname)" != "Darwin" ]]; then
  # Linux/CI: read from cipherstore or env
  if [[ -n "${IBM_QUANTUM_TOKEN:-}" ]]; then
    ok "IBM_QUANTUM_TOKEN found in environment (length: ${#IBM_QUANTUM_TOKEN})"
    exit 0
  fi
  if [[ -f "$TOKEN_ENC_FILE" ]]; then
    ok "IBM Quantum token found in cipherstore: ${TOKEN_ENC_FILE}"
    exit 0
  fi
  warn "Not macOS — Keychain unavailable. Set IBM_QUANTUM_TOKEN in environment."
  exit 1
fi

echo ""
echo -e "${BOLD}  S1AF — IBM Quantum Token Setup${RESET}"
echo -e "  © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1"
echo ""

# ── Parse arguments ───────────────────────────────────────────────────────────
MODE="setup"
for arg in "$@"; do
  case "$arg" in
    --clear)  MODE="clear"  ;;
    --verify) MODE="verify" ;;
    --show)   MODE="show"   ;;
    --save)   MODE="save"   ;;
  esac
done

# ── Helper: save to Keychain ──────────────────────────────────────────────────
save_token() {
  local token="$1"
  security add-generic-password \
    -s "$KEYCHAIN_SERVICE" \
    -a "$KEYCHAIN_ACCOUNT" \
    -w "$token" \
    -U 2>/dev/null
  ok "Token saved to Keychain (service: ${KEYCHAIN_SERVICE})"
}

# ── Helper: read from Keychain ────────────────────────────────────────────────
read_token() {
  security find-generic-password \
    -s "$KEYCHAIN_SERVICE" \
    -a "$KEYCHAIN_ACCOUNT" \
    -w 2>/dev/null || echo ""
}

# ── Helper: validate with IBM Quantum API ─────────────────────────────────────
validate_token() {
  local token="$1"
  local resp
  resp="$(curl -sf -X POST "${IBM_QUANTUM_API}" \
    -H "Content-Type: application/json" \
    -d "{\"apiToken\": \"${token}\"}" 2>/dev/null || echo "")"
  if echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null | grep -q .; then
    return 0
  fi
  return 1
}

# ── Modes ─────────────────────────────────────────────────────────────────────

case "$MODE" in
  clear)
    security delete-generic-password \
      -s "$KEYCHAIN_SERVICE" \
      -a "$KEYCHAIN_ACCOUNT" 2>/dev/null && ok "Token removed from Keychain" || warn "No token found"
    rm -f "$TOKEN_ENC_FILE"
    ok "Cipherstore entry removed"
    exit 0
    ;;

  verify)
    TOKEN="$(read_token)"
    if [[ -z "$TOKEN" ]]; then
      fail "No IBM Quantum token found in Keychain"
      exit 1
    fi
    info "Validating token with IBM Quantum API..."
    if validate_token "$TOKEN"; then
      ok "Token is valid — IBM Quantum Platform access confirmed"
    else
      fail "Token is invalid or expired"
      exit 1
    fi
    exit 0
    ;;

  show)
    TOKEN="$(read_token)"
    if [[ -z "$TOKEN" ]]; then
      fail "No IBM Quantum token in Keychain"
      exit 1
    fi
    PREFIX="${TOKEN:0:8}"
    SUFFIX="${TOKEN: -4}"
    LEN="${#TOKEN}"
    echo "  IBM Quantum token: ${PREFIX}…${SUFFIX} (${LEN} chars)"
    exit 0
    ;;

  save)
    TOKEN="${IBM_QUANTUM_TOKEN:-}"
    if [[ -z "$TOKEN" ]]; then
      fail "Set IBM_QUANTUM_TOKEN= before using --save"
      exit 1
    fi
    save_token "$TOKEN"
    exit 0
    ;;

  setup)
    # Interactive mode
    echo "Get your API token at: https://quantum.ibm.com/account"
    echo ""
    EXISTING="$(read_token 2>/dev/null || echo "")"
    if [[ -n "$EXISTING" ]]; then
      warn "A token is already stored. Enter new token to replace, or press Enter to keep existing."
    fi

    printf "  IBM Quantum API token: "
    read -rs INPUT
    echo ""

    if [[ -z "$INPUT" && -n "$EXISTING" ]]; then
      TOKEN="$EXISTING"
      info "Keeping existing token"
    elif [[ -n "$INPUT" ]]; then
      TOKEN="$INPUT"
    else
      fail "No token provided and none stored"
      exit 1
    fi

    if [[ "${#TOKEN}" -lt 30 ]]; then
      warn "Token looks short (${#TOKEN} chars) — IBM Quantum tokens are typically 64+ chars"
    fi

    info "Validating token with IBM Quantum API..."
    if validate_token "$TOKEN"; then
      ok "Token validated successfully"
    else
      warn "Token validation failed — saving anyway (API may be temporarily unavailable)"
    fi

    save_token "$TOKEN"

    # Also seal to AARTE cipherstore for Linux builds
    if [[ -f "${CIPHER_DIR}/pat-cipher.sh" ]] || command -v openssl &>/dev/null; then
      mkdir -p "$CIPHER_DIR"
      KEY="$(echo -n "${REPL_ID:-$(hostname)}${HOSTNAME:-host}" | sha256sum | cut -c1-64)"
      echo -n "$TOKEN" | openssl enc -aes-256-cbc -pbkdf2 -iter 310000 \
        -pass "pass:${KEY}" -out "$TOKEN_ENC_FILE" 2>/dev/null && \
        ok "Token also sealed to cipherstore: ${TOKEN_ENC_FILE}" || true
    fi
    ;;
esac

echo ""
echo -e "  ${BOLD}IBM Quantum token configured for AARTE.${RESET}"
echo -e "  Run: bash scripts/quantum-setup.sh --verify"
echo ""
