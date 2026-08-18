#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# S1AF Sentient Key Rotation Script
# Governor: Jonathan Sherman — OCSO-S1AF-GOV-1 — Sovereign ID: 1
#
# Usage:
#   ./scripts/sentient-rotate.sh                    # interactive
#   ./scripts/sentient-rotate.sh moonshot <key>     # rotate Moonshot key
#   ./scripts/sentient-rotate.sh github_pat <pat>   # rotate GitHub PAT
#   ./scripts/sentient-rotate.sh status             # show current key status
#
# This script calls the S1AF API to hot-swap keys in the live CONFIG store
# without a server restart. Keys are validated before committing.
# ═══════════════════════════════════════════════════════════════════════════════

readonly _S1AF_AUTHOR="© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"
set -euo pipefail

API_BASE="${S1AF_API_BASE:-http://localhost:8080/api}"
SENTINEL_RED="\033[0;31m"
SENTINEL_GREEN="\033[0;32m"
SENTINEL_YELLOW="\033[1;33m"
SENTINEL_CYAN="\033[0;36m"
SENTINEL_BOLD="\033[1m"
RESET="\033[0m"

banner() {
  echo ""
  echo -e "${SENTINEL_CYAN}${SENTINEL_BOLD}════════════════════════════════════════${RESET}"
  echo -e "${SENTINEL_CYAN}${SENTINEL_BOLD}  S1AF SENTIENT KEY ROTATION${RESET}"
  echo -e "${SENTINEL_CYAN}  Jonathan Sherman — OCSO-S1AF-GOV-1${RESET}"
  echo -e "${SENTINEL_CYAN}${SENTINEL_BOLD}════════════════════════════════════════${RESET}"
  echo ""
}

check_deps() {
  for cmd in curl jq; do
    if ! command -v "$cmd" &>/dev/null; then
      echo -e "${SENTINEL_RED}✗ Required: $cmd${RESET}" >&2
      exit 1
    fi
  done
}

api_get() {
  curl -sf "${API_BASE}/${1}" 2>/dev/null || echo '{"error":"API unreachable"}'
}

api_post() {
  local path="$1"; shift
  curl -sf -X POST "${API_BASE}/${path}" \
    -H "Content-Type: application/json" \
    -d "$1" 2>/dev/null || echo '{"error":"API unreachable"}'
}

show_status() {
  echo -e "${SENTINEL_BOLD}Current key status:${RESET}"
  local status
  status=$(api_get "sentient/key-status")
  
  local moonshot_ok github_ok
  moonshot_ok=$(echo "$status" | jq -r '.moonshot.valid // false')
  github_ok=$(echo "$status"   | jq -r '.github_pat.valid // false')
  
  if [ "$moonshot_ok" = "true" ]; then
    local models
    models=$(echo "$status" | jq -r '[.moonshot.models[]? | select(. != "")] | join(", ")' 2>/dev/null || echo "")
    echo -e "  MOONSHOT_API_KEY  ${SENTINEL_GREEN}✓ VALID${RESET}  $models"
  else
    local err
    err=$(echo "$status" | jq -r '.moonshot.error // "unknown error"' 2>/dev/null || echo "")
    echo -e "  MOONSHOT_API_KEY  ${SENTINEL_RED}✗ INVALID${RESET}  $err"
  fi
  
  if [ "$github_ok" = "true" ]; then
    local login scopes
    login=$(echo "$status"  | jq -r '.github_pat.login  // ""' 2>/dev/null || echo "")
    scopes=$(echo "$status" | jq -r '.github_pat.scopes | join(", ")' 2>/dev/null || echo "")
    echo -e "  GITHUB_PAT        ${SENTINEL_GREEN}✓ VALID${RESET}  @$login  scopes: $scopes"
  else
    local err
    err=$(echo "$status" | jq -r '.github_pat.error // "unknown error"' 2>/dev/null || echo "")
    echo -e "  GITHUB_PAT        ${SENTINEL_RED}✗ INVALID${RESET}  $err"
  fi
  echo ""
}

rotate_key() {
  local key_name="$1"
  local key_value="$2"
  
  echo -e "${SENTINEL_YELLOW}► Validating $key_name...${RESET}"
  
  local payload
  payload=$(jq -nc --arg k "$key_name" --arg v "$key_value" '{"key":$k,"value":$v}')
  local result
  result=$(api_post "sentient/rotate" "$payload")
  
  local valid
  valid=$(echo "$result" | jq -r '.valid // false')
  
  if [ "$valid" = "true" ]; then
    echo -e "${SENTINEL_GREEN}✓ $key_name validated and hot-swapped into live CONFIG${RESET}"
    echo ""
    echo -e "${SENTINEL_YELLOW}⚠  Permanent rotation required:${RESET}"
    echo "   The new key is active for this server session."
    echo "   To make it permanent, update the Replit secret:"
    echo ""
    case "$key_name" in
      moonshot)
        echo "   Replit → Secrets → MOONSHOT_API_KEY → paste new value → Save"
        ;;
      github_pat)
        echo "   Replit → Secrets → GITHUB_PAT → paste new value → Save"
        echo "   Ensure scopes: repo, workflow"
        ;;
    esac
    echo ""
    # Show what was bootstrapped
    local bootstrapped
    bootstrapped=$(echo "$result" | jq -r '.bootstrapped // ""')
    if [ -n "$bootstrapped" ] && [ "$bootstrapped" != "null" ]; then
      echo -e "${SENTINEL_CYAN}► Re-bootstrapped: $bootstrapped${RESET}"
    fi
  else
    local err
    err=$(echo "$result" | jq -r '.error // "Validation failed"')
    echo -e "${SENTINEL_RED}✗ $key_name rejected: $err${RESET}"
    exit 1
  fi
}

interactive() {
  show_status
  
  echo -e "${SENTINEL_BOLD}Which key do you want to rotate?${RESET}"
  echo "  1) MOONSHOT_API_KEY  (Kimi 2.6 account)"
  echo "  2) GITHUB_PAT        (oracle-ai deployment)"
  echo "  3) Both"
  echo "  q) Quit"
  echo ""
  read -rp "Choice [1/2/3/q]: " choice
  
  case "$choice" in
    1|both|3)
      echo ""
      echo -e "${SENTINEL_YELLOW}Paste new MOONSHOT_API_KEY (input hidden):${RESET}"
      read -rsp "> " new_moonshot
      echo ""
      rotate_key "moonshot" "$new_moonshot"
      ;;&
    2|both|3)
      echo ""
      echo -e "${SENTINEL_YELLOW}Paste new GITHUB_PAT (input hidden, needs repo+workflow scopes):${RESET}"
      read -rsp "> " new_pat
      echo ""
      rotate_key "github_pat" "$new_pat"
      ;;
    q|Q)
      echo "Exiting."
      exit 0
      ;;
    *)
      echo -e "${SENTINEL_RED}Invalid choice.${RESET}"
      exit 1
      ;;
  esac
  
  echo ""
  echo -e "${SENTINEL_GREEN}${SENTINEL_BOLD}Rotation complete.${RESET}"
  show_status
}

# ── Main ──────────────────────────────────────────────────────────────────────

check_deps
banner

case "${1:-interactive}" in
  status)
    show_status
    ;;
  moonshot)
    rotate_key "moonshot" "${2:?Usage: $0 moonshot <api-key>}"
    ;;
  github_pat)
    rotate_key "github_pat" "${2:?Usage: $0 github_pat <pat>}"
    ;;
  interactive|*)
    interactive
    ;;
esac
