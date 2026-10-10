# 06 — Implementation Plan (5 days, MVP-first) — OMS

Rule: complete a phase's exit criteria and commit before moving on. Read `AGENTS.md`, `docs/02-architecture.md` and `docs/11-monorepo-setup.md` first. Do not start in the parent dual-pack directory or sibling variant.

## Phase 0 — Setup (½ day)
**Skills:** `monorepo-tooling`, `laravel-backend`, `react-frontend` **Docs:** 02, 11
- Scaffold Laravel only inside this variant's project root.
- Use package-first Laravel structure under `packages/OMS/*`; keep root Laravel shell thin.
- Configure React + TypeScript, Vite, TypeScript, frontend router/query/state tooling where justified, plus backend auth and permissions.
- Configure MySQL `.env.example`, OMS configuration, consistent API response/error handling, public `GET /api/health`, and JSON 404s for unknown API routes.
- Merge the relevant tooling template carefully; do not overwrite framework files blindly.
**Exit:** Laravel starts, `GET /api/health` returns the documented envelope, frontend production build and typecheck pass. Commit the setup.

## Phase 1 — Schema, models and seeders (½ day)
**Skills:** `laravel-backend`, `db-performance` **Docs:** 03
- Create tables, indexes and foreign keys; define enums and relationships.
- Keep models/migrations in the owning `packages/OMS/*` packages.
- Seed roles/permissions, 5 users, 100 customers, 50 products, 500+ orders with consistent history, notes, activities and audit records.
**Exit:** migrations/seeding succeed; counts match; representative listing query uses appropriate indexes.

## Phase 2 — Authentication and RBAC (½ day)
**Skills:** `laravel-backend`, `rbac-policies`, `testing` **Docs:** 04
- Login/logout/current user, throttling, inactive-user block, role/permission seed data, policies and Staff scoping.
- Test login success/failure, protected route 401 and role 403 matrix.
**Exit:** authentication and authorization tests pass.

## Phase 3 — Customers and Products (½ day)
**Skills:** `laravel-backend`, `audit-logging`, `testing`
- CRUD, search/filter/pagination, deactivate/soft-delete policy, customer stats, stock adjustments, lookup endpoints and audit events.
**Exit:** customer/product validation, authorization and audit tests pass.

## Phase 4 — Orders core (1 day)
**Skills:** `order-workflow`, `laravel-backend`, `audit-logging`, `db-performance`, `testing` **Docs:** 04, 05
- Implement pricing, create/update/delete, status transition rules, stock service, query filters, assignment, notes, activity, history, events/listeners and notification endpoints.
- Use transactions, row locks where needed and optimistic conflict handling where appropriate.
**Exit:** tests cover pricing example, CRUD, validation, valid/invalid transitions, stock reserve/restore, insufficient stock, Staff scoping and conflicts.

## Phase 5 — Dashboard and audit APIs (¼ day)
**Skills:** `db-performance`
- Real database summary, status distribution, revenue trends by day/week/month, caching only when justified, and audit listing.
**Exit:** aggregates match fixture data.

## Phase 6 — Frontend foundation (¾ day)
**Skills:** `react-frontend`
- Build the typed API client, authentication UX, router guards, AppShell, reusable UI kit, toast/notification handling, server-state defaults and API validation-error mapping.
- All product UI must be implemented with React components, not Blade UI components.
- Frontend location: `packages/OMS/Admin/src/Resources/assets/` (or a documented frontend workspace in the same monorepo).
**Exit:** login and protected dashboard shell work; API 401 is handled; shared UI components are reused.

## Phase 7 — Frontend features (1¼ days)
**Skills:** `react-frontend`, `order-workflow`
Implement in order: order list → order detail/timeline/activity → create/edit wizard → customers → products → dashboard/charts → users/roles → audit log → notifications.
Every screen supports loading, empty, error/retry and permission-aware states. Test Admin, Manager and Staff at mobile/tablet/desktop widths.
**Exit:** critical workflows complete for all roles.

## Phase 8 — Tests, docs and polish (½ day)
**Skills:** `testing`, `deliverables`
- Frontend tests with Vitest + React Testing Library; Playwright for key user journeys.
- Add Postman/OpenAPI, README, TECHNICAL_NOTES and AI usage notes; run formatter, lint, static analysis, typecheck and production build.
- Review `qa-kit/` before overlaying it. It contains assessment-oriented tests and scripts; merge rather than blindly overwrite existing test helpers or framework files. For OMS, confirm frontend test paths and dependencies match the selected frontend.
- Run the documented QA loop until consecutive verification runs are clean; report actual command outputs.
**Exit:** acceptance checklist is complete and QA report is committed.

## Bonus (only if time)
Low-stock notifications, CSV export, order duplication, Docker, Redis caching, Kanban, PDF invoice and broadcasting—in that order.

## Time-box guidance
Cut bonus work first, then non-critical UI polish and advanced charting. Never cut transactions, server-side totals, authorization policies, status transition rules, core tests or documentation.
