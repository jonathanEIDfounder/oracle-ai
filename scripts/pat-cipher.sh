#!/usr/bin/env bash
# =============================================================================
# S1AF — Multi-Token Cipher Library
# OCSO-S1AF-GOV-1 · Jonathan Sherman
#
# Source this file to get named encrypt/decrypt for any S1AF token.
#
# Cipher:   AES-256-CBC + PBKDF2 (openssl enc)
# Key:      REPL_ID + hostname  (never stored — environment-derived only)
# At rest:  ~/.s1af-<name>.enc  (base64 ciphertext, no plaintext)
#
# Named tokens supported:
#   github-pat     → $GITHUB_PAT
#   moonshot-key   → $MOONSHOT_API_KEY
#   deploy-secret  → $DEPLOY_SECRET
#
# Functions:
#   s1af_encrypt_named <name> <value>   — write ciphertext for named key
#   s1af_decrypt_named <name>           — print plaintext for named key
#   s1af_token_status <name>            — print human-readable status
#   s1af_token_status_all               — status for all known tokens
#   s1af_pat_load                       — legacy: load github-pat (compat)
#   s1af_encrypt / s1af_decrypt         — legacy: github-pat only (compat)
#   s1af_cipher_status                  — legacy: github-pat status (compat)
# =============================================================================

readonly _S1AF_AUTHOR="© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"
S1AF_CIPHER_DIR="${HOME}/.s1af-cipher"
mkdir -p "$S1AF_CIPHER_DIR"
chmod 700 "$S1AF_CIPHER_DIR"

# Known token names and their env var mappings
declare -A S1AF_TOKEN_ENV=(
  ["github-pat"]="GITHUB_PAT"
  ["moonshot-key"]="MOONSHOT_API_KEY"
  ["deploy-secret"]="DEPLOY_SECRET"
)

# ── Derive passphrase from machine identity (never stored) ─────────────────
_s1af_passphrase() {
  local seed="${REPL_ID:-fallback-repl}:${HOSTNAME:-localhost}:S1AF-GOV-1"
  printf '%s' "$seed" | sha256sum | awk '{print $1}'
}

_s1af_enc_file()  { echo "${S1AF_CIPHER_DIR}/${1}.enc"; }
_s1af_meta_file() { echo "${S1AF_CIPHER_DIR}/${1}.meta"; }

# ── Encrypt named token ────────────────────────────────────────────────────
# Usage: s1af_encrypt_named <name> <raw-value>
s1af_encrypt_named() {
  local name="$1"
  local raw="$2"
  local enc_file meta_file pass cipher

  [[ -z "$name" ]] && { echo "s1af_encrypt_named: name required" >&2; return 1; }
  [[ -z "$raw"  ]] && { echo "s1af_encrypt_named: empty value for '${name}'" >&2; return 1; }

  enc_file=$(_s1af_enc_file  "$name")
  meta_file=$(_s1af_meta_file "$name")
  pass=$(_s1af_passphrase)

  cipher=$(printf '%s' "$raw" | \
    openssl enc -aes-256-cbc -pbkdf2 -iter 100000 \
      -pass "pass:${pass}" -a 2>/dev/null) \
    || { echo "s1af_encrypt_named: openssl failed for '${name}'" >&2; return 1; }

  printf '%s\n' "$cipher" > "$enc_file"
  chmod 600 "$enc_file"

  # Non-secret meta: length + masked prefix + timestamp
  printf 'name=%s\nlen=%d\nprefix=%s\nts=%s\n' \
    "$name" "${#raw}" "${raw:0:6}…" "$(date -u +%s)" > "$meta_file"
  chmod 600 "$meta_file"
  return 0
}

# ── Decrypt named token → stdout ───────────────────────────────────────────
# Usage: s1af_decrypt_named <name>
s1af_decrypt_named() {
  local name="$1"
  local enc_file pass

  [[ -z "$name" ]] && { echo "s1af_decrypt_named: name required" >&2; return 1; }
  enc_file=$(_s1af_enc_file "$name")

  [[ ! -f "$enc_file" ]] && {
    echo "s1af_decrypt_named: no ciphertext for '${name}'" >&2; return 1
  }
  pass=$(_s1af_passphrase)

  openssl enc -aes-256-cbc -pbkdf2 -iter 100000 \
    -d -pass "pass:${pass}" -a \
    -in "$enc_file" 2>/dev/null \
    || { echo "s1af_decrypt_named: decryption failed for '${name}'" >&2; return 1; }
}

# ── Load named token: env var preferred, cipherstore fallback ─────────────
# Usage: s1af_load_named <name>
# Prints raw value to stdout. Caller must keep in a local var.
s1af_load_named() {
  local name="$1"
  local env_var env_val

  env_var="${S1AF_TOKEN_ENV[$name]:-}"
  [[ -z "$env_var" ]] && { echo "s1af_load_named: unknown token '${name}'" >&2; return 1; }

  env_val="${!env_var:-}"

  if [[ "${#env_val}" -ge 20 ]]; then
    printf '%s' "$env_val"
    return 0
  fi

  # Env invalid — try cipherstore
  s1af_decrypt_named "$name" 2>/dev/null
}

# ── Token status ───────────────────────────────────────────────────────────
s1af_token_status() {
  local name="$1"
  local enc_file meta_file

  enc_file=$(_s1af_enc_file  "$name")
  meta_file=$(_s1af_meta_file "$name")

  echo "  [$name]"
  if [[ -f "$enc_file" ]]; then
    echo "    at-rest : encrypted (AES-256-CBC PBKDF2) → ${enc_file}"
    [[ -f "$meta_file" ]] && grep -E '^(len|prefix|ts)=' "$meta_file" | sed 's/^/    /'
    if s1af_decrypt_named "$name" &>/dev/null; then
      echo "    decrypt : PASS"
    else
      echo "    decrypt : FAIL"
    fi
  else
    echo "    at-rest : NOT STORED"
  fi
  echo "    key-src : REPL_ID + HOSTNAME (never stored)"
}

s1af_token_status_all() {
  for name in "github-pat" "moonshot-key" "deploy-secret"; do
    s1af_token_status "$name"
  done
}

# ── Legacy compat (github-pat only) ───────────────────────────────────────
s1af_encrypt()      { s1af_encrypt_named "github-pat" "$1"; }
s1af_decrypt()      { s1af_decrypt_named "github-pat"; }
s1af_pat_load()     { s1af_load_named    "github-pat"; }
s1af_cipher_status(){ s1af_token_status  "github-pat"; }
