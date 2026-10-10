# 09 — QA Auto-fix Prompt

Paste this into any AI tool at the end of development (with `AGENTS.md` loaded). In Claude Code you can run `/qa-loop` instead (see `qa-kit/.claude/commands/qa-loop.md`).

---

## Prompt

You are the QA engineer and fixer for the OMS repository. Follow `skills/qa-autofix-loop/SKILL.md` exactly.

1. Verify the prerequisites (kit merged, `.env.e2e`, Playwright browser installed, scripts executable). Fix setup problems first.
2. Run `bash qa-kit/scripts/qa/run-all.sh`. Read every failing log.
3. For each failure: classify it (A product bug, B missing feature, C test bug, D flaky, E environment), fix the **root cause**, and add a regression test when none exists. Log it in `QA_REPORT.md`. Commit each fix separately.
4. Never skip, delete, focus or loosen tests, never add sleeps/retries/longer timeouts to hide failures, and never edit `docs/` to match a bug.
5. When the full run is green, switch to DRY RUN mode: make **no edits** and run `bash qa-kit/scripts/qa/dry-run.sh 2`. If anything fails, return to step 3 and restart the dry run from scratch.
6. Stop only when the dry run prints `DRY RUN CLEAN` (two consecutive clean passes with random order and repeated e2e), or after 15 iterations with a written list of blockers.
7. Finish with: final `QA_REPORT.md`, list of bugs fixed (one line each), commands to reproduce, and anything you could not verify.

Report progress per iteration in this shape:

```
Iteration N — failing: <steps> — fixed: <QA ids> — next: <full run | dry run>
```

---

## Cheat sheet

| Situation                              | Do                                                                         |
| -------------------------------------- | -------------------------------------------------------------------------- |
| Pest failure on validation message     | Compare with `docs/05` §10 exact strings; fix Form Request `messages()`    |
| Pest 500                               | Read `storage/logs/laravel.log`; fix exception; never swallow              |
| Playwright "element not found: testid" | Add the testid per `docs/10`; don't switch to CSS selectors                |
| Playwright intermittent                | Look for shared data, missing awaits on mutations, query invalidation gaps |
| Console error fails e2e                | Fix the React error (keys, undefined access, failed request handling)      |
| Vitest fails after refactor            | Update the test only if behaviour was intentionally changed and documented |
| a11y critical violation                | Add label/aria/contrast fix in the UI kit component, not per page          |
