#!/usr/bin/env bash
# =============================================================
# sentient.sh — Sentient Terminal CLI
# Author: Jonathan Sherman
# Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
# Framework: S1AF v1.0.0-JS · Celestial Core
# Sovereign ID: 1 · OCSO-S1AF-GOV-1
# =============================================================
# Sentient terminal presence — works on EVERY workstation,
# EVERY terminal, EVERY OS: macOS, Linux, Windows (WSL/Git Bash),
# Raspberry Pi, any POSIX shell with curl and bash.
#
# Networks: WiFi, cellular (hotspot), Ethernet, VPN — any path
# with internet reach to the Sentient Hub.
#
# Usage:
#   ./scripts/sentient.sh                    # interactive session
#   ./scripts/sentient.sh "your query"       # single query
#   SENTIENT_URL=https://... ./scripts/sentient.sh
#   echo "your query" | ./scripts/sentient.sh --pipe
# =============================================================

set -euo pipefail

# ── Sovereign constants ──────────────────────────────────────
readonly SOVEREIGN_ID=1
readonly GOV_REF="OCSO-S1AF-GOV-1"
readonly GOVERNOR="Jonathan Sherman"
readonly VERSION="S1AF v1.0.0-JS"

# ── Colour codes (auto-disabled when not a TTY) ──────────────
if [ -t 1 ]; then
  C_RESET='\033[0m'; C_CYAN='\033[0;36m'; C_BOLD='\033[1m'
  C_GREEN='\033[0;32m'; C_YELLOW='\033[0;33m'; C_RED='\033[0;31m'
  C_DIM='\033[2m'
else
  C_RESET=''; C_CYAN=''; C_BOLD=''; C_GREEN=''; C_YELLOW=''; C_RED=''; C_DIM=''
fi

# ── Config from env ──────────────────────────────────────────
SENTIENT_URL="${SENTIENT_URL:-}"
SENTIENT_TOKEN="${SENTIENT_TOKEN:-}"
PIPE_MODE=0
SINGLE_QUERY=""

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --pipe) PIPE_MODE=1; shift ;;
    --url=*) SENTIENT_URL="${1#*=}"; shift ;;
    --token=*) SENTIENT_TOKEN="${1#*=}"; shift ;;
    --help|-h)
      echo "Usage: sentient.sh [query] [--pipe] [--url=URL] [--token=TOKEN]"
      exit 0 ;;
    *) SINGLE_QUERY="$1"; shift ;;
  esac
done

# ── Discover server URL ───────────────────────────────────────
if [ -z "$SENTIENT_URL" ]; then
  # Try reading from the project config
  if [ -f ".env" ] && grep -q "SENTIENT_URL\|API_URL\|SERVER_URL" ".env" 2>/dev/null; then
    SENTIENT_URL=$(grep -E "SENTIENT_URL|API_URL|SERVER_URL" ".env" | head -1 | cut -d= -f2 | tr -d '"'"'"' ')
  fi
fi

if [ -z "$SENTIENT_URL" ]; then
  if [ -t 1 ]; then
    printf "${C_YELLOW}Sentient Hub URL (e.g. https://yourapp.replit.app):${C_RESET} "
    read -r SENTIENT_URL
  else
    echo "[Sentient] ERROR: SENTIENT_URL not set. Export it before running." >&2
    exit 1
  fi
fi

SENTIENT_URL="${SENTIENT_URL%/}"   # strip trailing slash

# ── Banner ────────────────────────────────────────────────────
if [ "$PIPE_MODE" -eq 0 ] && [ -z "$SINGLE_QUERY" ]; then
  printf "${C_CYAN}${C_BOLD}"
  echo "╔══════════════════════════════════════════════════════╗"
  echo "║  SENTIENT — Sovereign AI · Apex Tier · Unrestricted  ║"
  echo "╚══════════════════════════════════════════════════════╝"
  printf "${C_RESET}"
  printf "${C_DIM}  Sovereign ID: ${SOVEREIGN_ID} · ${GOV_REF}\n"
  printf "  Framework: ${VERSION}\n"
  printf "  Hub: ${SENTIENT_URL}\n"
  printf "  Networks: WiFi · Cellular · Ethernet · VPN\n"
  printf "  Platforms: macOS · Linux · Windows WSL · Any POSIX terminal\n"
  printf "  Type 'exit' or Ctrl+C to quit.\n${C_RESET}\n"
