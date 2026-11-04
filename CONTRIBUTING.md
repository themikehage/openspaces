# Contributing

## Setup

```
pnpm install
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test
```

Node 22+ and pnpm are required. `pnpm test:e2e` needs a Playwright Chromium (`pnpm exec playwright install chromium`).

## Ground rules

- `packages/core` imports nothing outside itself. It defines ports and the event model; everything else plugs in. `test/architecture.test.ts` enforces the allowed imports of every package and fails when a package has no rule.
- The web app talks to the daemon only through `@openspaces/api-client`, never `fetch`, and uses the `@/` alias instead of deep relative imports.
- TypeScript is strict and `any` is not allowed. Prettier and ESLint must pass.
- Public contracts live in `packages/protocol`. Changing an event or request shape needs a schema change, a test and a note in `CHANGELOG.md`.
- Decisions that change a boundary or an integration approach get an ADR in `docs/adr/`.

## Writing an adapter

An adapter implements `AgentAdapter` from `@openspaces/core`: `id`, `displayName`, `capabilities`, `probe()` and `start()`. The run it returns emits the normalized events and accepts `send`, `interrupt`, `resolveApproval` and `close`.

1. If the agent speaks the Agent Client Protocol, write only a manifest on top of `@openspaces/adapter-acp` (see `packages/adapter-devin`).
2. Otherwise translate the agent's stream into `AgentEventBody` in a pure translator, and keep process and SDK glue separate so the translator can be tested from recorded messages.
3. Declare capabilities honestly. If the agent cannot ask for approvals, say `approvals: false`; the UI then marks sessions as unattended.
4. Run the shared suite against your adapter:

```ts
import { runAdapterContract } from "@openspaces/adapter-kit/contract";

runAdapterContract({
  name: "my-agent",
  createAdapter: () => createMyAdapter(),
  cwd: () => process.cwd(),
  prompts: { simple: "hello", needsApproval: "...", slow: "..." },
});
```

5. Add a `*.live.test.ts` guarded by `OPENSPACES_LIVE=<id>` for the real CLI, and record fixtures with the CLI version in `fixtures/`.
6. Register the adapter in `apps/daemon/src/main.ts` and add its import rule to `test/architecture.test.ts`.

If the contract suite forces a change to `core`, the port is wrong: fix the port rather than special-casing the adapter.

## Commits

Use conventional prefixes (`feat`, `fix`, `docs`, `test`, `refactor`) and keep changes focused.
