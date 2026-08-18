# =============================================================================
# © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1
# S1AF — Sentient iOS One-Step App Framework · Sovereign ID: 1
# Makefile — Oracle-AI project automation
# =============================================================================

.PHONY: kimi-xcode generate push run clean status

# ── Primary targets ───────────────────────────────────────────────────────────

## 7-phase master pipeline: detect → verify → tokens → commit → push → build → health
proceed:
	@bash scripts/proceed.sh

## Full bridge: generate → push → ZIP
kimi-xcode:
	@bash scripts/kimi-replit-xcode-bridge.sh

## Generate Xcode project only (no push, no ZIP)
generate:
	@bash scripts/replit-xcode-generate.sh

## Sovereign boot + credential check + git push
run:
	@bash scripts/auto-run.sh

## Push all files to GitHub via Replit integration
push:
	@curl -sf -X POST http://localhost:8080/api/sentient/git-push \
		-H "Content-Type: application/json" -d '{}' | python3 -m json.tool

## Full system status
status:
	@echo "=== Server ===" && curl -sf http://localhost:8080/api/healthz | python3 -m json.tool
	@echo "=== Boot status ===" && curl -sf http://localhost:8080/api/sentient/boot-status | python3 -m json.tool
	@echo "=== Device flow ===" && curl -sf http://localhost:8080/api/auth/github-device/status | python3 -m json.tool

## Clean generated output
clean:
	@rm -rf Oracle-AI-Kimi-Xcode/ build-output/
	@echo "Cleaned."

## Embed authorship in all source files
stamp:
	@node scripts/embed-authorship.mjs

# ── Default ───────────────────────────────────────────────────────────────────
.DEFAULT_GOAL := kimi-xcode
