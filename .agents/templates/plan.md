# H{{N}} — {{MILESTONE_TITLE}}

**Status**: draft <!-- draft | approved | done -->
**Objective**: {{ONE_LINE_OBJECTIVE}}.

**Active rules**: `frontend.rules.md` · `backend.rules.md`.

---

## Current State (As-Is)

- {{CURRENT_STATE_1}}
- {{CURRENT_STATE_2}}

---

## Target State (To-Be) — Acceptance Criteria

- [ ] **HN-A1** — {{CRITERION_1}}
- [ ] **HN-A2** — {{CRITERION_2}}
- [ ] **HN-A3** — `verify` passes with exit code 0.
- [ ] **HN-A4** — No console errors in the browser / runtime _(state how it is checked, e.g. `agent-browser` console log or server log grep)_.

---

## Artifacts

### 1. MODIFY `path/to/file.ts`

{{DESCRIPTION_OF_CHANGE}}

```typescript
// Key code snippet or interface
```

### 2. NEW `path/to/new-file.ts`

{{DESCRIPTION_OF_NEW_FILE}} (max {{N}} lines)

- Method `foo()`: does X.
- Method `bar()`: does Y.

---

## Non-Negotiable Constraints

1. {{CONSTRAINT_1}} — **not touched in this milestone**.
2. Zero `any` in new code.
3. New files ≤ 300 lines.
4. Conventional commit after completion.

---

## Verification

```bash
<pm> run verify
# -> exit code 0
```

Behavior check: {{HOW_EACH_CRITERION_IS_EXERCISED — command, HTTP call, or browser run}}.

---

## Evidence

_(Filled during `/EXECUTE`. One line per criterion: command + result, screenshot path, or log excerpt. `Status: done` is not allowed while any line is empty.)_

- HN-A1 — {{EVIDENCE}}
- HN-A2 — {{EVIDENCE}}
- HN-A3 — {{EVIDENCE}}
- HN-A4 — {{EVIDENCE}}

---

## Retro

{{LESSON_OR_"no lessons" — filled at close}}
