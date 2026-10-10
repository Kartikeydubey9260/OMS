# 02 — Architecture (OMS)

## Decision summary
- Laravel 12 package-first backend under `packages/OMS/*`, mirroring the verified Bagisto package conventions under `packages/Webkul/*`.
- One Git monorepo contains Laravel, package-owned React frontend assets, tests, docs and build tooling.
- React + TypeScript is the default; use `.tsx` / `.ts` for new frontend code.
- Product UI lives in React components. Blade is only an optional minimal SPA mount shell.
- The package list and dependency graph below are **pre-approved**; do not ask permission to use them.

## Required package conventions
Every package must contain `src/Providers/<Package>ServiceProvider.php`, `src/Config/`, `src/Contracts/`, `src/Models/`, `src/Proxies/`, `src/Repositories/`, `src/Http/Controllers/`, `src/Http/Requests/`, `src/Http/Resources/`, `src/Routes/`, `src/Database/Migrations/`, `src/Database/Seeders/`, `src/Database/Factories/`, `src/Events/`, `src/Listeners/`, `src/Jobs/`, `src/Resources/lang/`, `src/Resources/views/`, `src/Resources/assets/`, and package-root `tests/`. Keep empty convention directories with `.gitkeep` until populated. Add `src/Providers/EventServiceProvider.php` when package event/listener mappings are registered. This required structure is an OMS convention inspired by Bagisto, not a claim that Laravel itself mandates every directory. Any deviation must be recorded in `docs/12-architecture-decisions.md`.

Each package is mapped in root `composer.json` under `autoload.psr-4`, e.g. `"OMS\Orders\": "packages/OMS/Orders/src"`. Laravel 12 internal package providers are registered in `bootstrap/providers.php`. Each provider registers the package's routes, migrations, views, translations and config. Package-owned migrations/seeders/factories stay under `src/Database/`.

## Concrete package ownership (pre-approved)
| Package | Responsibility | Owned tables / primary models | Routes | Seeders / factories | Policies, events and listeners |
|---|---|---|---|---|---|
| `Core` | Shared audit trail, shared support and cross-domain infrastructure only | `audit_logs` / `AuditLog`; `AuditLogger` service | Internal health/diagnostic routes only if needed; no business routes | `CoreSeeder` only for core reference data; `AuditLogFactory` | `AuditLogPolicy`; `AuditLogged` event and audit-related listeners/jobs |
| `Users` | Authentication identity, roles, permissions and staff accounts | `users`, Spatie permission tables / `User` | `/api/auth/*`, `/api/users/*`, `/api/roles/*` | `RolePermissionSeeder`; `UserFactory` | `UserPolicy`, `RolePolicy`; user/role/permission change events/listeners |
| `Customers` | Customer records and customer-facing contact details | `customers` / `Customer` | `/api/customers/*` | `CustomerSeeder` if required; `CustomerFactory` | `CustomerPolicy`; customer lifecycle events/listeners |
| `Products` | Product catalog, SKU, descriptions, unit price, active status and the schema-defined `stock_quantity` / `low_stock_threshold` columns | `products` / `Product` | `/api/products/*` | `ProductSeeder` if required; `ProductFactory` | `ProductPolicy`; product lifecycle events/listeners |
| `Inventory` | Owns the stock mutation/reservation workflow and concurrency-safe inventory use cases; it operates on the schema-defined `products.stock_quantity` field and does not introduce extra tables | No additional tables; uses the `Product` contract/model through an explicit dependency | `/api/inventory/*` | No additional factories/seeders required by the current schema | `InventoryPolicy`; stock reserved/released/adjusted events and listeners |
| `Orders` | Order aggregate, items, pricing snapshot, status workflow and status history | `orders`, `order_items`, `order_status_histories`, `order_notes`, `order_activities` / `Order`, `OrderItem`, `OrderStatusHistory`, `OrderNote`, `OrderActivity`; `OrderStatus` and `OrderPriority` enums | `/api/orders/*`, `/api/reports/*` for order-based reporting | `OrderSeeder` if required; `OrderFactory`, `OrderItemFactory` | `OrderPolicy`; order created/updated/status-transition events/listeners/jobs |
| `Admin` | React admin shell integration, menu metadata and admin-only frontend assets; no domain ownership | No domain tables; consumes Users and domain API endpoints | SPA fallback/mount route only; no duplicate domain API routes | No business seeders/factories | No domain policies/events; UI permission presentation follows API authorization |
| `API` | API-wide versioning, response resources, API middleware and cross-package route composition | No domain tables/models | API route aggregation and shared API middleware; domain routes remain owned by their domain package | No business seeders/factories | Shared API exception/response handling; no domain event ownership |

