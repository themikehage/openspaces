# Plan: OpenSpaces MVP, an open source hub for Claude Code and Devin CLI

Status: draft, decisions 1, 3, 4 and 5 settled (2026-11-04). Independent project with its own repo. It builds on `docs/harness-per-entity-analysis.md` but inherits nothing from Spaces (`agent-kernel`, `PermissionEngine`, `ServerContext`).

Written in English because it will seed the new repo's `docs/`.

## 1. What it is

A local daemon with a web UI that runs CLI coding agents (Claude Code and Devin CLI first) behind one normalized API. A client creates sessions, sends prompts, receives streaming events and resolves approvals without knowing which agent is underneath.

It is not: an agent loop of its own, a model-provider manager, or a clone of Spaces. It never handles model credentials; each CLI uses its own login.

## 2. Settled decisions

| Topic                   | Decision                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| Name                    | OpenSpaces                                                                                           |
| First client            | Web UI (a terminal CLI stays minimal, for `serve` and scripting)                                     |
| Runtime                 | Node (LTS), TypeScript strict                                                                        |
| Language                | English for code, docs, issues and UI strings                                                        |
| Claude Code integration | Agent SDK (default, pending your confirmation: it is the only path with real `canUseTool` approvals) |

To do before the repo exists: check availability of the npm scope, the GitHub org/name and the domain, and review trademark overlap with the existing Spaces product.

## 3. Principles

1. **The core knows no agent.** It defines ports and its own event model. Claude Code and Devin are adapters.
2. **Own, versioned event model**, never a CLI's format. Translation happens in one place per adapter, covered by contract tests.
3. **Declared capabilities, not assumptions.** Each adapter states what it supports (`resume`, `approvals`, `mcp`, `steer`, `images`, `plan`); core and UI degrade accordingly.
4. **One common protocol where it exists.** Agent Client Protocol (ACP, JSON-RPC over stdio) backs a generic adapter, so a third ACP-speaking CLI costs a manifest, not a package.
5. **Isolated by default:** one `git worktree` per session, loopback-only daemon, strict origin checks.
6. **Third-party formats drift:** each adapter pins a supported version range and checks it at startup.

## 4. What is verified and what is not

