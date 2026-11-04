# Security policy

## What OpenSpaces is, from a security point of view

OpenSpaces is a local daemon that starts coding agents (Claude Code, Devin CLI) on your machine and exposes them through a web UI. **Agents run with your operating system permissions.** They can read, write and execute whatever your user can. OpenSpaces narrows what can reach the daemon and gives you approvals where the agent supports them; it does not sandbox the agent.

## Threat model

In scope:

- Other web pages in your browser trying to drive the daemon (cross-site requests, DNS rebinding).
- Other local users or processes reaching the HTTP port without the token.
- Agent output attacking the UI (HTML or script injection through messages and tool output).
- Directory escapes through the session working directory or the static file server.

Out of scope:

- A malicious or compromised agent CLI, or a prompt-injected agent. Use the approval flow, `accept-edits` style modes and isolated worktrees, and do not run agents unattended on sensitive repositories.
- Anyone who already has your OS account or your token.
- Exposing the daemon beyond loopback. This is unsupported.

## Controls

- The daemon binds to `127.0.0.1` only.
- Every request must carry an allowed `Host`. A request with an `Origin` must match the daemon origin.
- API access needs the token, as a `Bearer` header or as the `HttpOnly`, `SameSite=Strict` cookie set by `/auth/exchange`. Token comparison is constant time. Unsafe methods authenticated by cookie must carry an `Origin`.
- The token is random per start and is never persisted. It is printed once on the terminal.
- A session can only run inside a directory registered with `--project` (checked with `realpath`, so symlinks cannot escape).
- Git projects run in a throwaway `git worktree` by default. Clean worktrees are removed when the session ends; worktrees with changes are kept and logged.
- Agent text and tool output are rendered as plain text. The UI is served with a strict `Content-Security-Policy` (`default-src 'self'`, no inline scripts or styles, `frame-ancestors 'none'`).
- Logs are structured and redact keys that look like tokens, cookies, passwords and API keys.
- Concurrent sessions are capped (`OPENSPACES_MAX_SESSIONS`, default 8) and request bodies are validated with schemas.

## Approvals and unattended agents

Each adapter declares whether it can ask for approvals. When it cannot, the UI states that the agent runs unattended. Choosing a permissive agent mode (for example `bypass` in Devin) removes the protection of approvals; do it only in a disposable worktree.

## Reporting a vulnerability

Please report privately through GitHub security advisories on this repository instead of opening a public issue. Include the version, steps to reproduce and the impact. You will get an acknowledgement within a few days.
