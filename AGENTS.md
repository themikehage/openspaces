# Agent Protocol — OpenSpaces

Any AI agent working in this repository must follow these instructions **strictly**.

---

## 1. Mandatory Read-First Rule

Before any investigation, code change, feature, or bug fix:

> **You MUST read [about.md](./about.md) to understand the project architecture, tech stack, domain, and key constraints.**

When a change alters architecture, key constraints, environment variables, or project commands:

> **You MUST update [about.md](./about.md) in the same commit.** Other changes do not require it.

---

## 2. Plans & Steps

- Active and pending work lives in [plans/](./plans/) as `H<N>-<slug>.md`, created from [.agents/templates/plan.md](./.agents/templates/plan.md). Each plan carries `Status: draft | approved | done`; `/EXECUTE` only runs `approved` plans.
- Completed milestones are archived in [plans/completed/](./plans/completed/).
- Overall progress is tracked in [steps.md](./steps.md) (one line per milestone, linking its plan).
- Unplanned ideas and requests go to [inbox.md](./inbox.md); `/TRIAGE` promotes them to plans.

---

## 3. Agent Routines (MANDATORY EXECUTION)

Routines are strict operational workflows. When a trigger condition is met, **you MUST read the corresponding routine file completely and execute every step in sequence without skipping or improvising**.

| Routine        | Dedicated File                                               | When It Applies (Triggers)                                                                                                      |
| -------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **`/START`**   | [.agents/routines/START.md](./.agents/routines/START.md)     | First time opening the project, starting a new work session, or after a long pause.                                             |
| **`/TRIAGE`**  | [.agents/routines/TRIAGE.md](./.agents/routines/TRIAGE.md)   | Any feature request, bug report, refactor, or optimization that is not **Trivial** (see Work Lanes). Never write code directly. |
| **`/EXECUTE`** | [.agents/routines/EXECUTE.md](./.agents/routines/EXECUTE.md) | **ONLY** after the user explicitly reviews and approves an existing plan in `plans/`.                                           |
| **`/TEST`**    | [.agents/routines/TEST.md](./.agents/routines/TEST.md)       | **Optional, on request only** (or when a plan lists it): start the app and test it with Playwright. Never automatic.            |
| **`/SHIP`**    | [.agents/routines/SHIP.md](./.agents/routines/SHIP.md)       | Publishing finished work: open a PR, tag or release. Never release outside this routine.                                        |

### Work Lanes

| Lane        | Criteria                                                                                                   | Flow                                                        |
| ----------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Trivial** | 1 file, no behavior change (typo, copy, comment-free config tweak). Never logic, schemas, auth, or deploy. | No plan. Run `verify`, commit conventionally.               |
| **Small**   | 2–3 files, one isolated behavior.                                                                          | `/TRIAGE` → one plan → `/EXECUTE`.                          |
| **Large**   | Cross-cutting or architectural.                                                                            | `/TRIAGE` → numbered milestones → `/EXECUTE` one at a time. |

If unsure, it is not Trivial.

Not every request becomes a plan: `/TRIAGE` may also conclude **no code needed**, **duplicate**, **needs info** or **discard**, and must reproduce bugs before planning a fix.

### Strict Operational Rules:

1. **Never jump straight into coding:** Outside the Trivial lane, when the user asks for a feature or reports a bug, you are strictly forbidden from writing code immediately. You MUST trigger `/TRIAGE`, read [.agents/routines/TRIAGE.md](./.agents/routines/TRIAGE.md), and deliver an approved plan first.
2. **Read the routine file first:** Before starting any routine, read its dedicated file in [.agents/routines/](./.agents/routines/) to ensure zero deviation from the current protocol.
3. **One milestone at a time:** `/EXECUTE` only processes the single active approved milestone. Never batch multiple milestones together.
4. **Mandatory validation gate:** every lane ends with the project's single `verify` command (defined in `about.md`: typecheck, lint, file-size check, tests, build) passing **locally and in CI**, then a clean conventional commit.

### Deviation & Escalation

**Deviation rule.** During `/EXECUTE`, if you need to touch files outside the plan, a criterion turns out to be unmeetable, or the work outgrows its lane: **stop**, record what you found in the plan, and return to `/TRIAGE`. Do not improvise a larger change.

**Always ask a human before:**

- tagging or publishing a release (GitHub release, npm), or changing the SQLite schema version;
- any destructive or irreversible operation (deleting data, force-push, dropping tables);
- touching secrets, credentials, auth or permission logic;
- changing scope or acceptance criteria of an approved plan;
- anything that spends money or messages third parties.

Asking costs minutes; a wrong irreversible action costs far more. When unsure whether something is reversible, treat it as irreversible.

---

## 4. Architecture Principles & Code Rules

Before writing any plan or code, consult the project rules:

- **Backend Rules**: [.agents/rules/backend.rules.md](./.agents/rules/backend.rules.md) (ports first, injected dependencies, Zod contracts, typed errors, import boundaries).
- **Frontend Rules**: [.agents/rules/frontend.rules.md](./.agents/rules/frontend.rules.md) (hooks own state, api-client only, domain components, typed storage).
- **Design Rules**: [.agents/rules/design.rules.md](./.agents/rules/design.rules.md) (borderless canvas and cards, Spaces tokens, typography scale, semantic color).

The rules files take precedence over any default agent behavior.

---

## 5. Skills

Skills live in `.agents/skills/<name>/SKILL.md`. Read one before doing the work it covers:

- **frontend-design** — aesthetic direction when building or reshaping UI (the design rules still win).

---

## 6. Language

Code, docs, protocol, rules, routines, plans, issues and UI strings are written in English. Conversation with the user may be in Spanish.

---

## 7. Non-Negotiable Constraints

- **No code without a plan** outside the Trivial lane (see Work Lanes).
- **No direct singletons** — use dependency injection (`core` imports nothing; adapters and stores are injected).
- **No `any`** in new code — strict TypeScript always.
- **Files ≤ 300 lines** — extract when growing.
- **CI is mandatory** — a workflow runs `verify` on every push and PR (`about.md` → CI). A project without it is not considered set up; fixing that is the first milestone.
- **Real lint** — `verify` must run an actual linter/formatter tool, not just the word "lint" in a doc.
- **Conventional commits only** — no AI attribution.
- **Public repository** — never commit secrets, tokens, `.env` files, SQLite databases, session logs or local paths. Check the diff before every push.
- **Import boundaries** — `test/architecture.test.ts` is part of `verify`; changing the allowed imports needs an ADR in `docs/adr/`.
