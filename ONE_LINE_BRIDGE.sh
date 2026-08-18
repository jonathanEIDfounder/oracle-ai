#!/bin/bash
# =============================================================
# ONE-LINE BRIDGE
# Author: Jonathan Sherman
# Copy and paste this entire block into your Mac Terminal:
# =============================================================

cd ~/Documents && git clone https://github.com/JonathanSherman/Oracle-AI.git 2>/dev/null; cd Oracle-AI && git remote add origin https://github.com/JonathanSherman/Oracle-AI.git 2>/dev/null; git branch -M main && git add -A && git commit -m "[S1AF] Jonathan Sherman: Bridge push $(date -u +%Y-%m-%dT%H:%M:%SZ)" 2>/dev/null && git push -u origin main --tags
