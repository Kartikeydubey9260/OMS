# 04 — API Specification

Base: `/api`. JSON only. Auth: `Authorization: Bearer <token>` (Sanctum) on everything except `POST /login`.

## Envelope

Success:

```json
{ "success": true, "message": "Order created successfully", "data": {} }
```

Paginated success adds `"meta": {"current_page":1,"per_page":15,"total":532,"last_page":36}` and `"links"`.

Error:

```json
{
    "success": false,
    "message": "The given data was invalid.",
    "errors": { "items.0.quantity": ["Quantity must be greater than 0."] },
    "code": "VALIDATION_ERROR"
}
```

| HTTP | code                                                              | When                                                                   |
| ---- | ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 401  | UNAUTHENTICATED                                                   | missing/invalid token                                                  |
| 401  | INVALID_CREDENTIALS                                               | wrong email/password or inactive user at login (same message for both) |
| 403  | FORBIDDEN                                                         | policy/permission denied                                               |
| 404  | NOT_FOUND                                                         | model not found                                                        |
| 409  | CONFLICT                                                          | stale version / concurrent edit                                        |
| 422  | VALIDATION_ERROR / INVALID_STATUS_TRANSITION / INSUFFICIENT_STOCK | business or validation failure                                         |
| 429  | TOO_MANY_REQUESTS                                                 | throttled (login 5/min, API 120/min)                                   |
| 500  | SERVER_ERROR                                                      | generic message only; details to logs                                  |

Implement centrally in `bootstrap/app.php` exception renderer + a `ApiResponse` helper/trait.

## Auth

| Method | Path                              | Body                            | Notes                                                                                            |
| ------ | --------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------ |
| POST   | /login                            | `email, password, device_name?` | returns `{token, user{id,name,email,role,permissions[]}}`; blocks inactive users; throttle 5/min |
| POST   | /logout                           | –                               | revokes current token                                                                            |
| GET    | /me                               | –                               | current user + role + permissions                                                                |
| POST   | /forgot-password, /reset-password |                                 | optional                                                                                         |

## Users & roles (permission `users.manage`, Admin only)

| Method  | Path                    | Notes                                                                                 |
| ------- | ----------------------- | ------------------------------------------------------------------------------------- |
| GET     | /users                  | `?search&role&is_active&page&per_page`                                                |
| POST    | /users                  | `name,email,password,role,is_active`                                                  |
| GET/PUT | /users/{id}             |                                                                                       |
| DELETE  | /users/{id}             | soft delete; cannot delete self                                                       |
| GET     | /roles                  | web-guard roles (Spatie row per role name, guard `web`) with `permissions[]` and `users_count` (live pivot count) |
| POST    | /roles                  | `{name}` (`roles.manage`)                                                             |
| PUT     | /roles/{id}             | `{name}` (`roles.manage`)                                                             |
| DELETE  | /roles/{id}             | `roles.manage`; protected roles (admin/super-admin) and roles still in use are rejected |
| PUT     | /roles/{id}/permissions | `{permissions: [..]}` (`roles.manage`)                                                |
| GET     | /permissions            | permissions scoped to the `web` guard only (seeders keep parallel `sanctum` rows for tokens, excluded here) |
| GET     | /users/assignable       | id+name of active users who can be assigned orders (used by dropdowns; Manager+Admin) |

## Customers

| Method | Path                 | Permission                                                                                                                                 |
| ------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | /customers           | `customers.view` — `?search&is_active&page&per_page&sort&direction`                                                                        |
| POST   | /customers           | `customers.manage`                                                                                                                         |
| GET    | /customers/{id}      | `customers.view` — includes stats: `total_orders, pending_orders, completed_orders, cancelled_orders, total_order_value, recent_orders[5]` |
| PUT    | /customers/{id}      | `customers.manage` (audited)                                                                                                               |
| DELETE | /customers/{id}      | `customers.manage` — soft delete/deactivate; blocked (or deactivate only) if open orders exist                                             |
| GET    | /customers/lookup?q= | light autocomplete for order wizard (id, name, email)                                                                                      |

## Products

| Method | Path                 | Permission                                                         |
| ------ | -------------------- | ------------------------------------------------------------------ |
| GET    | /products            | `products.view` — `?search&status&low_stock&price_min&price_max&page&sort&direction` |
| POST   | /products            | `products.manage`                                                  |
| GET    | /products/{id}       | `products.view`                                                    |
| PUT    | /products/{id}       | `products.manage` (audited incl. price/stock changes)              |
| PATCH  | /products/{id}/stock | `products.manage` — manual adjustment `{delta, reason}`            |
| GET    | /products/lookup?q=  | active products for wizard (id, sku, name, price, stock, tax_rate) |

## Orders

