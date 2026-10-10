---
name: qa-autofix-loop
description: Use at the end of development (and after any large change) to run Pest, Vitest, lint, build and Playwright, fix every bug found, and repeat until consecutive dry runs find nothing. Defines the loop, triage rules, guardrails and exit criteria.
---

# QA auto-fix loop

Goal: the AI runs the whole test suite, fixes real bugs, and only stops when a **dry run** (a full verification pass with zero code edits) finds no bugs — twice in a row.

## Prerequisites (once)
1. Keep `qa-kit/` in place at the project root; never overlay or copy its contents into the root. Run scripts as `bash qa-kit/scripts/qa/<script>.sh`.
2. Before running the kit, move any existing shared Pest helpers to `tests/Support/`, then install the QA Pest bootstrap with `cp qa-kit/tests/Pest.php tests/Pest.php` (merge intentionally if a root bootstrap already exists). The PHPUnit configuration must include `qa-kit/tests/Feature` and `qa-kit/tests/Unit`.
3. `cp qa-kit/.env.e2e.example .env.e2e`, `php artisan key:generate --env=e2e`, create two empty MySQL databases: `oms_e2e` (Playwright) and `oms_test` (Pest, via `phpunit.xml`: `DB_CONNECTION=mysql`, `DB_DATABASE=oms_test`, `QUEUE_CONNECTION=sync`, `CACHE_STORE=array`). Never point both at the same database.
4. Dev tools: `composer require --dev pestphp/pest pestphp/pest-plugin-laravel laravel/pint larastan/larastan`.
5. JS tools are already in the root `package.json` (from `monorepo-template/`): run `npm ci` then `npx playwright install --with-deps chromium`. Never create a second `package.json`.
6. Frontend must implement the `data-testid` contract in `docs/10-testid-contract.md`; the API must follow `docs/04-api-spec.md` (including "Response shapes relied on by automated tests"). Missing Vitest specs are a class B gap: write them per `skills/testing` (the `frontend_unit` step fails when there are none).
7. Make scripts executable: `chmod +x qa-kit/scripts/qa/*.sh`. Run `composer qa` / `bash qa-kit/scripts/qa/run-all.sh`.

## Commands
| Command | Purpose |
|---|---|
| `make -f qa-kit/Makefile qa` / `bash qa-kit/scripts/qa/run-all.sh` | Full run: pint, phpstan (if installed), seed check, Pest, ESLint, tsc, Vitest, build, Playwright |
| `bash qa-kit/scripts/qa/run-all.sh --only backend_pest` | One step (names: `backend_lint, backend_static, seed_check, backend_pest, frontend_lint, frontend_types, frontend_unit, frontend_build, e2e`) |
| `make -f qa-kit/Makefile pest` / `make -f qa-kit/Makefile e2e` | Shortcuts for the two big suites |
| `bash qa-kit/scripts/qa/static-checks.sh` | Greps for debug code, `.only/.skip`, hard waits, raw SQL interpolation, unprotected API routes |
| `make -f qa-kit/Makefile dry-run` / `bash qa-kit/scripts/qa/dry-run.sh 2` | Verification only: static checks + random-order Pest + Playwright with `--repeat-each=2`, **twice consecutively**; fails if tracked files change |

Logs: `qa-logs/latest/*.log`, `qa-logs/latest/summary.json`; Playwright traces/screenshots in `qa-kit/e2e/test-results/`, HTML report in `qa-kit/e2e/playwright-report/`.

## The loop

```
LOOP (max 15 iterations):
  1. Run:  bash qa-kit/scripts/qa/run-all.sh
  2. If everything passes → go to DRY RUN.
  3. Otherwise for EACH failing step: read the log (and for e2e: error-context.md / trace / screenshot).
     Triage → fix → record in QA_REPORT.md.
  4. Re-run only the failed step(s) with --only until green, then re-run the FULL suite (fixes can break other areas).
DRY RUN:
  5. Do NOT edit any file. Run: bash qa-kit/scripts/qa/dry-run.sh 2
  6. If it fails even once → bugs exist: go back to step 3 (the clean streak resets).
  7. If it prints "DRY RUN CLEAN" → finish: write final QA_REPORT.md, commit.
```

## Triage rules

