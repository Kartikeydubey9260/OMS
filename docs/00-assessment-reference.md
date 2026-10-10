# Assessment requirements reference

This document summarizes the attached Order Management System technical assessment. Preserve these functional requirements regardless of the chosen frontend or backend organization.

## Backend
- Laravel REST API, MySQL, Laravel authentication, validation and exception handling.
- Use queues/jobs and events/listeners where appropriate.
- Keep business logic out of controllers; use transactions for critical workflows.

## Roles and authorization
- Admin: users, roles/permissions, customers, products, orders, assignments, statuses, reports and audit logs.
- Manager: view/create/edit/assign orders, change status, dashboard/reports and notes; cannot manage users or permissions.
- Staff: view assigned orders, update allowed statuses, add notes and view related customer/order information; cannot manage users, delete orders or manage products.
- Enforce authorization in backend policies/API, not only by hiding frontend controls.

## Core modules
- Authentication: login, logout, protected API and frontend routes, current-user details, role-based access.
- Customers: list/search/filter/create/edit/view/deactivate; customer detail metrics and recent orders.
- Products: list/search/filter/create/edit, active status, price, stock and SKU.
- Orders: CRUD; customer; multiple products and quantities; priority; date; employee assignment; notes; discount, tax, subtotal and total recalculated on the backend.
- Lifecycle: Draft, Pending, Confirmed, Processing, Ready, Completed, Cancelled, with explicit valid transitions and cancellation/stock rules.
- History/audit: status history, old/new values where appropriate, user and timestamp; record order/customer/product/assignment changes.
- Dashboard: real database statistics, status distribution and day/week/month revenue.
- Advanced order list: search by order number/customer/email/product/assignee; filters, sorting and server-side pagination.
- Order details: summary, customer, line items, timeline, activity and permission-aware actions.
- Notifications: read/unread, mark one/all read; real-time delivery is optional.
- APIs: consistent success/error envelopes and API documentation (OpenAPI or Postman).
- Seed data: at least 5 users, 100 customers, 50 products, 500+ orders plus histories/activities/audit data.

## Quality and security
- Protect against mass assignment, SQL injection, XSS, CSRF where applicable, weak authorization and unsafe uploads.
- Use decimal-safe money calculations, indexes, eager loading, bounded pagination and concurrency-safe stock updates.
- Test authentication, order creation/update, status transitions, validation, authorization, customer/product creation, pricing and stock.
- Provide loading, empty, error and success states on all major screens.
- Include setup, environment, migrations/seeding, API docs, architecture, trade-offs and AI usage in README/technical notes.
- This is an MVP assessment; prioritize correct, explainable core behavior over bonus features.

Source: user-provided `Technical Assessment.pdf`, pages 1–25.
