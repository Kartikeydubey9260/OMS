ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST)))/..)
.PHONY: qa dry-run pest e2e static unit preflight

qa: preflight
	cd "$(ROOT)" && bash qa-kit/scripts/qa/run-all.sh

dry-run: preflight
	cd "$(ROOT)" && bash qa-kit/scripts/qa/dry-run.sh 2

pest: preflight
	cd "$(ROOT)" && bash qa-kit/scripts/qa/pest.sh

e2e: preflight
	cd "$(ROOT)" && bash qa-kit/scripts/qa/e2e.sh

static: preflight
	cd "$(ROOT)" && bash qa-kit/scripts/qa/static-checks.sh

unit: preflight
	cd "$(ROOT)" && npm run test:unit

preflight:
	cd "$(ROOT)" && bash qa-kit/scripts/qa/preflight.sh