| Point                                                                                                     | Status                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code `claude -p --output-format stream-json --verbose --include-partial-messages`, `--resume <id>` | Documented                                                                                                                                                                                                                                         |
| Claude Code Agent SDK with `canUseTool`, `resume`, `forkSession`                                          | Documented. Approval callback is SDK-only, not available in `claude -p`                                                                                                                                                                            |
| Devin CLI is an ACP agent (runs inside Zed, JetBrains, Xcode)                                             | Confirmed by the [official repo README](https://github.com/CognitionAI/devin-cli). The `devin acp` subcommand and its JSON-RPC-over-stdio shape come from a [third-party post](https://qainsights.com/?p=18702) and still need to be tried locally |
| Devin CLI `-p`                                                                                            | Documented ([essential commands](https://docs.devin.ai/cli/essential-commands)): single-turn, prints plain text to stdout. No documented structured output, so it is unfit as the adapter's transport                                              |
| Devin CLI resume                                                                                          | Documented: `-c`, `-r <session-id>`                                                                                                                                                                                                                |
| Devin CLI permission modes                                                                                | Documented: `--permission-mode` with `smart`, `bypass`, `autonomous`; `--sandbox` forces autonomous                                                                                                                                                |
| Devin CLI approvals over ACP, MCP support, install (`npm install -g devin`), license                      | Phase 0 must check these                                                                                                                                                                                                                           |

Direction for the Devin adapter: ACP, not `-p`. That makes `adapter-acp` the primary piece and `adapter-devin` a thin manifest on top (binary, args, version range, capability overrides).

## 5. Architecture

pnpm monorepo. Dependencies point one way; `core` imports nothing from the rest.

```
packages/
  core/              pure domain: types, ports, session state machine, events
  protocol/          Zod schemas for API and events (public, versioned contract)
  adapter-kit/       shared helpers: subprocess supervision, JSONL/JSON-RPC framing, contract test suite
  adapter-claude-code/
  adapter-devin/
  adapter-acp/       generic ACP adapter (Devin may build on it)
  store-sqlite/      persistence port implementation
  api-client/        typed client generated from `protocol`, used by web and CLI
apps/
  daemon/            HTTP + SSE, auth, composition root (the only place that wires everything)
  web/               Vite + React UI served by the daemon
  cli/               `openspaces serve | doctor | sessions`
```

### Ports in `core`

- `AgentAdapter`: `id`, `capabilities`, `probe()` (version and availability), `start(spec): AgentRun`.
- `AgentRun`: `events: AsyncIterable<AgentEvent>`, `send(input)`, `interrupt()`, `resolveApproval(id, decision)`, `close()`.
- `SessionStore`: sessions plus an append-only event log with cursors.
- `WorkspaceProvider`: `create(spec)` / `dispose()`; first implementation uses `git worktree`.
- `AdapterRegistry`: adapters registered by manifest, never imported by core.
- `Clock`, `IdGenerator`, `Logger`: for deterministic tests.

### Event model (v1)

`session.started`, `message.delta`, `message.completed`, `thinking.delta`, `tool.started`, `tool.output`, `tool.completed`, `approval.requested`, `approval.resolved`, `usage.reported`, `session.error`, `session.ended`.

Every event carries a per-session monotonic `id`, `ts`, `sessionId`, `schemaVersion` and an optional `raw` payload (original CLI data, debugging only, never contractual).

### Session state machine

`created → starting → running ⇄ awaiting_approval → idle → ended | failed`. Pure transitions in `core`, table-driven tests.

## 6. Design decisions and why

- **Daemon plus clients, not a library alone.** Several clients can attach, and sessions outlive the browser tab. `core` remains usable on its own.
- **SSE for events, plain HTTP for commands.** Simple, `curl`-debuggable, resumable via `Last-Event-ID`. WebSocket can come later behind the same contract.
- **Persist normalized events**, not each CLI's. History is agent-independent and replayable without the CLI installed.
- **Approvals are first-class.** If an adapter cannot intercept them (`capabilities.approvals = false`) the session is flagged `unattended` and the UI says so. Control is never faked.
- **The daemon serves the web build.** One process, one port, no CORS surface in production. Vite dev server proxies in development.
- **No reverse MCP server in the MVP.** Valuable, but it widens scope too much.
- **Node + Hono** for HTTP.

## 7. Web UI scope

In: session list with status badges; new session dialog (project directory, agent, optional `--in-place`); live timeline (messages, thinking, tool calls with collapsible output); approval cards with allow/deny and "allow for session" where the adapter supports it; prompt box with interrupt; reconnect that resumes the stream from the last event; capability-driven controls (hidden or disabled, never broken); light/dark theme.

Out: diff/file browser, multi-user, settings screens beyond the daemon token, mobile layout polish.

Rules from day one: one state hook per view, all HTTP through `api-client`, no raw `fetch`, no state library, Tailwind v4, accessible components, no component over 300 lines.

## 8. Security model (a local daemon that drives agents is a real attack surface)

- Bind to `127.0.0.1` only; refuse other interfaces unless explicitly overridden.
- Validate `Host` and `Origin` on every request (blocks DNS rebinding and cross-site calls from other local pages).
- Token generated at startup, delivered to the browser through a one-time URL printed by `openspaces serve`, then kept in an `HttpOnly`, `SameSite=Strict` cookie. No token in query strings after exchange.
- Tool output and agent text rendered as inert content: no HTML injection, no auto-opening links.
- Worktree per session; project directories must be explicitly registered before use.
- `SECURITY.md` states plainly that agents run with the user's OS permissions and what `unattended` means.

## 9. Quality bar from day one

- **Adapter contract suite** in `adapter-kit`: event ordering, clean close, interrupt, approval flow. Runs against a `fake-agent` in CI and against real CLIs in an opt-in job.
- **Recorded fixtures** of real CLI output, annotated with the CLI version, to detect drift.
- **Dependency rules enforced in CI** (`dependency-cruiser` or equivalent): core imports nothing; adapters never import each other.
- TS strict with no `any`, ESLint, Prettier, Vitest, Playwright smoke test for the UI, coverage floors on `core` and `protocol`.
- Robust subprocess handling: timeouts, `SIGTERM` then `SIGKILL`, no orphans, buffer limits.
- Structured logs with secret redaction.
- Semantic versioning, changesets, MIT license, `CONTRIBUTING.md`, `SECURITY.md`, ADRs in `docs/adr/`.
- "Write an adapter" guide, validated by writing a minimal adapter from it (phase 3).

## 10. MVP scope

In: create, list, resume and close sessions on a registered project; prompts, interrupt, streaming normalized events; tool approvals where supported; Claude Code via SDK; Devin per the phase 0 outcome; worktree per session; SQLite persistence and stream resume; web UI as in section 7; `openspaces serve` and `openspaces doctor` (reports installed CLIs, versions, capabilities).

Out: multi-user, quotas or billing, remote or container execution (stays behind `WorkspaceProvider`), agent-to-agent delegation, workflows, previews, more than two CLIs.

## 11. Phases

**Phase 0: Devin spike (1 day).** Desk research is done (section 4): ACP is the route. Remaining, hands-on: install `devin`, log in, run `devin acp` and capture the raw JSON-RPC session (initialize, new session, prompt, tool call, permission request) into a fixture; confirm approvals arrive as ACP `session/request_permission`; check MCP and resume over ACP; note the license. Output: an ADR confirming the ACP adapter. Fallback if ACP approvals do not work: run Devin with `unattended` and document it.

**Phase 1: skeleton and contracts.** Monorepo, CI, `core`, `protocol`, state machine, `fake-agent`, contract suite, `api-client`. No real CLI yet.

**Phase 2: Claude Code and daemon.** SDK adapter with `canUseTool`, resume, interrupt. SQLite store. Daemon with SSE, auth and origin checks. Exit criterion: a full round trip with an approval, driven by `curl`.

**Phase 3: web UI.** Session list, timeline, approvals, prompt box, reconnect. Playwright smoke test against `fake-agent`, then against Claude Code.

**Phase 4: Devin.** Adapter per the spike. Exit criterion: it passes the same contract suite and the same UI flows without changes to `core`. If `core` must change, fix the port first; this is the real test of decoupling. Only after this is event `schemaVersion 1` frozen.

**Phase 5: hardening and release.** Recovery after daemon restart, worktree cleanup, limits, docs, `0.1.0`.

## 12. Risks

| Risk                                                               | Mitigation                                                          |
| ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Devin exposes no structured interface                              | Phase 0 spike; MVP stays viable with Claude Code alone              |
| CLI output formats change                                          | Versioned fixtures, supported ranges, `probe()` at startup          |
| Event model too narrow once the second adapter lands               | Freeze `schemaVersion 1` only after phase 4                         |
| Local web daemon abused by other pages or processes                | Loopback bind, Host/Origin checks, cookie auth, registered projects |
| Agents act with broad host permissions                             | Worktrees, approvals, `unattended` flag, honest `SECURITY.md`       |
| Licensing or ToS of programmatic CLI use; name overlap with Spaces | Review before publishing; the hub never proxies credentials         |

## 13. Still open

1. Confirm Claude Code via Agent SDK (assumed) rather than `claude -p`.
2. Where the repo lives: personal account or a new GitHub org.
3. Whether the Spaces repo should later consume OpenSpaces as a harness, or the projects stay fully separate.
