# Inbox — OpenSpaces

Loose ideas, bugs and requests that are not yet planned. One line each. `/TRIAGE` reviews this file and promotes entries into plans (`plans/H<N>-<slug>.md`); remove an entry once promoted or discarded.

---

- Single `npx openspaces` or global install that bundles the daemon and the built web UI.
- More adapters: Codex CLI and Gemini CLI (ACP manifests where possible).
- Diff and review view: show a session's worktree diff and merge or discard the branch from the UI.
- Multi-turn UX: queued prompts, attachments (`images` capability), thinking visibility toggle.
- Remote access: TLS, real auth and an updated threat model (today `127.0.0.1` only).
- Per-project MCP server list passed to adapters that declare `mcp`.
- Event log retention: pruning and export of old sessions.
- CLI or TUI client on top of `@openspaces/api-client`.
- Decide whether Spaces consumes OpenSpaces as a harness or the projects stay separate.
- Optional `word-spacing` tweak: Outfit's narrow space makes "Allow once" read as "Allowonce".
