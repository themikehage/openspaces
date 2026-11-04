# Steps — OpenSpaces

Progress tracker. Agents update this after each milestone completes.

Keep it lean: every entry is **one line + a link to its plan** (archived in `plans/completed/` when done). Detail belongs in the plan, not here. Loose ideas go to [inbox.md](./inbox.md).

---

## Backlog

- [ ] **H1 — Verify the real CLIs**: run the live tests for Claude Code and Devin, fix the translators, record a Devin prompt-turn fixture, update ADR 0001.
- [ ] **H2 — First green CI**: confirm `check` and `e2e` pass on GitHub Actions, pin Actions to commit SHAs, enable private vulnerability reporting, add issue and PR templates.
- [ ] **H3 — Release 0.1.0**: final name check, decide npm publishing, move the changelog entry, tag `v0.1.0`, GitHub release.

---

## In Progress

_(move items here when work starts)_

---

## Completed

Pre-protocol work, described in [docs/plan.md](./docs/plan.md):

- [x] Phase 0 — Devin spike (ADR 0001)
- [x] Phase 1 — Skeleton and contracts
- [x] Phase 2 — Claude Code adapter and daemon
- [x] Phase 3 — Web UI (aligned with the Spaces design system)
- [x] Phase 4 — Devin through ACP
- [x] Phase 5 — Hardening: worktrees, limits, recovery, resume, graceful shutdown, logging, docs
