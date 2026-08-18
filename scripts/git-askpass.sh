#!/usr/bin/env bash
# =============================================================================
# S1AF — Git Askpass Helper — OCSO-S1AF-GOV-1
# Called by git when it needs the HTTPS password for oracle-ai remotes.
#
# Security model:
#   • Raw PAT is NEVER stored in this file — only a placeholder comment.
#   • At runtime, decrypts from ~/.s1af-pat.enc using machine-derived key.
#   • Falls back to $GITHUB_PAT env var if cipherstore is absent.
#   • Output goes directly to git's stdin — never to a log or terminal.
# =============================================================================

readonly _S1AF_AUTHOR="© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"
# ── Cipher library ────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/pat-cipher.sh
source "${SCRIPT_DIR}/pat-cipher.sh" 2>/dev/null || \
  source "${HOME}/.s1af-scripts/pat-cipher.sh" 2>/dev/null || true

# ── Emit password to git (stdout only, no newline logging) ───────────────
# Placeholder: [OBFUSCATED — decrypted at runtime from ~/.s1af-pat.enc]
PAT="$(s1af_pat_load 2>/dev/null)"

if [[ -z "$PAT" ]]; then
  # Last resort — env var (catches container restarts before cipher is seeded)
  PAT="${GITHUB_PAT:-}"
fi

printf '%s\n' "$PAT"
