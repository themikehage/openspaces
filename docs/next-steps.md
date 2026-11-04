# Next steps

State at `0.1.0` (unreleased): every phase of [the plan](plan.md) is implemented. This document lists what remains before tagging `0.1.0`, and what comes after.

## Before tagging 0.1.0

### 1. Verify both adapters against the real CLIs

Neither adapter has run against the real CLI yet. Only the mock ACP agent and the fake agent exercise them.

- [ ] Claude Code: `OPENSPACES_LIVE=claude-code pnpm exec vitest run claude-code-adapter.live`
  - Confirm whether `result.usage` tokens are cumulative or per turn, and adjust the translator.
  - Confirm approvals through `canUseTool`, interrupt and resume.
- [ ] Devin: run `devin auth login`, then `OPENSPACES_LIVE=devin pnpm exec vitest run devin-adapter.live`
  - Record a real prompt turn as a fixture under `fixtures/devin/`.
  - Confirm `session/request_permission` in `accept-edits` and `smart` modes, `session/cancel` and `session/load`.
  - If permissions do not arrive as ACP requests, set `approvals: false` and mark sessions `unattended` (see [ADR 0001](adr/0001-devin-via-acp.md)).
  - Check the license terms of the Devin CLI.
- [ ] Update ADR 0001 with the verified behaviour.

### 2. First CI run

- [ ] Push and confirm the `check` and `e2e` jobs pass on GitHub Actions.
- [ ] Pin Actions to commit SHAs.

### 3. Release

- [ ] Final name check: npm scope, domain, trademark overlap.
- [ ] Decide package publishing: private monorepo for now, or publish `@openspaces/*` to npm.
- [ ] Move `CHANGELOG.md` from "unreleased" to `0.1.0`, tag `v0.1.0`, create a GitHub release.
- [ ] Enable GitHub private vulnerability reporting (referenced from `SECURITY.md`).
- [ ] Add issue and pull request templates.

## After 0.1.0

Ordered by value, not commitment.

- **Distribution**: a single `npx openspaces` or global install that bundles the daemon and the built web UI.
- **More adapters**: Codex CLI, Gemini CLI and others that speak ACP only need a manifest. Others need a dedicated adapter and must pass `runAdapterContract`.
- **Diff and review view**: show the worktree diff of a session and let the user merge or discard the branch from the UI.
- **Multi-turn UX**: queued prompts, attachments (`images` capability), thinking visibility toggle.
- **Remote access**: today the daemon binds to `127.0.0.1` only. Remote use needs TLS, a real auth story and an updated threat model in `SECURITY.md`.
- **MCP configuration**: a per-project MCP server list passed to adapters that declare the `mcp` capability.
- **Event log retention**: pruning and export of old sessions.
- **Other clients**: a CLI or TUI client on top of `@openspaces/api-client`.

## Open decisions

- Whether Spaces consumes OpenSpaces as a harness, or the projects stay fully separate.
- Final project name and hosting (personal account or organization).
