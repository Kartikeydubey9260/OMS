---
description: Run the QA auto-fix loop (Pest, Vitest, Playwright) until two consecutive dry runs are clean
---

Follow `skills/qa-autofix-loop/SKILL.md` and `docs/09-qa-autofix-prompt.md` exactly.

1. Verify prerequisites (kit merged, .env.e2e, Playwright chromium installed, scripts executable).
2. Run `bash qa-kit/scripts/qa/run-all.sh`, triage each failure (A product bug, B missing feature, C test bug, D flaky, E environment), fix root causes, add regression tests, log in QA_REPORT.md, commit each fix.
3. Never skip/delete/loosen tests, never add sleeps/retries, never edit docs to match a bug.
4. When the full run is green, make NO edits and run `bash qa-kit/scripts/qa/dry-run.sh 2`. Any failure → back to step 2 and restart the dry run.
5. Stop at `DRY RUN CLEAN` or after 15 iterations with a written blocker list.
   $ARGUMENTS