The unchanged schema places `stock_quantity` and `low_stock_threshold` on `products`. The Products package owns the product row and schema; the Inventory package owns the stock mutation/reservation workflow and must be the only application service that changes stock as part of order operations. Do not add inventory tables unless a future explicitly approved schema change requires them. Order creation consumes Inventory through its public contract/service.

## Dependency direction (acyclic, pre-approved)
```text
Core
 ↑       ↑        ↑
Users  Customers  Products
                    ↑
                Inventory
                    ↑
                  Orders
                    ↑
                   API
                    ↑
                  Admin UI
```
Allowed direct dependencies: `Users → Core`; `Customers → Core`; `Products → Core`; `Inventory → Core + Products`; `Orders → Core + Users + Customers + Products + Inventory`; `API → Core + Users + Customers + Products + Inventory + Orders`; `Admin → API` (frontend integration only). Arrows in the diagram mean “depends on” when read from the package named on the lower row to its dependency above; the explicit list is authoritative. No package may depend on `Admin`; no circular dependencies. Cross-domain events/contracts may be used to reduce coupling.

## Runtime flow
Browser → React Router → typed React components → TanStack Query/API client → Laravel API route owned by a domain package → Form Request → Policy → thin Controller → package service/use case → transaction/database → events/jobs as appropriate.

## Monorepo layout
```text
packages/OMS/<Package>/src/{Providers,Config,Contracts,Models,Proxies,Repositories,Http/{Controllers,Requests,Resources},Routes,Database/{Migrations,Seeders,Factories},Events,Listeners,Jobs,Resources/{lang,views,assets}}
packages/OMS/<Package>/tests/
packages/OMS/Admin/src/Resources/assets/app.tsx
bootstrap/providers.php
config/
tests/                         # cross-package integration tests
composer.json                  # root PSR-4 mappings and shared dependencies
package.json                   # single root frontend/tooling manifest
vite.config.ts
 tsconfig.json
```

## Registration and dependencies
- Root Composer maps each `OMS\<Package>\` namespace to `packages/OMS/<Package>/src`.
- Laravel 12 registers internal package service providers in `bootstrap/providers.php`. A standalone Composer-distributed package may additionally use `extra.laravel.providers` auto-discovery; internal OMS packages use the explicit root registration list.
- Use one root `composer.json` and one root `package.json`. No nested manifests.
- Keep root Laravel files for framework bootstrap, global config and integration, not as the default home for domain code.

## Key engineering decisions
| Concern | Decision | Reason |
|---|---|---|
| Backend organization | Required `packages/OMS/*` conventions | Consistent ownership and Bagisto-style modularity |
| Frontend | React + TypeScript under Admin package assets | Same monorepo, package-owned UI |
| Provider registration | `bootstrap/providers.php` on Laravel 12 | Supported Laravel 12 registration mechanism |
| Data access | Contracts, repositories and proxies are required conventions | Consistent seams for package boundaries and model extension |
| UI rendering | React components; Blade shell only | Product UI must not be Blade-driven |
| Money | DECIMAL columns and decimal-safe arithmetic | Avoid floating-point errors |
| Inventory | Transaction + row locks through Inventory package | Prevent overselling and keep stock ownership clear |
| Tests | Pest/PHPUnit + Vitest/RTL + Playwright | Package and cross-package coverage |

## Request flow example
1. A package-owned route accepts `POST /api/orders/{id}/status`.
2. Form Request validates input and invokes authorization.
3. Policy verifies role, assignment and allowed transition.
4. Thin package controller calls the Orders service.
5. A transaction locks the order and calls Inventory for stock rules, then writes history/audit records.
6. After commit, events and queued listeners handle notifications.
7. API Resource returns the documented response envelope.

## Scale and security
Use indexed filters, eager loading, bounded pagination, decimal-safe pricing, backend authorization, safe uploads, rate limits and structured audit logging. Preserve the schema/API/business-rule contracts in docs/00–05.
