# 01 — Requirements (normalised from the assessment)

IDs are used by the checklist and plan. **M** = must, **B** = bonus.

## Users and roles

| ID | Requirement |
|---|---|
| R-ROLE-1 M | Roles: **Admin**, **Manager**, **Staff** (seeded). Permissions are stored and manageable by Admin. |
| R-ROLE-2 M | Admin: manage users, roles/permissions, customers, products; create/edit/delete orders; assign; change status; all reports; audit logs. |
| R-ROLE-3 M | Manager: view/create/edit/assign orders; change status; dashboard; reports; add notes. Cannot manage users or permissions. |
| R-ROLE-4 M | Staff: view **assigned** orders only; update *allowed* statuses; add notes; view customer/order info. Cannot manage users, delete orders, manage products. |

## Authentication

| ID | Requirement |
|---|---|
| R-AUTH-1 M | Login, logout, protected APIs, authenticated user endpoint (`/api/me`, includes role + permissions). |
| R-AUTH-2 M | Protected frontend routes; role/permission-aware UI; backend enforces authorization independently. |
| R-AUTH-3 B | Forgot/reset password, remember me, token management. |

## Orders

| ID | Requirement |
|---|---|
| R-ORD-1 M | Full CRUD. Create with: customer, multiple products, quantities, priority, order date, assigned employee, notes, discount, tax, subtotal, total. |
| R-ORD-2 M | Server recalculates all financial values. |
| R-ORD-3 M | Statuses: Draft, Pending, Confirmed, Processing, Ready, Completed, Cancelled, with enforced transitions and cancellation rules. |
| R-ORD-4 M | Status history: previous, new, user, timestamp, optional remarks; shown on detail page. |
| R-ORD-5 M | Notes on orders; activity feed (status changes, notes, assignment changes, system events). |
| R-ORD-6 M | Assign / reassign orders to employees. |
| R-ORD-7 M | Listing: search (order no., customer name, customer email, product, assignee), filters (status, priority, customer, assignee, date range), sorting (order date, total, status, priority, customer), backend pagination. |
| R-ORD-8 B | Duplicate order, CSV export, PDF invoice, bulk actions, Kanban. |

## Audit

| ID | Requirement |
|---|---|
| R-AUD-1 M | Audit log for: order created/updated/deleted, status changed, assignment changed, customer updated, product updated. Stores user, action, entity, old/new values, timestamp. |
| R-AUD-2 M | Admin can view and filter audit logs. |

## Customers

| ID | Requirement |
|---|---|
| R-CUS-1 M | List, search, filter, create, edit, view, deactivate/delete (soft). |
| R-CUS-2 M | Detail page shows info, total / pending / completed / cancelled orders, total order value, recent orders. |

## Products and stock

| ID | Requirement |
|---|---|
| R-PRD-1 M | List, search, filter, create, edit; fields: name, SKU (unique), price, stock quantity, status (active/inactive). |
| R-PRD-2 M | Basic stock handling with a documented approach, including cancellation. |
| R-PRD-3 B | Low-stock alerts/notifications. |

## Dashboard

| ID | Requirement |
|---|---|
| R-DASH-1 M | Cards: total, pending, confirmed, processing, completed, cancelled orders; total revenue; average order value; total customers; total products. |
| R-DASH-2 M | Charts: order status distribution; revenue trend by day / week / month. Real data only. |

## Notifications

| ID | Requirement |
|---|---|
| R-NOT-1 M | In-app notifications (assigned, confirmed, cancelled, needs attention). Read, unread, mark as read, mark all as read. |
| R-NOT-2 B | Real-time via broadcasting/WebSockets. |

## API

| ID | Requirement |
|---|---|
| R-API-1 M | RESTful, consistent success/error envelope, Laravel validation with clear messages. |
| R-API-2 M | API docs (Postman collection and/or OpenAPI) with endpoint, method, auth, params, body, response, errors. |

## Frontend

| ID | Requirement |
|---|---|
| R-FE-1 M | React + TypeScript; reusable React components in the same monorepo, preferably package-owned under `packages/OMS/*/src/Resources/assets/`. Blade is only an optional SPA mount shell, never product UI. |
| R-FE-2 M | Appropriate state management, explainable. |
| R-FE-3 M | Loading, empty, error states on every major screen. |
| R-FE-4 M | Create/Edit order wizard: Customer → Products → Pricing → Assignment & Priority → Review & Submit. Frontend + backend validation. |
| R-FE-5 M | Order detail page (most important): summary, customer info, items, timeline, activity, permission-based actions (Edit, Change Status, Assign, Add Note, Cancel, Delete). |
| R-FE-6 M | Responsive design. |

## Non-functional

| ID | Requirement |
|---|---|
| R-NFR-1 M | Designed for 1M+ orders, 500k customers, 100k products, 5M order items: indexes, pagination, eager loading, no N+1, select needed columns, DB-level filtering. |
| R-NFR-2 M | Security: authN/Z, mass-assignment protection, SQL-injection and XSS prevention, CSRF where applicable, validation, rate limiting, no secret leakage. |
| R-NFR-3 M | Concurrency awareness (two users editing the same order; concurrent stock updates). |
| R-NFR-4 M | Tests: backend (auth, order create/update, status transition, invalid transition, validation, authorization, customer + product creation) and a reasonable set of frontend tests. |
| R-NFR-5 M | Seed data: 5 users (all roles), 100 customers, 50 products, 500+ orders across statuses/priorities, notes, status history, audit logs. App works right after `migrate --seed`. |
| R-NFR-6 M | Git with meaningful commits. |

## Deliverables

One Git monorepo for this variant, Laravel package-first backend under `packages/OMS/*`, React + TypeScript frontend, migrations + seeders + factories owned by packages, Laravel API, Postman/OpenAPI, README and Technical Notes.
