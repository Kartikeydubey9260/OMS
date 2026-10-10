#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
if [[ ! -f "$ROOT/artisan" || ! -f "$ROOT/composer.json" ]]; then
  echo "QA preflight failed: expected a Laravel project root containing both artisan and composer.json at: $ROOT" >&2
  echo "Keep qa-kit/ at the project root and run this script from the kit; do not overlay its contents." >&2
  exit 1
fi
echo "QA preflight passed: Laravel project root found at $ROOT"
