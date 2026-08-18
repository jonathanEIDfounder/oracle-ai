#!/bin/bash

# =============================================================================
# © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1
# S1AF — Sentient iOS One-Step App Framework · Sovereign ID: 1
# Author      : Jonathan Sherman (jonathanEIDfounder)
# Governance  : OCSO-S1AF-GOV-1
# Copyright   : © 2026 Jonathan Sherman. All rights reserved.
# License     : PROPRIETARY — No license granted without express written permission.
# DRM         : S1AF-DRM-LOCKED
# Notice      : Unauthorized use, reproduction, modification, distribution, or
#               sublicensing is strictly prohibited. Removal of this authorship
#               notice violates applicable copyright law.
# =============================================================================

readonly _S1AF_AUTHOR="© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED"
set -e
pnpm install --frozen-lockfile
pnpm --filter db push
