---
name: TEST
description: Optional on-demand testing with Playwright — start the app, drive it, report findings.
---

# /TEST

**Optional and never automatic.** Run only when the user asks, or when `/TRIAGE` or a plan explicitly lists it (UI-heavy change, bug that needs a browser to reproduce, pre-release regression pass). It does not replace `verify` or the per-criterion evidence in `/EXECUTE`.

## Scope

| Mode           | Goal                                                                              | Output                          |
| -------------- | --------------------------------------------------------------------------------- | ------------------------------- |
| **Explore**    | Drive the running app against a scenario or plan criteria and report what breaks. | Findings list. No code changes. |
| **Regression** | Write or run durable Playwright specs in `e2e/` for flows that must not break.    | Specs committed through a plan. |

Findings that need a fix go to `inbox.md` or `/TRIAGE`; `/TEST` never fixes code itself.

## Preconditions

1. `about.md` documents the commands to start the app and the e2e run. If not, stop and ask — or add them via a plan.
2. Playwright is installed as a dev dependency (`<pm> add -D @playwright/test`, then `npx playwright install chromium`). Installing it is a normal change: it goes through `/TRIAGE`.
3. Test data is disposable. Never run against production or against real personal data. Anything that writes, deletes or spends money requires human approval.

## Protocol

1. Read `about.md` (start commands, ports, env) and the scenario or plan criteria to cover.
2. Start the app with a Playwright `webServer` entry (preferred, so it is reproducible and CI-ready) or manually in the background; wait for the health check before driving it.
3. Exercise the scenario. For each step capture evidence: assertion result, screenshot or trace (`--trace on`), console errors, failed network requests.
4. In **Regression** mode keep specs small, deterministic and independent: role/text locators, no fixed sleeps, one flow per spec, state created and cleaned inside the test.
5. Stop the app and leave the tree clean: artifacts (`test-results/`, `playwright-report/`) must be git-ignored.
6. Report: scenario, pass/fail per step, evidence paths, and a list of findings with reproduction steps. Triage each finding (bug / flake / expectation gap).

## Config baseline

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://localhost:5173", trace: "retain-on-failure" },
  webServer: {
    command: "<pm> run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
});
```

## CI

E2E is **not** part of the default `verify`. When a project accumulates stable specs, add a separate CI job (`<pm> run test:e2e`) and record it in `about.md`. Keep it out of `verify` until the suite is fast and non-flaky.
