#!/usr/bin/env bash
# DRY RUN = verification only, NO code edits.
# Requires N consecutive clean full passes (default 2). Any failure exits 1 immediately:
# fix the bug, then start the dry run again from scratch.
#   qa-kit/scripts/qa/dry-run.sh [N]        env: MAX_DRY_ATTEMPTS (default 6)
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

NEEDED="${1:-2}"; MAX="${MAX_DRY_ATTEMPTS:-6}"; clean=0; attempt=0

tree_hash() {
  if git rev-parse --git-dir >/dev/null 2>&1; then
    { git rev-parse HEAD 2>/dev/null; git status --porcelain; git diff; } | sha1sum | cut -d' ' -f1
  else echo "no-git"; fi
}

BEFORE="$(tree_hash)"
while (( clean < NEEDED )); do
  attempt=$((attempt + 1))
  if (( attempt > MAX )); then echo "✘ exceeded MAX_DRY_ATTEMPTS=$MAX"; exit 1; fi
  echo "════ dry run attempt $attempt — clean streak $clean/$NEEDED ════"

  if ! bash qa-kit/scripts/qa/static-checks.sh; then
    echo "✘ BUGS FOUND (static checks). Fix, then restart: bash qa-kit/scripts/qa/dry-run.sh $NEEDED"; exit 1
  fi
  # random test order exposes order dependence; repeat-each=2 exposes flaky e2e tests
  if ! bash qa-kit/scripts/qa/run-all.sh --random --repeat 2; then
    echo "✘ BUGS FOUND. Fix root causes, then restart: bash qa-kit/scripts/qa/dry-run.sh $NEEDED"; exit 1
  fi
  AFTER="$(tree_hash)"
  if [[ "$AFTER" != "$BEFORE" ]]; then
    echo "✘ The dry run changed tracked files (snapshots, generated code, lockfiles?). Tests must not modify the tree."
    git status --short; exit 1
  fi
  clean=$((clean + 1))
done

mkdir -p qa-logs
printf 'DRY RUN CLEAN\ncommit: %s\ndate: %s\nconsecutive clean passes: %s\n' \
  "$(git rev-parse --short HEAD 2>/dev/null || echo n/a)" "$(date -Is)" "$NEEDED" | tee qa-logs/DRY_RUN_OK