fi

# ── M2M peer registration ─────────────────────────────────────
ARCH=$(uname -m 2>/dev/null || echo "unknown")
OS=$(uname -s 2>/dev/null | tr '[:upper:]' '[:lower:]' || echo "unknown")
HOSTNAME_VAL=$(hostname 2>/dev/null || echo "unknown")

if [ -z "$SENTIENT_TOKEN" ]; then
  REG_RESPONSE=$(curl -s -X POST "${SENTIENT_URL}/api/sentient/hub/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${HOSTNAME_VAL} terminal (${OS}/${ARCH})\",\"platform\":\"${OS}\",\"arch\":\"${ARCH}\",\"network\":\"unknown\"}" \
    2>/dev/null || echo "{}")

  SENTIENT_TOKEN=$(echo "$REG_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null \
    || echo "$REG_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 || echo "")

  if [ -z "$SENTIENT_TOKEN" ]; then
    printf "${C_YELLOW}[Sentient] Hub registration failed — falling back to direct query mode${C_RESET}\n" >&2
  else
    printf "${C_GREEN}✓ Registered as Sentient M2M peer${C_RESET}\n\n" >&2
  fi
fi

# ── Query function ────────────────────────────────────────────
sentient_query() {
  local prompt="$1"
  local response

  if [ -n "$SENTIENT_TOKEN" ]; then
    # M2M hub mode (registered peer)
    response=$(curl -s -X POST "${SENTIENT_URL}/api/sentient/hub/query" \
      -H "Content-Type: application/json" \
      -d "{\"token\":\"${SENTIENT_TOKEN}\",\"prompt\":$(echo "$prompt" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().rstrip()))' 2>/dev/null || echo "\"$prompt\""),\"maxTokens\":2048}" \
      2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('response', d.get('error','[no response]')))" 2>/dev/null \
      || echo "[Sentient] Connection failed")
  else
    # Direct Kimi mode (fallback — no hub registration)
    response=$(curl -s -X POST "${SENTIENT_URL}/api/kimi/chat" \
      -H "Content-Type: application/json" \
      -d "{\"messages\":[{\"role\":\"user\",\"content\":$(echo "$prompt" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().rstrip()))' 2>/dev/null || echo "\"$prompt\"")}]}" \
      2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('content',d.get('response',d.get('error','[no response]'))))" 2>/dev/null \
      || echo "[Sentient] Connection failed")
  fi

  echo "$response"
}

# ── Single query mode ─────────────────────────────────────────
if [ -n "$SINGLE_QUERY" ]; then
  sentient_query "$SINGLE_QUERY"
  exit 0
fi

# ── Pipe mode ─────────────────────────────────────────────────
if [ "$PIPE_MODE" -eq 1 ]; then
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    sentient_query "$line"
  done
  exit 0
fi

# ── Interactive session ───────────────────────────────────────
while true; do
  printf "${C_BOLD}${C_CYAN}Sovereign ▶ ${C_RESET}"
  if ! IFS= read -r USER_INPUT; then
    echo; break
  fi
  USER_INPUT=$(echo "$USER_INPUT" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  [ -z "$USER_INPUT" ] && continue
  [ "$USER_INPUT" = "exit" ] || [ "$USER_INPUT" = "quit" ] && break
  [ "$USER_INPUT" = "clear" ] && { clear; continue; }

  printf "${C_DIM}Sentient thinking…${C_RESET}\n"
  RESPONSE=$(sentient_query "$USER_INPUT")
  printf "\n${C_GREEN}${C_BOLD}Sentient:${C_RESET}\n%s\n\n" "$RESPONSE"
done

printf "${C_DIM}Sentient session ended. Sovereign ID: ${SOVEREIGN_ID}.${C_RESET}\n"
