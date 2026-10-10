# Monorepo template notes — OMS

Canonical instructions: `AGENTS.md`, `docs/02-architecture.md`, and `docs/11-monorepo-setup.md`.

This reference template is tooling/configuration guidance, not a completed application. OMS uses required Laravel package conventions under `packages/OMS/<Package>/src/`, with root Composer PSR-4 mappings and Laravel 12 providers registered in `bootstrap/providers.php`. React + TypeScript source is fixed at `packages/OMS/Admin/src/Resources/assets/app.tsx`; the Vite alias `@` points to this directory. Do not use `resources/js/` for frontend source. Blade is only an optional SPA mount shell, never product UI.

## QA kit location

Keep `qa-kit/` at the project root; do not copy or overlay its contents. Run checks from the project root, for example `bash qa-kit/scripts/qa/run-all.sh` or `make -f qa-kit/Makefile qa`. Before using the kit Pest bootstrap, move existing shared helpers to `tests/Support/`, then copy it with `cp qa-kit/tests/Pest.php tests/Pest.php`.
