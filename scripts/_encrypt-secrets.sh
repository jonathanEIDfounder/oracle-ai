#!/usr/bin/env bash

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
# Internal — called once by proceed pipeline to encrypt real secrets.
# Reads MOONSHOT_API_KEY, DEPLOY_SECRET, GITHUB_PAT from environment.
# Outputs KEY=VALUE pairs on stdout for the caller to parse.
set -uo pipefail
cd /home/runner/workspace
source scripts/pat-cipher.sh

_MS="${MOONSHOT_API_KEY:-}"
_DS="${DEPLOY_SECRET:-}"
_GH="${GITHUB_PAT:-}"

echo "MS_LEN=${#_MS}"
echo "DS_LEN=${#_DS}"
echo "GH_LEN=${#_GH}"

[ "${#_MS}" -gt 8 ] && echo "MS_PFX=${_MS:0:8}..." || echo "MS_PFX=too_short"
[ "${#_DS}" -gt 4 ] && echo "DS_PFX=${_DS:0:4}..." || echo "DS_PFX=too_short"
[ "${#_GH}" -gt 6 ] && echo "GH_PFX=${_GH:0:6}..." || echo "GH_PFX=too_short"

# Moonshot
if [ "${#_MS}" -ge 20 ]; then
  _HTTP=$(curl -sf -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${_MS}" \
    https://api.moonshot.cn/v1/models 2>/dev/null || echo "000")
  echo "MS_HTTP=${_HTTP}"
  s1af_encrypt_named "moonshot-key" "${_MS}" && echo "MS_ENC=ok" || echo "MS_ENC=fail"
else
  echo "MS_ENC=skip"
fi

# Deploy secret
if [ "${#_DS}" -ge 16 ]; then
  s1af_encrypt_named "deploy-secret" "${_DS}" && echo "DS_ENC=ok" || echo "DS_ENC=fail"
else
  echo "DS_ENC=skip"
fi

# GitHub PAT
if [ "${#_GH}" -ge 20 ]; then
  _GH_USER=$(curl -sf -H "Authorization: Bearer ${_GH}" \
    https://api.github.com/user 2>/dev/null | \
    python3 -c "import json,sys; print(json.load(sys.stdin).get('login','FAIL'))" 2>/dev/null || echo "FAIL")
  echo "GH_USER=${_GH_USER}"
  if [ "${_GH_USER}" != "FAIL" ] && [ -n "${_GH_USER}" ]; then
    s1af_encrypt_named "github-pat" "${_GH}" && echo "GH_ENC=ok" || echo "GH_ENC=fail"
  else
    echo "GH_ENC=api_rejected"
  fi
else
  echo "GH_ENC=skip"
  echo "GH_USER=n/a"
fi

# Final cipherstore status
echo "---STATUS---"
s1af_token_status_all

unset _MS _DS _GH _GH_USER _HTTP
