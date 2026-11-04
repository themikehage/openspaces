# About — OpenSpaces

> **Last updated**: 2026-11-04
> **Stack**: Node 22 · TypeScript 6 (strict) · pnpm workspaces · Hono · SQLite (`node:sqlite`) · React 19 · Vite 8 · Tailwind CSS v4 · Vitest · Playwright

OpenSpaces is a local daemon plus a web UI that runs CLI coding agents (Claude Code through the Agent SDK, Devin CLI through ACP) behind one normalized, versioned API. The user is a developer who wants to drive several agent sessions from one place, with approvals, interrupts, resume and git worktree isolation.

Core entities: **adapter** (one per agent CLI), **session** (one run of an agent in a directory), **event** (normalized, append-only record of what happened), **workspace** (the directory the agent works in, optionally an isolated git worktree).

---

## Architecture

Hexagonal. `core` defines the ports and the session state machine and imports nothing. Every integration is an adapter behind a port, so a new agent, store or client does not touch `core`.

```
packages/
  core/              ports, events, session state machine, SessionService
  protocol/          Zod schemas for the HTTP/SSE contract (schemaVersion 1)
  adapter-kit/       fake agent, event channel, line process, contract test suites
  adapter-claude-code/  Claude Agent SDK adapter, pure translator
  adapter-acp/       generic Agent Client Protocol client (JSON-RPC over stdio)
  adapter-devin/     thin manifest over adapter-acp
  store-sqlite/      SqliteSessionStore (WAL, user_version migrations)
  workspace-git/     GitWorktreeProvider
  api-client/        typed HTTP client and SSE stream, used by the web UI
apps/
  daemon/            Hono server: security, routes, SSE, static web, main.ts
  web/               React UI
e2e/                 Playwright smoke test against the real daemon
docs/                plan, ADRs
test/                architecture test (import boundaries)
```

Event flow: adapter → `AgentRun.events` → `SessionService` (validates the state transition, appends to the store, notifies subscribers) → SSE (`Last-Event-ID` resume) → web reducer (`lib/timeline.ts`).

Session states: `created → starting → idle ⇄ running ⇄ awaiting_approval → ended | failed`. Adapters declare capabilities (`resume`, `approvals`, `interrupt`, `mcp`, `images`, `thinking`) and the UI adapts to them.

## Tech Stack

| Layer       | Technology                                                  |
| ----------- | ----------------------------------------------------------- |
| **Runtime** | Node ≥ 22                                                   |
| **Server**  | Hono, `@hono/node-server`, SSE                              |
| **Storage** | `node:sqlite` (WAL), in-memory store for tests              |
| **Agents**  | `@anthropic-ai/claude-agent-sdk`, Devin CLI over ACP        |
| **Client**  | React 19, Vite 8, Tailwind v4 (Spaces tokens), lucide-react |
| **Tests**   | Vitest 5, Playwright (Chromium)                             |
| **Quality** | ESLint (typescript-eslint), Prettier                        |
| **Deploy**  | None: local daemon, released as a tag and GitHub release    |

---

## Key Constraints & Gotchas

- The repository is **public**. Never commit secrets, `.env`, SQLite files, session logs or local paths.
- The daemon binds `127.0.0.1` only, checks Host and Origin, and authenticates with a token (Bearer) or an `HttpOnly` `SameSite=Strict` cookie obtained through `/auth/exchange`. See `SECURITY.md`.
- `usage.reported` events are **deltas**, not cumulative. Translators convert cumulative vendor numbers.
- `devin acp` accepts `session/new` without login, so `SessionService.create` probes the adapter first.
- Graceful shutdown must await `LiveSession.finished`, otherwise worktrees are left behind.
- `typescript` is pinned to 6 because typescript-eslint does not support 7 yet.
- Neither real CLI has been exercised end to end yet. Live tests are opt-in (`OPENSPACES_LIVE=claude-code,devin`) and never run in CI.
- Playwright screenshots in `e2e/*.png` are git-ignored.
- Commits follow Conventional Commits with no AI attribution (`AGENTS.md`).

---

## Environment Variables

| Key                       | Description                               | Default                     |
| ------------------------- | ----------------------------------------- | --------------------------- |
| `OPENSPACES_PORT`         | Daemon port                               | `3210`                      |
| `OPENSPACES_DATA_DIR`     | Where the SQLite database and token live  | `~/.local/share/openspaces` |
| `OPENSPACES_MAX_SESSIONS` | Concurrent live sessions                  | `8`                         |
| `OPENSPACES_WEB_DIR`      | Built web UI to serve                     | `apps/web/dist`             |
| `OPENSPACES_FAKE`         | Register the fake agent (tests, demos)    | unset                       |
| `OPENSPACES_LIVE`         | Enable live tests for the listed adapters | unset                       |

---

## Project Commands

### Quality gate (mandatory)

- `pnpm run verify` — format check + typecheck + lint + `check:size` (no file > 300 lines) + unit tests + build.

### CI (mandatory)

- `.github/workflows/ci.yml` runs on every push and PR: `check` job (install → `pnpm verify`) and `e2e` job (Playwright).

### Behavior check

- `pnpm test:e2e` — builds the web UI and drives the real daemon with Chromium (login, approval, interrupt, end session, 401 without cookie).
- `OPENSPACES_LIVE=claude-code,devin pnpm exec vitest run live` — live adapter tests (spends tokens; Devin needs `devin auth login`).

### Development

- `pnpm --filter @openspaces/daemon exec tsx src/main.ts --project <dir>` — run the daemon.
- `pnpm --filter @openspaces/web dev` — Vite dev server for the UI.
