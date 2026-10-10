#!/usr/bin/env bash
# Full QA run. Usage:
#   qa-kit/scripts/qa/run-all.sh [--only step[,step]] [--random] [--repeat N]
# Steps: backend_lint backend_static seed_check backend_pest frontend_lint frontend_types frontend_unit frontend_build e2e
# Env:   SKIP_E2E=1 to skip Playwright.  Exit code 1 if any step fails.
# Run from anywhere: the script cd's to the monorepo (Laravel) root.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"
bash qa-kit/scripts/qa/preflight.sh || exit $?

ONLY=""; RANDOM_ORDER=0; REPEAT=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --only)   ONLY="$2"; shift 2 ;;
    --random) RANDOM_ORDER=1; shift ;;
    --repeat) REPEAT="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

STAMP="$(date +%Y%m%d-%H%M%S)"
LOG="$ROOT/qa-logs/$STAMP"
mkdir -p "$LOG"
ln -sfn "$LOG" "$ROOT/qa-logs/latest"

NAMES=(); STATUSES=(); DURATIONS=()
should_run() { [[ -z "$ONLY" || ",$ONLY," == *",$1,"* ]]; }

step() {
  local name="$1"; shift
  should_run "$name" || return 0
  printf '▶ %-16s ' "$name"
  local start=$SECONDS
  if "$@" >"$LOG/$name.log" 2>&1; then
    printf 'PASS (%ss)\n' $((SECONDS - start)); STATUSES+=("pass")
  else
    printf 'FAIL (%ss) → %s\n' $((SECONDS - start)) "qa-logs/latest/$name.log"; STATUSES+=("fail")
  fi
  NAMES+=("$name"); DURATIONS+=($((SECONDS - start)))
}

backend_lint()   { ./vendor/bin/pint --test; }
backend_static() {
  if [[ -x vendor/bin/phpstan ]]; then ./vendor/bin/phpstan analyse --memory-limit=1G --no-progress
  else echo "phpstan not installed - skipped"; fi
}
seed_check()     { APP_ENV=e2e php artisan migrate:fresh --seed --force; }
backend_pest() {
  local extra=()
  [[ "$RANDOM_ORDER" == "1" ]] && extra+=(--order-by=random)
  ./vendor/bin/pest --compact ${extra[@]+"${extra[@]}"}
}
# Monorepo: React lives in packages/OMS/Admin/src/Resources/assets and is driven by the ROOT package.json (npm scripts)
frontend_lint()  { npm run lint --silent; }
frontend_types() { npm run typecheck --silent && { [[ ! -f qa-kit/e2e/tsconfig.json ]] || npm run typecheck:e2e --silent; }; }
frontend_unit()  { npm run test:unit --silent; }
frontend_build() { npm run build --silent && BUILD_OK=1; }
e2e() {
  # reuse the build from this run when frontend_build just passed; otherwise global-setup rebuilds it
  [[ "${BUILD_OK:-0}" == "1" ]] && export E2E_SKIP_BUILD=1
  PLAYWRIGHT_JSON_OUTPUT_NAME="$LOG/playwright.json" \
  npx playwright test -c qa-kit/e2e/playwright.config.ts --repeat-each="$REPEAT" --reporter=list,json,html
}

step backend_lint   backend_lint
step backend_static backend_static
step seed_check     seed_check
step backend_pest   backend_pest
step frontend_lint  frontend_lint
step frontend_types frontend_types
step frontend_unit  frontend_unit
step frontend_build frontend_build
if [[ "${SKIP_E2E:-0}" != "1" ]]; then step e2e e2e; fi

# summary.json
{
  printf '{\n  "timestamp": "%s",\n  "steps": [\n' "$STAMP"
  for i in "${!NAMES[@]}"; do
    sep=","; [[ $i -eq $((${#NAMES[@]} - 1)) ]] && sep=""
    printf '    {"name": "%s", "status": "%s", "seconds": %s}%s\n' "${NAMES[$i]}" "${STATUSES[$i]}" "${DURATIONS[$i]}" "$sep"
  done
  printf '  ]\n}\n'
} > "$LOG/summary.json"

failed=0
for s in "${STATUSES[@]}"; do [[ "$s" == "fail" ]] && failed=1; done
if [[ $failed -eq 1 ]]; then
  echo; echo "✘ FAILURES FOUND. Read logs in qa-logs/latest/, fix root causes, re-run."; exit 1
fi
echo; echo "✔ All steps passed."; exit 0
