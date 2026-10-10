#!/usr/bin/env bash
# Run only Playwright from the monorepo root (extra args go to playwright).
# Example: qa-kit/scripts/qa/e2e.sh e2e/tests/orders-status.spec.ts -g cancel
# Faster iteration without touching code: E2E_SKIP_BUILD=1 E2E_SKIP_SEED=1 qa-kit/scripts/qa/e2e.sh ...
cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && npx playwright test -c qa-kit/e2e/playwright.config.ts --reporter=list "$@"
