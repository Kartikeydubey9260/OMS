# 13 — Test contract (OMS)

This document is the shared contract for the retained QA tests. It records test assumptions only; it does not change the assessment requirements, API contract, schema or business rules. Implementations and tests must stay aligned with `docs/00–05`.

## Seeder and role contract

- Seeder FQCN: `OMS\Users\Database\Seeders\RolePermissionSeeder`.
- It must be idempotent (use `firstOrCreate`/`findOrCreate`) and create roles `admin`, `manager`, `staff` with the permissions documented in `skills/rbac-policies/SKILL.md`.
- `seedRoles()` clears Spatie's permission cache then seeds this class.

## Model FQCNs

- `OMS\Users\Models\User`
- `OMS\Customers\Models\Customer`
- `OMS\Products\Models\Product`
- `OMS\Orders\Models\Order`
- `OMS\Orders\Models\OrderItem`
- `OMS\Orders\Models\OrderStatusHistory`
- `OMS\Core\Models\AuditLog`
- `OMS\Core\Services\AuditLogger`
- Enums: `OMS\Orders\Enums\OrderStatus` and `OMS\Orders\Enums\OrderPriority`.

## Factory names and defaults

The models expose `factory()` through Laravel's `HasFactory` support and each model maps to its package factory under `OMS\<Package>\Database\Factories\` (use `newFactory()` on the model where Laravel's default discovery cannot infer the package path).

- `UserFactory`: default active user (`is_active=true`).
- `CustomerFactory`: valid default customer.
- `ProductFactory`: active product, price between 10 and 200, and default stock quantity 100 for test compatibility. The schema-defined `products.stock_quantity` field remains the stored stock value; Inventory owns the mutation workflow and tests should exercise that service boundary.
- `OrderFactory`: default status `pending`; creates 1–3 items in `afterCreating`; `stock_reserved=false`; `assigned_to=null`. Tests may explicitly override these defaults for a targeted scenario.
- `Order` factory states: `draft()`, `pending()`, `confirmed()`, `processing()`, `ready()`, `completed()`, `cancelled()`.
- `OrderItemFactory`: valid order/product relationship, quantity and price snapshot.

## Shared Pest helpers

`qa-kit/tests/Pest.php` defines `ALL_STATUSES`, `transitionMap()`, `seedRoles()`, `makeUser()`, `actingAsRole()`, `orderPayload()`, `createOrderViaApi()` and `setStatusViaApi()`. `transitionMap()` mirrors `docs/05-business-rules.md` and is not an alternate source of business rules.

## Response and money assertions

- Success response envelope: `{success, message, data[, meta, links]}`.
- Error envelope: `{success:false, message, code, errors}`.
- Money values in JSON may be strings or numbers; assertions may normalize values numerically. Production money arithmetic must not use floating-point storage/calculation.

## Test discovery

- Root tests are discovered from `tests/`.
- Package tests are discovered from `packages/OMS/*/tests/`; `monorepo-template/phpunit.xml` lists root tests, every package suite, and the retained QA-kit test suite. `composer test` invokes Pest using this root PHPUnit configuration. Root `composer.json` autoload-dev maps each package's test namespace.
- `pest()` uses the same PHPUnit test suite configuration; `qa-kit/scripts/qa/pest.sh` must run Pest from the monorepo root so both root and package tests are discovered.

## Pest bootstrap installation

Keep `qa-kit/` at the project root; never overlay its contents. Before copying the kit bootstrap, move existing shared helpers to `tests/Support/`, then run `cp qa-kit/tests/Pest.php tests/Pest.php`. The root `phpunit.xml` must discover `qa-kit/tests/Feature` and `qa-kit/tests/Unit` as separate suites.