| Class | Symptom | Action |
|---|---|---|
| **A. Product bug** | Behaviour contradicts `docs/04`/`05` | Fix the application code (root cause, smallest change). |
| **B. Missing feature / contract gap** | Missing endpoint, testid, validation message, index | Implement it per docs. |
| **C. Test bug** | Test asserts something the docs do not require, wrong selector, wrong fixture | Fix the test **only** if you can cite the doc section proving it wrong; note it in QA_REPORT. |
| **D. Flaky / timing** | Passes sometimes, order-dependent, race | Find the real cause (missing `await expect`, shared data, non-unique data, unawaited mutation, cache). Use web-first assertions. Never add sleeps or retries. |
| **E. Environment** | DB down, port busy, missing browser, wrong `.env.e2e` | Fix the setup; document in README. |

When unsure between A and C, **the docs decide**; if docs are silent, choose the safer behaviour (stricter validation, deny by default) and document the decision in `TECHNICAL_NOTES.md`.

## Guardrails (hard rules)
- Never delete, skip (`skip`, `fixme`, `todo`), focus (`.only`), or weaken an assertion to get green. Never raise timeouts or Playwright `retries` to hide a failure. Never use `waitForTimeout`.
- Never change `docs/` to match a bug. Spec changes need an explicit decision note.
- Never mock the backend inside Playwright except the tests that intentionally do (`dashboard` real-data proof, list error/skeleton states).
- Fix root causes, not symptoms: a 500 means find the exception in `storage/logs/laravel.log`, not catch-and-hide it.
- After fixing, add a regression test if no existing test would have caught the bug.
- One bug (or tightly related group) per commit: `Fix <what> (QA-007)`.
- Same failure 3 times → stop patching; re-read the log, the trace, the relevant doc, and reconsider the design. If still blocked after 15 iterations, stop and report blockers instead of looping.
- Do not touch unrelated code, dependencies or formatting during the loop.
- Keep secrets out of logs/commits; `qa-logs/`, `qa-kit/e2e/test-results/`, `qa-kit/e2e/playwright-report/`, `.env.e2e` stay git-ignored.

## Debugging Playwright failures (headless, as an AI)
1. `qa-logs/latest/e2e.log` for the failing test title + assertion.
2. `qa-kit/e2e/test-results/<test>/error-context.md` (DOM snapshot at failure) and `*.png`.
3. `npx playwright show-trace qa-kit/e2e/test-results/<test>/trace.zip` is interactive; instead inspect `playwright.json` for the failing step, and re-run one test: `npx playwright test -c qa-kit/e2e/playwright.config.ts qa-kit/e2e/tests/orders-status.spec.ts -g "cancel" --reporter=list`.
4. Check backend log `storage/logs/laravel.log` and network failures printed by the fixture (console errors fail the test).
5. If a `getByTestId` is missing → class B (add the testid) — not a reason to change the selector to CSS.

## Debugging Pest failures
`./vendor/bin/pest --filter "name" -vvv`; add `->dump()` on responses temporarily (remove before commit; static-checks fails on `dump`). Check assumptions listed at the top of each test file against your actual factories/DTOs and align the **implementation** to the documented contract first.

## Extra exploratory checks during the dry run
Run these by hand (read-only) and treat any finding as a bug:
- `php artisan route:list --path=api` vs endpoints in `docs/04-api-spec.md` (missing/extra routes, missing middleware).
- `php artisan migrate:fresh --seed` completes and counts match (5 users, 100 customers, 50 products, 500+ orders).
- Tab through the UI as Admin, Manager, Staff at 375px and 1280px; verify no console errors, no horizontal scroll, every list has loading/empty/error states.
- `git status` clean, `.env` not tracked, README commands copy-paste work from a fresh clone.

## QA_REPORT.md format (create at repo root)
```
# QA Report
Date / commit: ...
## Summary
Iterations: N · Bugs fixed: N · Final dry run: PASS ×2 (attempt IDs)
## Bugs
| ID | Class | Symptom | Root cause | Fix (commit) | Regression test |
|----|-------|---------|-----------|-------------|-----------------|
| QA-001 | A | ... | ... | ... | tests/Feature/... |
## Tests changed (class C) with justification
## Known limitations / not covered
```

## Definition of done
`bash qa-kit/scripts/qa/dry-run.sh 2` ends with `DRY RUN CLEAN`, `QA_REPORT.md` committed, README "Testing" section lists the commands.
