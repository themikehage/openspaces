---
name: SHIP
description: Integrate and release finished work, with autonomy proportional to reversibility.
---

# /SHIP

Run after `/EXECUTE` when the user asks to publish, open a PR, tag or release.

## Preconditions (all must hold, else stop)

1. The plan is `Status: done` and every criterion has evidence.
2. `pnpm run verify` passes on the current tree **and CI is green on the commit being shipped** (`gh run list` / `gh pr checks`). A red or missing CI blocks the release.
3. `git status` is clean, the commit is conventional, and the diff has been checked for secrets, tokens, local paths and database files (the repository is public).

## Autonomy by Reversibility

| Action                           | Reversibility                         | Who decides                                                                   |
| -------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| Push a branch, open a PR         | Fully reversible                      | Agent, autonomously.                                                          |
| Merge to `main`                  | Reversible (revert)                   | Agent only if the user asked for it.                                          |
| Tag, GitHub release, npm publish | Public and hard to undo               | **Human approval each time.**                                                 |
| SQLite schema version bump       | Not reversible for existing user data | **Human approval each time**, with the migration tested on a legacy database. |

Prior approval for one release does not extend to the next.

## Protocol

1. Check preconditions.
2. Integrate: create a branch and open a PR (`gh pr create`) with the plan's objective, criteria and evidence in the description.
3. For a release: move `CHANGELOG.md` from unreleased to the version, tag `v<version>`, create the GitHub release from the changelog entry.
4. **Smoke the change, not just the build.** Run `pnpm test:e2e` and, when the change touches an adapter, the live test for it (`OPENSPACES_LIVE=<adapter> pnpm exec vitest run live`).
5. **Rollback trigger**: if the smoke fails, `git revert <commit>` and report what failed. Do not fix forward on `main` without approval.
6. Record the outcome in `steps.md` or the PR.
