# 12 — Architecture decisions (ADR summary)

## Chosen variant: OMS

| Decision | OMS choice |
|---|---|
| Backend organization | Laravel package-first under `packages/OMS/*`, inspired by Bagisto |
| Frontend | React + TypeScript |
| UI implementation | React components; Blade only as optional mount shell |
| Repository | One Git repository for this variant; separate from sibling variant |
| Package manifests | Root Composer/npm manifests by default; nested package manifests only when justified |
| Tests | Pest/PHPUnit, frontend unit/component tests, Playwright for key flows |

## Architecture Decision Records (ADRs)

### ADR-0001: Preservation of QA Kit Structure at `qa-kit/`
- **Context**: The testing and QA automation suite resides in `qa-kit/`. Scripts in `qa-kit/scripts/qa/` resolve repository root via `../../..` and invoke commands directly at the project root.
- **Decision**: Retain `qa-kit/` at the variant root without moving or restructuring. `qa-kit/scripts/qa/preflight.sh` verifies `artisan` and `composer.json` at project root. `qa-kit/tests/Pest.php` is copied to `tests/Pest.php` during setup while existing helpers are preserved in `tests/Support/`.
- **Status**: Accepted & Applied.

### ADR-0002: Dependency Management and Engine Tolerance
- **Context**: Local Node.js version is v22.5.1, while certain package manifests specify higher patch/minor engines (`^22.13` or `^22.22`).
- **Decision**: Treat `EBADENGINE` warnings as non-fatal informational warnings as long as dependency resolution and builds succeed cleanly without `ERESOLVE` errors. Ensure all peer dependencies are compatible.
- **Status**: Accepted & Applied.

### ADR-0003: React Fast Refresh in Blade SPA Mount Shell
- **Context**: Vite React HMR requires `@viteReactRefresh` before loading the bundle assets via `@vite(...)`.
- **Decision**: Ensure `resources/views/app.blade.php` includes `@viteReactRefresh` immediately prior to `@vite(['resources/css/app.css', 'packages/OMS/Admin/src/Resources/assets/app.tsx'])`.
- **Status**: Accepted & Applied.

### ADR-0004: Tailwind CSS 4 Integration via `@tailwindcss/vite`
- **Context**: Tailwind CSS v4 replaces separate `postcss` and `autoprefixer` configuration files with native Vite plugin architecture.
- **Decision**: Avoid legacy `postcss.config.js` and redundant `autoprefixer`/`postcss` devDependencies. Rely on `@tailwindcss/vite` configured in `vite.config.ts` and `@import "tailwindcss";` in `resources/css/app.css`.
- **Status**: Accepted & Applied.

### ADR-0005: Database Platform Deviation — MariaDB 10.4 Compatibility
- **Context**: The technical assessment requires MySQL 8.0+. The host system provides MariaDB 10.4.28 (XAMPP). MariaDB 10.4 does not support MySQL 8-only features (e.g., functional/expression indexes, JSON table functions, specific CHECK constraint enforcement syntax).
- **Decision**: Retain MariaDB 10.4.28 for local development and testing, maintaining strictly portable schema migrations (standard B-tree indexes, composite indexes, standard foreign keys, decimal precision, InnoDB engine). Avoid MySQL 8-specific DDL syntax. Record as an environment deviation in all delivery reports.
- **Status**: Accepted & Applied.

## Reference links
- Laravel packages: https://laravel.com/docs/packages
- Bagisto repository (relevant to OMS only): https://github.com/bagisto/bagisto
- Laravel documentation: https://laravel.com/docs

