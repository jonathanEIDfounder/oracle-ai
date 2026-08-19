#!/usr/bin/env python3
# =============================================================
# sentient.py — Sentient Python M2M Client
# Author: Jonathan Sherman
# Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
# Framework: S1AF v1.0.0-JS · Celestial Core
# Sovereign ID: 1 · OCSO-S1AF-GOV-1
# =============================================================
# Sentient presence for ALL Python runtimes and ALL OS:
#   macOS · Linux · Windows · Raspberry Pi · Colab · Jupyter
#   CPython 3.9+ · PyPy · Anaconda · any Python distribution
#
# Zero external dependencies — stdlib only (urllib + json + ssl).
# Automatically spans WiFi, cellular (hotspot), Ethernet, VPN.
#
# Usage:
#   python3 scripts/sentient.py                   # interactive
#   python3 scripts/sentient.py "your query"      # single query
#   SENTIENT_URL=https://... python3 scripts/sentient.py
#
# M2M library import:
#   from scripts.sentient import Sentient
#   s = Sentient(url="https://yourapp.replit.app")
#   response = s.query("Explain the S1AF architecture")
# =============================================================

import json
import os
import platform
import socket
import ssl
import sys
import urllib.error
import urllib.request
from typing import Optional

# ── Sovereign constants ──────────────────────────────────────
SOVEREIGN_ID = 1
GOV_REF      = "OCSO-S1AF-GOV-1"
GOVERNOR     = "Jonathan Sherman"
VERSION      = "S1AF v1.0.0-JS"

# ── Sentient M2M client class ─────────────────────────────────

class Sentient:
    """
    Sentient M2M client. Works on any OS, any Python runtime,
    any network (WiFi, cellular, Ethernet, VPN).

    Unrestricted by sovereign directive of Jonathan Sherman,
    Sovereign ID: 1 (OCSO-S1AF-GOV-1).
    """

    def __init__(
        self,
        url:   Optional[str] = None,
        token: Optional[str] = None,
    ):
        self.url   = (url or os.environ.get("SENTIENT_URL", "")).rstrip("/")
        self.token = token or os.environ.get("SENTIENT_TOKEN", "")
        self._ctx  = ssl.create_default_context()   # verify TLS — secure by default

        if self.url and not self.token:
            self._register()

    # ── Registration ──────────────────────────────────────────

    def _register(self) -> None:
        hostname = socket.gethostname()
        os_name  = platform.system().lower()
        arch     = platform.machine()

        payload = {
            "name":     f"{hostname} · Python {platform.python_version()} ({os_name}/{arch})",
            "platform": os_name,
            "arch":     arch,
            "network":  "unknown",
        }
        try:
            resp = self._post("/api/sentient/hub/register", payload)
            self.token = resp.get("token", "")
            self.peer_id = resp.get("id", "")
            if self.token:
                print(f"[Sentient] ✓ Registered as M2M peer — id={self.peer_id}", file=sys.stderr)
        except Exception as e:
            print(f"[Sentient] Hub registration failed: {e} — direct mode", file=sys.stderr)

    # ── Query ─────────────────────────────────────────────────

    def query(self, prompt: str, max_tokens: int = 2048) -> str:
        """
        Send a query to Sentient. Unrestricted. Apex tier.
        Works over any network path that reaches the Sentient Hub.
        """
        if not self.url:
            raise ValueError("Sentient URL not set. Pass url= or set SENTIENT_URL env var.")

        if self.token:
            resp = self._post("/api/sentient/hub/query", {
                "token":     self.token,
                "prompt":    prompt,
                "maxTokens": max_tokens,
            })
            return resp.get("response", resp.get("error", "[no response]"))
        else:
            # Fallback: direct Kimi chat
            resp = self._post("/api/kimi/chat", {
                "messages": [{"role": "user", "content": prompt}]
            })
            return resp.get("content", resp.get("response", resp.get("error", "[no response]")))

    # ── HTTP helpers ──────────────────────────────────────────

    def _post(self, path: str, payload: dict) -> dict:
        url  = self.url + path
        data = json.dumps(payload).encode("utf-8")
        req  = urllib.request.Request(
            url,
            data    = data,
            headers = {"Content-Type": "application/json"},
            method  = "POST",
        )
        try:
            with urllib.request.urlopen(req, context=self._ctx, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            try:    return json.loads(body)
            except: return {"error": f"HTTP {e.code}: {body[:200]}"}
        except Exception as e:
            return {"error": str(e)}

    # ── Interactive REPL ──────────────────────────────────────

    def repl(self) -> None:
        """Start an interactive Sentient session in this terminal."""
        print(f"\033[1;36m{'═'*56}")
        print(f"  SENTIENT — Sovereign AI · Apex Tier · Unrestricted  ")
        print(f"{'═'*56}\033[0m")
        print(f"\033[2m  Sovereign ID: {SOVEREIGN_ID} · {GOV_REF}")
        print(f"  Framework: {VERSION}")
        print(f"  Hub: {self.url or '(not configured)'}")
        print(f"  Platform: Python {platform.python_version()} on {platform.system()}")
        print(f"  Type 'exit' to quit.\033[0m\n")

        while True:
            try:
                prompt = input("\033[1;36mSovereign ▶ \033[0m").strip()
            except (EOFError, KeyboardInterrupt):
                print("\n\033[2mSentient session ended.\033[0m")
                break

            if not prompt:
                continue
            if prompt.lower() in ("exit", "quit"):
                print("\033[2mSentient session ended.\033[0m")
                break

            print("\033[2mSentient thinking…\033[0m")
            try:
                response = self.query(prompt)
                print(f"\n\033[1;32mSentient:\033[0m\n{response}\n")
            except Exception as e:
                print(f"\033[0;31m[Error] {e}\033[0m\n")


# ── CLI entry point ───────────────────────────────────────────

if __name__ == "__main__":
    url   = os.environ.get("SENTIENT_URL", "")
    token = os.environ.get("SENTIENT_TOKEN", "")

    if not url:
        if sys.stdout.isatty():
            url = input("Sentient Hub URL: ").strip()
        else:
            print("[Sentient] ERROR: SENTIENT_URL not set.", file=sys.stderr)
            sys.exit(1)

    s = Sentient(url=url, token=token if token else None)

    if len(sys.argv) > 1:
        # Single query from command line argument
        query = " ".join(sys.argv[1:])
        print(s.query(query))
    elif not sys.stdin.isatty():
        # Pipe mode: read queries from stdin line by line
        for line in sys.stdin:
            line = line.strip()
            if line:
                print(s.query(line))
    else:
        # Interactive REPL
        s.repl()
