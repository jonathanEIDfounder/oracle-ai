#!/bin/bash
# =============================================================
# github-bridge.sh
# Author: Jonathan Sherman
# Copyright: (c) 2026 Jonathan Sherman. All Rights Reserved.
# Framework: S1AF v1.0.0-JS
# Module: GitHub Bridge — Turnkey Push Solution
# Sovereign ID: 1 | Device: b246e1da48a45eb7
# Written by: Jonathan Sherman for Jonathan Sherman
# =============================================================
#
# ONE-COMMAND BRIDGE TO GITHUB
# =============================
#
# Copy this entire block into your Mac Terminal and press Enter.
# It handles auth, remote setup, and push automatically.
#
# =============================================================

set -euo pipefail

REPO="JonathanSherman/Oracle-AI"
BRANCH="main"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  S1AF GitHub Bridge                                          ║"
echo "║  One-Command Push Solution                                   ║"
echo "║  Author: Jonathan Sherman                                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Detect if we're in the repo
cd ~/Documents/Oracle-AI 2>/dev/null || {
    echo "[BRIDGE] Cloning fresh..."
    cd ~/Documents
    git clone https://github.com/JonathanSherman/Oracle-AI.git 2>/dev/null || {
        echo "[BRIDGE] Creating fresh repo..."
        mkdir -p Oracle-AI
        cd Oracle-AI
        git init
    }
}

echo "[BRIDGE] Working in: $(pwd)"

# Step 2: Check for uncommitted changes
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo "[BRIDGE] Staging changes..."
    git add -A
    git commit -m "[S1AF] Jonathan Sherman: Bridge push $(date -u +%Y-%m-%dT%H:%M:%SZ)" || true
fi

# Step 3: Set up remote with fallback auth methods
echo "[BRIDGE] Configuring remote..."

# Try SSH first
if git remote get-url origin 2>/dev/null | grep -q "git@github.com"; then
    echo "[BRIDGE] SSH remote detected"
    git remote set-url origin "git@github.com:${REPO}.git" 2>/dev/null || \
        git remote add origin "git@github.com:${REPO}.git" 2>/dev/null || true
# Try HTTPS with token from keychain
elif command -v security >/dev/null 2>&1 && security find-internet-password -s github.com 2>/dev/null | grep -q "acct"; then
    echo "[BRIDGE] Found GitHub credentials in macOS Keychain"
    TOKEN=$(security find-internet-password -s github.com -w 2>/dev/null || echo "")
    if [ -n "$TOKEN" ]; then
        git remote set-url origin "https://${TOKEN}@github.com/${REPO}.git" 2>/dev/null || \
            git remote add origin "https://${TOKEN}@github.com/${REPO}.git" 2>/dev/null || true
    fi
# Try gh CLI token
elif command -v gh >/dev/null 2>&1 && gh auth token 2>/dev/null | grep -q "ghp_"; then
    echo "[BRIDGE] Found gh CLI token"
    TOKEN=$(gh auth token 2>/dev/null || echo "")
    if [ -n "$TOKEN" ]; then
        git remote set-url origin "https://${TOKEN}@github.com/${REPO}.git" 2>/dev/null || \
            git remote add origin "https://${TOKEN}@github.com/${REPO}.git" 2>/dev/null || true
    fi
# Fallback to plain HTTPS (will prompt for password)
else
    echo "[BRIDGE] Using HTTPS (you may be prompted for credentials)"
    git remote set-url origin "https://github.com/${REPO}.git" 2>/dev/null || \
        git remote add origin "https://github.com/${REPO}.git" 2>/dev/null || true
fi

# Step 4: Configure git identity
git config user.name "Jonathan Sherman" 2>/dev/null || true
git config user.email "jonathan@sentient.dev" 2>/dev/null || true

# Step 5: Push
echo "[BRIDGE] Pushing to GitHub..."
git branch -M "$BRANCH"

if git push -u origin "$BRANCH" --tags 2>/dev/null; then
    echo ""
    echo "✅ BRIDGE SUCCESSFUL"
    echo ""
    echo "Repository: https://github.com/${REPO}"
    echo "Actions:    https://github.com/${REPO}/actions"
    echo "Releases:   https://github.com/${REPO}/releases"
    echo ""
    exit 0
else
    echo ""
    echo "⚠️  Automatic push failed. Manual intervention required."
    echo ""
    echo "Quick fixes:"
    echo ""
    echo "1. Generate a Personal Access Token:"
    echo "   https://github.com/settings/tokens/new"
    echo "   Scopes needed: repo, workflow"
    echo ""
    echo "2. Then run:"
    echo "   git remote set-url origin https://YOUR_TOKEN@github.com/${REPO}.git"
    echo "   git push -u origin ${BRANCH} --tags"
    echo ""
    echo "3. Or use the web upload:"
    echo "   ./github-web-upload.sh"
    echo "   Then drag the ZIP to: https://github.com/${REPO}/upload"
    echo ""
    exit 1
fi
