---
name: GitHub Connector Octokit Pattern
description: conn.getClient() returns a live Octokit instance; proxyFetch is a method on conn, not a global. Both are CodeExecution-sandbox-only.
---

# GitHub Connector — Octokit Push Pattern

## The Rule
`listConnections`, `conn.getClient()`, and `conn.proxyFetch()` are available **only inside `"use impure"` functions** in the CodeExecution sandbox. They are NOT available in:
- Regular Node.js processes (server, scripts)
- Shell scripts
- Durable (top-level) CodeExecution scope

## How to Call
```javascript
const result = await (async (connectorName) => {
  "use impure";
  const conns = await listConnections(connectorName);
  const conn  = conns[0];
  const octo  = await conn.getClient();          // Octokit instance (hasClient: true for GitHub)
  const res   = await conn.proxyFetch('/repos/owner/repo/contents/path', { method: 'PUT', ... });
  return res.status;
})("github");
```

## Common Mistake
Calling `proxyFetch(...)` as a **global function** → `ReferenceError: proxyFetch is not defined`.
It is a **method on the connection object**: `conn.proxyFetch(path, init?)`.

## GitHub Connector Details
- Connection ID: `conn_github_01KA362WTY0G2Q4XBNC7KMRB8D`
- Status: healthy, authenticated as `jonathanEIDfounder`
- `hasClient: true` → `conn.getClient()` returns a full **Octokit** instance
- Octokit has `octo.rest.git.*`, `octo.rest.repos.*`, etc.
- `conn.proxyFetch(path)` base URL: `https://api.github.com`

## Proven Push Pattern (77 files pushed, 0 errors)
1. Get current remote SHA via `conn.proxyFetch('/repos/{owner}/{repo}/contents/{path}?ref=main')`
2. Update via `PUT /repos/{owner}/{repo}/contents/{path}` with `{ message, content (b64), branch, sha }`

## Why Server Cannot Use This
The Replit connector proxy (`connectors.replit.com`) requires Replit platform auth that is only
injected into the CodeExecution sandbox runtime. The REPLIT_DB_URL JWT does NOT work for connector calls.
Tasks #70 and #72 cover the implementation path for server-side connector access.

## Reusable Module
`scripts/connector-push.mjs` — export `pushFiles({ files, listConnections })` for CodeExecution calls.
