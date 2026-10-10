# Laravel backend skill — OMS

Read `AGENTS.md` and `docs/02-architecture.md` first. These are authoritative.

## Common requirements

- Use the Laravel version selected by the project; verify version-specific APIs before relying on them.
- Thin controllers, Form Requests, API Resources, Policies/Gates, safe validation, consistent errors and meaningful tests.
- Use database transactions for critical multi-write operations.
- Recalculate pricing server-side; use decimal-safe money handling.
- Protect stock updates against concurrency with appropriate transactions and row locks.
- Keep status transition rules centralized and tested.
- Record audit/history data consistently with the state change.
- Use events/jobs/queues only where appropriate; dispatch post-commit side effects safely.
- Do not claim tests passed unless they were run.

## Project organization

Use package-first feature ownership under `packages/OMS/*`. Each package registers its own routes/resources through a service provider. Root Laravel directories are for framework bootstrap, global configuration and integration. Internal packages may use root Composer PSR-4 mappings; separate package manifests are only required when independent distribution/dependency boundaries justify them.

## Authorization

The backend is the source of truth. Check policy authorization for every sensitive operation. Frontend button visibility is not access control.

## Required package conventions (pre-approved)

Every `packages/OMS/<Package>/` uses `src/Providers`, `Config`, `Contracts`, `Models`, `Proxies`, `Repositories`, `Http/{Controllers,Requests,Resources}`, `Routes`, `Database/{Migrations,Seeders,Factories}`, `Events`, `Listeners`, `Jobs`, `Resources/{lang,views,assets}` and package-root `tests/`. Do not treat repositories, contracts or proxies as optional in this project: these are required OMS conventions inspired by Bagisto. Laravel itself does not require every directory. Record any deviation as an ADR in `docs/12-architecture-decisions.md`.

Register Laravel 12 internal package providers in `bootstrap/providers.php`; root `composer.json` maps each `OMS\\<Package>\\` namespace to `packages/OMS/<Package>/src`. Follow `docs/02-architecture.md` for the pre-approved package ownership and acyclic dependency graph. Follow `docs/13-test-contract.md` for test FQCNs, factories, states and seeders.
