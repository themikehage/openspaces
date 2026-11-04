# ADR 0001: Integrate Devin CLI through ACP

Status: accepted (partially verified). Date: 2026-11-04.

## Context

Devin CLI `3000.11.234` was installed (`npm install -g devin`) and probed without logging in. `devin -p` is single-turn plain text and offers no structured transport.

## Verified

- `devin acp` runs an Agent Client Protocol server over stdio (newline-delimited JSON-RPC 2.0).
- `initialize` (protocol version 1) succeeds without credentials and reports: `loadSession: true` (resume), image prompts, embedded context, MCP over http and sse, session `list`, `delete` and `close`.
- `session/new` succeeds without credentials and returns a `sessionId` (human-readable, for example `wonderful-earth`), the available modes (`accept-edits`, `smart`, `ask`, `plan`, `bypass`) and config options.
- The agent advertises auth method `devin-browser`. Credentials are stored in `~/.local/share/devin/credentials.toml`; `devin auth status` and `devin auth login` manage them.
- Vendor extensions live under `cognition.ai/*` in `_meta` and `_cognition.ai/*` methods. The adapter must ignore unknown ones.
- Recorded fixture: `fixtures/devin/3000.11.234-initialize-session-new.jsonl`.

## Not yet verified (needs a logged-in account)

- `session/prompt` streaming: `session/update` kinds actually emitted (message chunks, thoughts, tool calls).
- Approvals: whether a tool call that needs permission arrives as an ACP `session/request_permission` request in `accept-edits` and `smart` modes.
- `session/cancel` behaviour for interrupts and `session/load` for resume.
- License terms of the CLI.

## Decision

Build `adapter-acp` as the generic implementation and make `adapter-devin` a thin manifest: binary and args, supported version range, auth probe through `devin auth status`, default mode, and capability overrides. Mapping from ACP to OpenSpaces events lives only in `adapter-acp`.

## Consequences

- `probe()` must report `available: true` but flag a missing login so the UI can tell the user to run `devin auth login`.
- Permission mode is a session option. The default stays `accept-edits`; `bypass` must be an explicit opt-in that marks the session `unattended`.
- If approvals do not arrive through `session/request_permission`, Devin sessions are declared `approvals: false` and shown as `unattended`.
