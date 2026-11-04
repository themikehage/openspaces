# OpenSpaces

An open source hub that runs CLI coding agents (Claude Code and Devin CLI first) behind one normalized API and a web UI.

Status: early development. See `docs/` for the plan.

## Layout

- `packages/core`: pure domain (event model, ports, session state machine). Imports nothing.
- `packages/protocol`: Zod schemas for the public API and events.
- `packages/adapter-kit`: adapter helpers, the fake agent and the adapter/store contract test suites.
- `packages/adapter-claude-code`: Claude Code through the Agent SDK.
- `packages/store-sqlite`: SQLite persistence (`node:sqlite`).
- `apps/daemon`: HTTP + SSE API (Hono) with token auth, Host/Origin checks and registered projects.

## Development

```
pnpm install
pnpm typecheck && pnpm lint && pnpm test
```

Node 22+ and pnpm are required.

## Running the daemon

```
pnpm --filter @openspaces/daemon dev -- --project ~/code/my-repo
```

It binds to `127.0.0.1` only and prints a one-time browser URL and an API token. Only directories inside a `--project` root can be used as a session `cwd`. Set `OPENSPACES_FAKE=1` to register a fake agent for trying the API without any CLI.

```
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3210/api/adapters
```
