# Changelog

## 0.1.0 (unreleased)

First public MVP.

- Core domain with a normalized, versioned event model (`schemaVersion` 1), ports and a session state machine.
- Adapters: Claude Code (Agent SDK) and Devin CLI (Agent Client Protocol), with a shared adapter contract suite.
- Daemon with HTTP and SSE API, token and cookie auth, Host and Origin checks, registered projects, SQLite persistence and stream resume.
- Git worktree isolation per session, session limits, recovery of sessions interrupted by a daemon restart, resume of ended sessions, graceful shutdown.
- Web UI: session list, live timeline, approvals, interrupt, resume.
- Known gaps: both real CLIs are covered by opt-in live tests that have not been run in CI; Devin approvals, cancellation and resume are unverified against the real CLI.
