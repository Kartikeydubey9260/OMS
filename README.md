# OMS — Laravel package monorepo + React

This folder is a standalone planning/tooling variant; it is intentionally separate from `vueOMS/`. It is not a completed or scaffolded application.

## Authoritative decisions
- Laravel 12, PHP 8.2+, MySQL 8, Node 20.19+, Sanctum 4, Spatie Laravel Permission 6.
- Package-first backend in `packages/OMS/{Core,Users,Customers,Products,Inventory,Orders,Admin,API}` with required Bagisto-style directories and `OMS\<Package>\` namespaces.
- React + TypeScript UI in `packages/OMS/Admin/src/Resources/assets/app.tsx`; Blade only as an optional SPA mount shell. `resources/js/` is not used for frontend source.
- One root `composer.json`, one root `package.json`, providers registered in Laravel 12 `bootstrap/providers.php`.
- Read `AGENTS.md` first; it is canonical. Package ownership and dependency graph: `docs/02-architecture.md`. Pinned setup commands: `docs/11-monorepo-setup.md`. Shared test assumptions: `docs/13-test-contract.md`.

## Use
The `monorepo-template/` folder contains reference configuration/manifests to merge into a clean Laravel 12 project created in this folder. It does not contain a scaffolded product application. QA scripts are tooling templates and must be run only in the eventual project root, after the referenced app files exist.

## QA kit location

Keep `qa-kit/` at the project root; do not copy or overlay its contents. Run checks from the project root, for example `bash qa-kit/scripts/qa/run-all.sh` or `make -f qa-kit/Makefile qa`. Before using the kit Pest bootstrap, move existing shared helpers to `tests/Support/`, then copy it with `cp qa-kit/tests/Pest.php tests/Pest.php`.
