# OpenSpaces

An open source hub that runs CLI coding agents (Claude Code and Devin CLI first) behind one normalized API and a web UI.

Status: early development. See `docs/` for the plan.

## Layout

- `packages/core`: pure domain (event model, ports, session state machine). Imports nothing.
- `packages/protocol`: Zod schemas for the public API and events.
- `packages/adapter-kit`: adapter helpers, the fake agent and the adapter contract test suite.

## Development

```
pnpm install
pnpm typecheck && pnpm lint && pnpm test
```

Node 22+ and pnpm are required.