| Method | Path                                                            | Notes                                                                                                                |
| ------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| GET    | /orders                                                         | list; Staff automatically scoped to `assigned_to = me`                                                               |
| POST   | /orders                                                         | create (Admin, Manager)                                                                                              |
| GET    | /orders/{id}                                                    | detail incl. customer, items, status_history, notes, activities, allowed_transitions                                 |
| PUT    | /orders/{id}                                                    | edit (Admin, Manager); only while status ∈ draft/pending (confirmed+ locks items); requires `version`                |
| DELETE | /orders/{id}                                                    | Admin only; soft delete; only draft/cancelled (else 422); audited                                                    |
| POST   | /orders/{id}/status                                             | `{status, remarks?, version?}`                                                                                       |
| POST   | /orders/{id}/assign                                             | `{assigned_to}` (Admin, Manager)                                                                                     |
| POST   | /orders/{id}/notes                                              | `{body}`                                                                                                             |
| GET    | /orders/{id}/notes, /orders/{id}/activity, /orders/{id}/history | paged sub-resources (also embedded in detail)                                                                        |
| POST   | /orders/{id}/duplicate                                          | bonus                                                                                                                |
| POST   | /orders/preview                                                 | `items[], discount_type, discount_value, tax_rate?` → server-computed totals for wizard review step (no persistence) |

### Create/Update order payload

```json
{
    "customer_id": 12,
    "order_date": "2026-10-09",
    "priority": "high",
    "assigned_to": 3,
    "status": "draft",
    "discount_type": "fixed",
    "discount_value": 20,
    "notes": "Deliver before Friday",
    "items": [
        { "product_id": 5, "quantity": 2 },
        { "product_id": 9, "quantity": 3 }
    ],
    "version": 4
}
```

Client-sent `unit_price`, `subtotal`, `tax`, `total` are **ignored**. Initial status allowed: `draft` or `pending` only.

### List query params

`search` (order number | customer name | customer email | product name/SKU | assignee name), `status[]`, `priority[]`, `customer_id`, `assigned_to`, `date_from`, `date_to`, `sort` ∈ `order_date,total,status,priority,customer,created_at`, `direction` asc|desc, `page`, `per_page` (≤100).

### List item shape (OrderListResource — slim)

`id, order_number, customer{id,name}, order_date, status, priority, assigned_to{id,name}, total, items_count`

### Detail shape (OrderResource)

`id, order_number, status, priority, order_date, customer{...full}, assigned_to, created_by, items[{product_id,name,sku,quantity,unit_price,discount_amount,tax_amount,line_total}], subtotal, discount_type, discount_value, discount_amount, tax_rate, tax_amount, total, notes, status_history[], notes_list[], activities[], allowed_transitions[], permissions{can_edit,can_delete,can_assign,can_change_status,can_cancel,can_add_note}, version, timestamps`.

`permissions{}` is computed server-side from policies so the UI only mirrors backend truth.

## Dashboard (`dashboard.view`: Admin, Manager)

| Method | Path                                              | Notes                                                                                                 |
| ------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| GET    | /dashboard/summary                                | counts per status, total revenue (completed orders), avg order value, total customers, total products |
| GET    | /dashboard/status-distribution                    | `[{status,count}]`                                                                                    |
| GET    | /dashboard/revenue-trend                          | `?period=day\|week\|month&from&to` → `[{label, revenue, orders}]`                          |
| GET    | /dashboard/reports                                | report hub (`reports.view`); filters + per-client/per-product breakdowns (see below)                  |
| GET    | /dashboard/reports/export                         | `?type&format=csv\|xls\|xlsx\|pdf` — exports the **full filtered** dataset (filters like the hub, no pagination) |
| GET    | /dashboard/top-products, /dashboard/recent-orders | optional                                                                                              |

### `GET /dashboard/reports`

`reports.view` (Admin, Manager). Response `data`:

```json
{
  "summary": { "total_revenue", "total_orders", "total_customers", "total_products", "total_items_sold", "average_order_value" },
  "orders_by_status": [{ "status", "count", "revenue" }],
  "top_products_by_quantity": [/* ≤ `top` */],
  "top_products_by_price": [/* ≤ `top` */],
  "top_clients_by_orders": [],
  "top_clients_by_price": [],
  "per_client_report": {
    "data": [{ "client_id", "client_name", "email", "orders_count", "total_quantity", "avg_order_value", "total_spent", "latest_order_date" }],
    "meta": { "current_page", "per_page", "total", "last_page", "from", "to" }
  },
  "per_product_report": {
    "data": [{ "product_id", "product_name", "sku", "orders_count", "total_quantity_sold", "total_revenue" }],
    "meta": { /* same */ }
  },
  "filter_options": { "years", "months", "statuses", "clients", "products" }
}
```

Query params: `top` (default 10), report filters `year, month, status, start_date, end_date, customer_id, product_id`, and server-driven list params **`page, per_page (≤100, default 10), sort, direction`** applied to both breakdowns — they paginate and sort exactly like the other tables.

Sortable columns (whitelisted; unknown `sort` falls back to the default instead of 422):

- `per_client_report`: `client_name, orders_count, total_quantity, avg_order_value, total_spent, latest_order_date` — default `total_spent desc`
- `per_product_report`: `product_name, sku, orders_count, total_quantity_sold, total_revenue` — default `total_revenue desc`

