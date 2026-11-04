---
trigger: always_on
---

# Backend Rules

Immovable principles for `packages/*` and `apps/daemon`. Every change must respect them.

## 1. Ports First

Every new capability (agent, store, workspace, clock, id source, logger) is an interface in `packages/core/src/ports.ts` **before** any implementation. `core` imports nothing but the language. Implementations live in their own package.

## 2. Dependency Injection

Services receive their dependencies through constructor deps (`SessionServiceDeps`, `AppDeps`). No module-level singletons, no reading `process.env` outside `apps/daemon/src/main.ts`.

## 3. Import Boundaries

Each package may import only what `test/architecture.test.ts` allows. Adapters never import each other except `adapter-devin` → `adapter-acp`. Changing a boundary needs an ADR in `docs/adr/`.

## 4. Contracts in `packages/protocol`

Every payload that crosses the HTTP or SSE boundary has a Zod schema in `packages/protocol`, and every route validates with it. Event schemas keep a compile-time check against the `core` types. Any breaking change bumps `schemaVersion`.

## 5. Typed Errors Only

Controlled failures extend `OpenSpacesError` with a stable `code` and map to an HTTP status in `apps/daemon/src/http-errors.ts`. Never throw bare `Error` or strings across a package boundary.

## 6. Every Adapter Passes the Contract

A new `AgentAdapter` must pass `runAdapterContract` and a new `SessionStore` must pass `runSessionStoreContract`. Mapping from a vendor protocol to normalized events lives in a pure translator with unit tests. Unknown vendor messages are ignored, never fatal.

## 7. Secure by Default

- The daemon binds to `127.0.0.1`, checks Host and Origin, and requires the token or cookie on every `/api` route.
- Project paths go through `ProjectGuard` (`realpath`). Logs go through the redacting logger.
- Changing auth, permission logic or the threat model (`SECURITY.md`) requires human approval.

## 8. Strict TypeScript, No `any`

`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. Zero `any` in new code.

## 9. No Comments in Production Code

Code explains itself. Only exception: a TODO linking an issue.

## 10. Files ≤ 300 Lines

`pnpm run check:size` is part of `verify`. Extract submodules when a file grows.

## 11. Tests Are Self-Contained

Tests use the fake agent, the mock ACP agent and temporary directories. Tests that need a real CLI are opt-in (`OPENSPACES_LIVE`) and never run in CI. A failing test blocks `verify`; never skip or delete one to get green.
