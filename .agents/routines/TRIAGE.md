---
name: TRIAGE
description: Analyze a feature request or bug before writing any code.
---

# /TRIAGE

Run when the user brings a feature request, improvement, or bug report.

## Protocol

1. **Stop. Do not execute.**
2. Read `about.md`, `inbox.md` and the files involved in the request. Promote relevant inbox entries into the plan and remove them from the inbox.
3. **Reproduce or understand first.**
   - Bug: reproduce it (command, request, or browser run) and record the exact steps and observed vs. expected result. If it cannot be reproduced, say so; do not plan a fix for something you cannot see.
   - Feature/change: restate the expected outcome in your own words and check it is not already implemented or covered by an existing plan.
4. **Decide the exit.** Not every request ends in a plan:

| Exit               | When                                                                        | Action                                   |
| ------------------ | --------------------------------------------------------------------------- | ---------------------------------------- |
| **No code needed** | Configuration, data, docs, usage error, or behavior is already as intended. | Explain and propose the non-code action. |
| **Duplicate**      | Already in `plans/`, `steps.md` or `inbox.md`.                              | Point to it; no new plan.                |
| **Needs info**     | Expected behavior or acceptance is ambiguous, or a bug is not reproducible. | Ask the user specific questions; stop.   |
| **Discard**        | Out of scope or contradicts a constraint in `about.md`.                     | Say why; remove from inbox.              |
| **Plan**           | Real, understood, and needs code.                                           | Continue below.                          |

5. Determine the lane (see Work Lanes in `AGENTS.md`). If it is **Trivial**, tell the user and go straight to the fix, `verify` and commit — no plan.

**Small** (2–3 files, isolated change):

- Create `plans/H<N>-<slug>.md` from `.agents/templates/plan.md` with `Status: draft`.
- Present it for approval before touching any code.

**Large** (cross-cutting, 4+ files, or architectural):

- Decompose into numbered, independent milestones.
- Create one plan file per milestone in `plans/` (`H<N>-<slug>.md`, `Status: draft`).
- Each milestone must be completable and verifiable in isolation.

6. **STOP and wait for user approval:**
   - Present the plan to the user.
   - You are strictly forbidden from writing, editing, or deleting code until the user explicitly approves the milestone. On approval, set `Status: approved` in the plan.

## Every Plan Must Include

- Which rules apply (`frontend.rules.md`, `backend.rules.md`, `design.rules.md`).
- Checkboxed acceptance criteria that are **verifiable by command or observation**. For a bug, the first criterion is the reproduction from step 3 no longer failing.
- A **Non-Negotiable Constraints** section (what MUST NOT be broken or touched).
- A **Verification** section with runnable commands, always including `verify`, and how each behavioral criterion will be exercised.
- An **Evidence** section (empty until `/EXECUTE`).
- The canonical structure from `.agents/templates/plan.md`.
