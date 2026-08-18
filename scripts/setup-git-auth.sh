#!/usr/bin/env bash
# ================================================================
# S1AF — Git Auth Setup — OCSO-S1AF-GOV-1
# © 2026 Jonathan Sherman — All rights reserved.
#
# Makes the GITHUB_PAT secret permanent for git operations by:
#   1. Installing a credential askpass helper from scripts/
#   2. Pointing git's core.askPass at it globally
#   3. Setting oracle-ai + origin remotes to credential-free URLs
#
# Run once per container (idempotent):
#   bash scripts/setup-git-auth.sh
#
# Also runs automatically at API server startup via the predev hook.
# ================================================================
set -uo pipefail

readonly _S1AF_AUTHOR="© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
ASKPASS_SRC="${REPO_ROOT}/scripts/git-askpass.sh"
ASKPASS_DEST="${HOME}/.s1af-git-askpass.sh"

# ── 1. Install the askpass helper ────────────────────────────────
cp "${ASKPASS_SRC}" "${ASKPASS_DEST}"
chmod +x "${ASKPASS_DEST}"

# ── 2. Configure git globally ────────────────────────────────────
git config --global core.askPass   "${ASKPASS_DEST}"
git config --global credential.helper ""

# ── 3. Ensure remotes are credential-free ────────────────────────
GITHUB_REMOTE="https://jonathanEIDfounder@github.com/jonathanEIDfounder/oracle-ai.git"

cd "${REPO_ROOT}"

if git remote get-url oracle-ai &>/dev/null; then
  git remote set-url oracle-ai "${GITHUB_REMOTE}"
fi

if git remote get-url origin &>/dev/null; then
  git remote set-url origin "${GITHUB_REMOTE}"
else
  git remote add origin "${GITHUB_REMOTE}"
fi

# ── 4. Report ────────────────────────────────────────────────────
echo "✓  git askpass locked → ${ASKPASS_DEST}"
echo "✓  core.askPass reads \$GITHUB_PAT from environment"
echo "✓  oracle-ai → ${GITHUB_REMOTE}"
echo "✓  origin    → ${GITHUB_REMOTE}"

# ── 5. Validate PAT format (warn only — never block) ─────────────
PAT="${GITHUB_PAT:-}"
if [ -z "$PAT" ]; then
  echo "⚠  GITHUB_PAT is not set — push will fail until rotated"
elif [[ "$PAT" =~ ^(ghp_|github_pat_) ]] && [ "${#PAT}" -ge 40 ]; then
  echo "✓  GITHUB_PAT format valid (${#PAT} chars, ${PAT:0:4}…)"
else
  echo "⚠  GITHUB_PAT format invalid (${#PAT} chars) — rotate at /rotate"
fi
