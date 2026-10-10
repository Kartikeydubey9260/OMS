# 11 — Monorepo setup (OMS: Laravel 12 packages + React)

## Pinned baseline (pre-approved)
- PHP `^8.2` (PHP 8.2 or newer compatible with Laravel 12)
- Laravel Framework `^12.0`; Laravel 12 package providers are registered in `bootstrap/providers.php`
- MySQL `8.0+`
- Node.js `20.19+` and npm bundled with Node
- Laravel Sanctum `^4.0`
- Spatie Laravel Permission `^6.0`
- Pest `^3.8`, `pestphp/pest-plugin-laravel ^3.2`, PHPUnit `^11.0`
- Laravel Pint `^1.24`; Larastan `^3.0`
- React `^18.3`, TypeScript `^5.9`, Vite `^6.4`, Vitest `^2.1`, Playwright `^1.56`, Tailwind CSS `^4.1`

These versions and the package list below are pre-approved. Do not stop to ask about them. Preserve `docs/00–05` requirements.

## Concrete package map (pre-approved)
| Package | Responsibility and owned tables/models | Route ownership | Seeder/factory, policy and event ownership | Dependencies |
|---|---|---|---|---|
| `Core` | Cross-cutting support; `audit_logs` / `AuditLog`, `AuditLogger` | Internal diagnostics only; no business routes | `CoreSeeder` only for core reference data, `AuditLogFactory`; `AuditLogPolicy`; audit events/listeners/jobs | None |
| `Users` | Identity, staff, roles and permissions; `users` plus Spatie permission tables / `User` | `/api/auth/*`, `/api/users/*`, `/api/roles/*` | `RolePermissionSeeder`, `UserFactory`; user/role policies and lifecycle events/listeners | Core |
| `Customers` | Customer records; `customers` / `Customer` | `/api/customers/*` | `CustomerFactory`, optional `CustomerSeeder`; `CustomerPolicy`; customer events/listeners | Core |
| `Products` | Product catalog and schema-defined stock fields; `products` / `Product` | `/api/products/*` | `ProductFactory`, optional `ProductSeeder`; `ProductPolicy`; product events/listeners | Core |
| `Inventory` | Concurrency-safe stock mutation/reservation workflow; no additional tables in the current schema, operates on `products.stock_quantity` | `/api/inventory/*` | No extra factory/seeder required by current schema; `InventoryPolicy`; stock events/listeners | Core, Products |
| `Orders` | Order aggregate, items, status history, notes and activity; `orders`, `order_items`, `order_status_histories`, `order_notes`, `order_activities` and matching models/enums | `/api/orders/*`, order-based `/api/reports/*` | `OrderFactory`, `OrderItemFactory`, optional `OrderSeeder`; `OrderPolicy`; order lifecycle/status events/listeners/jobs | Core, Users, Customers, Products, Inventory |
| `Admin` | React admin UI and SPA integration; no domain tables | SPA fallback/mount route only; no duplicate domain API | No business seeders/factories/policies/events | API (frontend integration only) |
| `API` | Shared API versioning, middleware, response/exception handling; no domain tables | API route aggregation; domain endpoints remain owned by domain packages | No business seeders/factories/policies/events | Core, Users, Customers, Products, Inventory, Orders |

Dependency direction is acyclic: `Users → Core`, `Customers → Core`, `Products → Core`, `Inventory → Core + Products`, `Orders → Core + Users + Customers + Products + Inventory`, `API → Core + Users + Customers + Products + Inventory + Orders`, and `Admin → API` only. The unchanged schema keeps `stock_quantity` on `products`; Inventory owns the stock mutation workflow, not a new inventory table. See `docs/02-architecture.md` for the complete route/model/event details and diagram.

