# 12 — Architecture decisions (ADR summary)

## Chosen variant: OMS

| Decision             | OMS choice                                                                           |
| -------------------- | ------------------------------------------------------------------------------------ |
| Backend organization | Laravel package-first under `packages/OMS/*`, inspired by Bagisto                    |
| Frontend             | React + TypeScript                                                                   |
| UI implementation    | React components; Blade only as optional mount shell                                 |
| Repository           | One Git repository for this variant; separate from sibling variant                   |
| Package manifests    | Root Composer/npm manifests by default; nested package manifests only when justified |
| Tests                | Pest/PHPUnit, frontend unit/component tests, Playwright for key flows                |

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

### ADR-0006: Web Guard as the Canonical Roles/Permissions Source

- **Context**: Spatie Permission requires a guard on each role/permission row. Tokens authenticate via the `sanctum` guard, so seeders created parallel `sanctum` rows to keep the app working; the old `GET /api/permissions` returned `Permission::all()`, which surfaced duplicate names (one per guard) and broke the strict-mode permissions modal (duplicate checkbox labels).
- **Decision**: The `web` guard is canonical for the users/roles UI. `GET /api/roles` and `GET /api/permissions` filter `guard_name = 'web'`; seeded `sanctum` rows remain only so Sanctum token requests can resolve the Spatie gate. The permissions modal checks `web` permissions only, and duplicate names can no longer appear.
- **Status**: Accepted & Applied.

### ADR-0007: Users & Roles Administration UI (Phase 3)

- **Context**: The assessment asks for user and role administration. The two-tab Users/Roles page adds role CRUD, a permission-assignment modal, live `users_count` per role (pivot count, not the cached Spatie count), and protected built-in roles (`admin`, `super-admin`) that cannot be edited or deleted.
- **Decision**: `GET /api/roles` appends `users_count` computed from the `model_has_roles` pivot (set via `setAttribute`, not a magic property write). Role create/update/delete go through `roles.manage` with backend protection for built-in roles and roles still assigned to users. The UI hides nothing security-relevant; backend authorization remains authoritative.
- **Status**: Accepted & Applied.

### ADR-0008: Per-Client / Per-Product Breakdowns Are Server-Driven Tables

- **Context**: The dashboard's Detailed Breakdown tables originally returned every matching row in one payload, unlike every other list in the app (search + sort + `page`/`per_page` + server-side pagination). Users asked for the same table behavior on the breakdowns.
- **Decision**: `GET /api/dashboard/reports` accepts `page`, `per_page` (≤100, default 10), `sort`, and `direction` for both detailed breakdowns. `ReportService::perCustomer()` / `perProduct()` keep a `$perPage = null` mode returning the full filtered collection — used unchanged by the export endpoint, which intentionally exports the full filtered dataset rather than the current page. Sort columns are whitelisted constants (`PER_CLIENT_SORTS`, `PER_PRODUCT_SORTS`); an unknown `sort` falls back to the default (`total_spent` / `total_revenue` desc) instead of erroring, mirroring the lenient sort behavior of the entity lists. The frontend keeps separate sort columns per view, resets the page on filter/view changes, and reuses the standard pagination control (per-page 5–100, page info, prev/next).
- **Status**: Accepted & Applied.

### ADR-0009: Revenue Trend Bar Chart with Definite Container Height

- **Context**: The day/week/month revenue trend bars used percentage heights inside a content-driven flex container, so `height: X%` resolved to the 8px minimum — every bar rendered identical, with only hover tooltips differing. Day labels also truncate to a few characters at 31 columns.
- **Decision**: The chart container has a fixed pixel height (`h-[260px]`); each column is `h-full` with a `flex-1` bar area and the bar still sized by percentage, which now resolves against a definite height and shows real up/down variation. The hover tooltip is anchored to the bar itself and shows `money · N orders · label` (the full date for day periods). Invisible tooltips caused a small `scrollWidth` residual before; measurements confirm the visible chart stays inside its card at 1440/1280/375 px with zero page-level overflow.
- **Status**: Accepted & Applied.

## Reference links

- Laravel packages: https://laravel.com/docs/packages
- Bagisto repository (relevant to OMS only): https://github.com/bagisto/bagisto
- Laravel documentation: https://laravel.com/docs
