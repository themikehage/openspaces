---
name: EXECUTE
description: Implement an approved plan with the validation gate, archive it and commit.
---

# /EXECUTE

Run when a plan has been reviewed and approved by the user.

## Protocol

1. Read the target plan file completely. If its `Status` is not `approved`, **stop** and ask the user.
2. Implement each artifact following the acceptance criteria. One milestone only. If you hit a deviation (out-of-plan files, unmeetable criterion, outgrown lane), follow the **Deviation & Escalation** rule in `AGENTS.md`: stop and return to `/TRIAGE`.
3. Validate with the single project gate defined in `about.md` (`Quality gate`):
   ```bash
   <pm> run verify     # typecheck + lint + check:size + tests + build
   ```
4. Fix any errors before closing the milestone.
5. **Exercise the behavior, not just the build.** For each acceptance criterion, run the real thing (CLI, HTTP request, or browser — use `agent-browser` for UI) and record the result in the plan's **Evidence** section. A criterion with no evidence is not met.
6. **Self-review the diff** against the plan: every changed file is in scope, every criterion has evidence, nothing extra slipped in. Anything out of scope is reverted or triggers the deviation rule.
7. **Retro.** If the work surfaced a surprise, a user correction or a failed attempt, add a one-line gotcha to `about.md` (Key Constraints & Gotchas) or a rule to `.agents/rules/`, and write it in the plan's Retro line. Otherwise write "no lessons".
8. Close the milestone **before** committing, so the commit is complete:
   - Mark completed criteria as `[x]` (only those with evidence) and set `Status: done` in the plan.
   - Move the plan to `plans/completed/`.
   - Move the milestone to Completed in `steps.md` (one line + link to the archived plan).
   - Update `about.md` if architecture, constraints, env vars, commands or retro gotchas changed.
9. Commit with a conventional commit, adding only the files you changed (no `git add .`, no AI attribution):
   ```bash
   git add <explicit paths>
   git commit -m "feat|fix|refactor|chore(scope): description"
   ```
10. Confirm `git status` is clean.
11. If the commit was pushed, check that CI passes (`gh run watch` / `gh pr checks`) before reporting the milestone as closed. A red CI reopens it.