## Install commands
These are the exact commands for a clean implementation root. This archive is documentation, not an empty Laravel root: do not run `create-project` inside this documentation pack. Initialize a Laravel 12 skeleton in the selected variant worktree first, then merge this variant’s docs/tooling into that root. If the implementation root is empty, the first command creates the skeleton there; if it already contains the docs, merge a clean skeleton instead of rerunning `create-project`. Never work in the parent pack or the other variant.
```bash
composer create-project laravel/laravel:^12.0 .
composer require laravel/sanctum:^4.0 spatie/laravel-permission:^6.0
composer require --dev pestphp/pest:^3.8 pestphp/pest-plugin-laravel:^3.2 phpunit/phpunit:^11.0 laravel/pint:^1.24 larastan/larastan:^3.0 --with-all-dependencies
php artisan pest:install
# QA kit remains under qa-kit/; do not overlay it onto the project root.
# Move existing Pest helpers to tests/Support/ before installing this bootstrap.
cp qa-kit/tests/Pest.php tests/Pest.php
npm install react@^18.3 react-dom@^18.3 react-router-dom@^6 @tanstack/react-query@^5 react-hook-form@^7 zod@^4 recharts@^2
npm install -D typescript@^5.9 vite@^6.4 laravel-vite-plugin@^1 @vitejs/plugin-react@^4 vitest@^2 jsdom@^27 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14 @playwright/test@^1.56 @axe-core/playwright@^4 eslint@^9 @eslint/js@^9 eslint-plugin-react-hooks@^5 typescript-eslint@^8 @types/node@^22.18 prettier@^3 tailwindcss@^4 @tailwindcss/vite@^4 concurrently@^9
composer dump-autoload
```
`monorepo-template/composer.json` and `monorepo-template/package.json` contain the reference manifest shape; `composer.scripts.json` mirrors the scripts for review only and must not become a second Composer manifest. Keep exactly one root `composer.json` and one root `package.json` in the actual monorepo.

## Required layout
```text
packages/OMS/{Core,Users,Customers,Products,Inventory,Orders,Admin,API}/src/
packages/OMS/<Package>/src/{Providers,Config,Contracts,Models,Proxies,Repositories,Http/{Controllers,Requests,Resources},Routes,Database/{Migrations,Seeders,Factories},Events,Listeners,Jobs,Resources/{lang,views,assets}}
packages/OMS/<Package>/tests/
packages/OMS/Admin/src/Resources/assets/app.tsx
bootstrap/providers.php
composer.json
package.json
vite.config.ts
tsconfig.json
phpunit.xml
qa-kit/scripts/qa/
qa-kit/e2e/{tests,support}/
qa-kit/tests/{Feature,Unit}/
tests/                         # cross-package integration tests
```
The package structure is mandatory. Add `.gitkeep` in initially empty convention directories. `Admin` owns the React UI entry; do not put frontend source under `resources/js/`. Blade is only an optional SPA mount shell.

## Composer and provider registration
- Root `composer.json` maps `OMS\Core\`, `OMS\Users\`, `OMS\Customers\`, `OMS\Products\`, `OMS\Inventory\`, `OMS\Orders\`, `OMS\Admin\`, and `OMS\API\` to each package's `src` directory.
- Register each internal provider in Laravel 12 `bootstrap/providers.php`; providers register their own routes, migrations, views, translations and config.
- Package-level `composer.json` files are not used for this internal monorepo. Do not add nested Composer or npm manifests.
- The model/contracts/repositories/proxies conventions are mandatory for OMS even where a simple implementation could technically work without them.

## Scripts and verification
`composer.scripts.json` mirrors root Composer scripts. Expected npm scripts: `dev`, `build`, `typecheck`, `typecheck:e2e`, `test:unit`, `test:watch`, `lint`, `format`, `format:check`, `e2e`. Expected Composer scripts: `setup`, `dev`, `build`, `lint`, `fix`, `analyse`, `test`, `test:unit`, `test:e2e`, `qa`, `qa:dry`.

Run from the root:
```bash
composer install
npm install
php artisan key:generate
php artisan migrate --seed
composer test
composer lint
composer analyse
npm run typecheck && npm run typecheck:e2e
npm run test:unit && npm run build && npm run e2e
bash qa-kit/scripts/qa/static-checks.sh
```
Ensure root `phpunit.xml` includes `qa-kit/tests/Feature` and `qa-kit/tests/Unit`; Pest loads the root `tests/Pest.php` bootstrap. The QA kit remains in place; never overlay it onto the root.

Pest/PHPUnit must discover root `tests/`, every `packages/OMS/*/tests/` suite (OMS variant), and the retained `qa-kit/tests/` suite. The vueOMS variant has no package test roots, so it discovers root `tests/` plus `qa-kit/tests/`. Read `docs/13-test-contract.md` before modifying shared helpers, factory names/states, seeder FQCNs or test model namespaces.

## Reference research
The required package convention is based on the live [Bagisto repository](https://github.com/bagisto/bagisto), [Bagisto architecture overview](https://devdocs.bagisto.com/architecture/overview.html), [backend architecture](https://devdocs.bagisto.com/architecture/backend), and [package-development guide](https://devdocs.bagisto.com/package-development/getting-started.html). These document `packages/Webkul/*`, root PSR-4 mappings, `src/Providers`, `src/Contracts`, `src/Models`, `src/Proxies`, `src/Repositories`, `src/Http`, `src/Database`, `src/Resources/assets`, and package test suites. Bagisto-specific details are treated as OMS project conventions where specified, not universal Laravel requirements.
