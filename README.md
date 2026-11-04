# OpenSpaces

An open source hub that runs CLI coding agents (Claude Code and Devin CLI first) behind one normalized API and a web UI.

Status: early development. See `docs/` for the plan.

## Layout

- `packages/core`: pure domain (event model, ports, session state machine). Imports nothing.
- `packages/protocol`: Zod schemas for the public API and events.
- `packages/adapter-kit`: adapter helpers, the fake agent and the adapter/store contract test suites.
- `packages/adapter-claude-code`: Claude Code through the Agent SDK.
- `packages/adapter-acp`: generic Agent Client Protocol client adapter.
- `packages/adapter-devin`: Devin CLI manifest on top of `adapter-acp`.
- `packages/store-sqlite`: SQLite persistence (`node:sqlite`).
- `packages/api-client`: typed browser client and SSE stream for the daemon API.
- `apps/web`: Vite + React + Tailwind v4 UI (sessions, timeline, approvals).
- `apps/daemon`: HTTP + SSE API (Hono) with token auth, Host/Origin checks and registered projects.

## Development

```
pnpm install
pnpm verify
```

Node 22+ and pnpm are required.

## Working on this repository

The work system for humans and AI agents is in [AGENTS.md](./AGENTS.md): read [about.md](./about.md) first, track work in [steps.md](./steps.md) and [inbox.md](./inbox.md), and follow the `/START`, `/TRIAGE`, `/EXECUTE`, `/TEST` and `/SHIP` routines in `.agents/routines/`. Rules live in `.agents/rules/`.

## Running the daemon

```
pnpm --filter @openspaces/daemon dev -- --project ~/code/my-repo
```

It binds to `127.0.0.1` only and prints a one-time browser URL and an API token. Only directories inside a `--project` root can be used as a session `cwd`. Open the printed URL: the daemon serves the built UI (`pnpm --filter @openspaces/web build`), or run `pnpm --filter @openspaces/web dev` for hot reload against a daemon on port 3210. Set `OPENSPACES_FAKE=1` to register a fake agent for trying the API without any CLI.

```
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3210/api/adapters
```

End-to-end smoke test with a real browser: `pnpm test:e2e` (needs a Playwright Chromium).