Revenue definition: sum of `total` of orders with status `completed` (document this; alternative: confirmed+). Cache 60s per params.

## Audit logs (`audit.view`: Admin)

`GET /audit-logs?user_id&action&auditable_type&auditable_id&date_from&date_to&page`

## Notifications

| Method | Path                        |
| ------ | --------------------------- |
| GET    | /notifications `?unread=1`  |
| GET    | /notifications/unread-count |
| POST   | /notifications/{id}/read    |
| POST   | /notifications/read-all     |

## Permission matrix

| Permission                    | Admin | Manager                    | Staff                                 |
| ----------------------------- | ----- | -------------------------- | ------------------------------------- |
| users.manage, roles.manage    | ✔     |                            |                                       |
| customers.view                | ✔     | ✔                          | ✔                                     |
| customers.manage              | ✔     | ✔ (create/edit; no delete) |                                       |
| products.view                 | ✔     | ✔                          | ✔                                     |
| products.manage               | ✔     |                            |                                       |
| orders.view_all               | ✔     | ✔                          | (own assigned only)                   |
| orders.create / orders.update | ✔     | ✔                          |                                       |
| orders.delete                 | ✔     |                            |                                       |
| orders.assign                 | ✔     | ✔                          |                                       |
| orders.change_status          | ✔     | ✔                          | ✔ (allowed statuses, assigned orders) |
| orders.add_note               | ✔     | ✔                          | ✔ (assigned orders)                   |
| dashboard.view, reports.view  | ✔     | ✔                          |                                       |
| audit.view                    | ✔     |                            |                                       |

Justification of deviations: Manager may create/edit customers because sales flows need it; Admin-only product management matches the spec. Record in Technical Notes.

## Response shapes relied on by automated tests (keep stable)

| Endpoint                             | Contract                                                                                                                                                                                                                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health`                        | public; `{success:true,...}`                                                                                                                                                                                                                                                            |
| `POST /login`                        | `data{token,user{id,name,email,role,permissions[]}}`; bad credentials → 401 `INVALID_CREDENTIALS`; throttled → 429 `TOO_MANY_REQUESTS`. Throttle limits come from `config('oms.login_throttle'                                                                                          | 'api_throttle')`. |
| `GET /orders`                        | `data[]` slim rows + `meta{current_page,per_page,total,last_page}`; unknown `sort` or `direction` → 422 `VALIDATION_ERROR` (never reaches SQL); `per_page` capped at 100                                                                                                                |
| `POST /orders/preview`               | Admin/Manager only; `data{subtotal,discount_amount,tax_rate,tax_amount,total}`; optional `tax_rate`; persists nothing; same validation as create items                                                                                                                                  |
| Order detail                         | `status_history[{from_status,to_status,remarks,user{id,name},created_at}]`, `notes_list[{id,body,user,created_at}]`, `activities[]`, `items[{...,discount_amount,tax_amount,line_total}]`. Σ item discount / tax / line_total equals the order's discount / tax / total **to the cent** |
| `PUT /orders/{id}`                   | requires `version`; stale → 409 `CONFLICT`; status not draft/pending → 422                                                                                                                                                                                                              |
| `POST /orders/{id}/status`           | confirm without stock → 422 `INSUFFICIENT_STOCK` (message names the products); cancelling confirmed+ without `remarks` → 422 on `remarks`                                                                                                                                               |
| `GET /customers/{id}`                | stats at top level of `data`: `total_orders, pending_orders, completed_orders, cancelled_orders, total_order_value` (excludes cancelled and draft), `recent_orders[≤5]`                                                                                                                 |
| `GET /dashboard/summary`             | `total_orders` (all non-deleted), `pending_orders, confirmed_orders, processing_orders, completed_orders, cancelled_orders, total_revenue` (Σ completed totals), `average_order_value` (revenue ÷ completed count, 0 if none), `total_customers, total_products`                        |
| `GET /dashboard/revenue-trend`       | zero-filled `[{label,revenue,orders}]` by `order_date`; labels `YYYY-MM-DD` (day), `YYYY-Www` ISO week, `YYYY-MM` (month); invalid `period` → 422                                                                                                                                       |
| `GET /dashboard/status-distribution` | `[{status,count}]`, Σ count = `total_orders`                                                                                                                                                                                                                                            |
| `GET /notifications`                 | `data[{id,read_at,created_at,data{type,message,order_id,order_number}}]`; `type ∈ order_assigned, order_confirmed, order_cancelled, low_stock`                                                                                                                                          |
| `GET /notifications/unread-count`    | `data{count}`                                                                                                                                                                                                                                                                           |
| `POST /notifications/{id}/read`      | 200; another user's notification → 404                                                                                                                                                                                                                                                  |
| `GET /audit-logs`                    | `data[{id,action,auditable_type,auditable_id,label,old_values,new_values,user{id,name}\|null,created_at}]`, newest first; no write routes (PUT/DELETE → 404/405); never contains `password`/tokens                                                                                      |
