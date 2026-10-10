#!/usr/bin/env bash
# Run only the Pest suite from the monorepo root (extra args go to pest).
# Example: qa-kit/scripts/qa/pest.sh --filter "status transition"
cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && ./vendor/bin/pest "$@"
