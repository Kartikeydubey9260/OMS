# 05 — Business Rules

## 1. Pricing and totals (`OrderPricingService`)

Inputs: items (`product_id, quantity`), `discount_type` (`fixed|percent|null`), `discount_value`, optional `tax_rate`.

Algorithm (integer cents internally):

1. Load products from DB (never from client); must be `active`; merge duplicate `product_id` rows.
2. `line_subtotal = quantity × unit_price` (unit price snapshot from product now).
3. `subtotal = Σ line_subtotal`.
4. `discount_amount`: fixed → `min(value, subtotal)`; percent → `round(subtotal × value/100)`; percent ≤ 100, fixed ≥ 0.
5. `taxable = subtotal − discount_amount`.
6. `tax_amount = round(taxable × tax_rate/100)` — default `tax_rate = config('oms.tax_rate') = 10.00`.
7. `total = taxable + tax_amount`.
8. Allocate `discount_amount` and `tax_amount` to lines proportionally by `line_subtotal`; give the rounding remainder to the last (largest) line so Σ lines == order totals exactly. Each `line_total = line_subtotal − line_discount + line_tax`.

**Worked example (from the assessment):** A 2×100 = 200, B 3×50 = 150 → subtotal 350; discount 20 → taxable 330; tax 10% = 33; **total 363** ✔. This must be a unit test.

Rounding: half-up to 2 dp. Reject negative results. Max quantity per line configurable (e.g. 10 000).

## 2. Order status machine (`OrderStatus` enum + `OrderStatusService`)

```
draft ─► pending ─► confirmed ─► processing ─► ready ─► completed
  │         │           │             │          │
  └─────────┴───────────┴─────────────┴──────────┴──► cancelled
```

Transition map (anything else → 422 `INVALID_STATUS_TRANSITION`):

| From | Allowed to |
|---|---|
| draft | pending, cancelled |
| pending | confirmed, cancelled, draft *(return to draft for edits)* |
| confirmed | processing, cancelled |
| processing | ready, cancelled *(Admin/Manager only)* |
| ready | completed, cancelled *(Admin only)* |
| completed | — terminal |
| cancelled | — terminal (no reopening; duplicate order instead) |

Rules:
- Cancel requires `remarks` (reason) for confirmed/processing/ready.
- Terminal orders: no item edits, no status changes, notes still allowed.
- Staff may only move **assigned** orders along: `confirmed→processing`, `processing→ready`, `ready→completed`. Staff cannot cancel or confirm. (Configurable map in `config/oms.php`; documented.)
- Order `confirmed_at/completed_at/cancelled_at` set on entering those states.
- Order must have ≥1 item to leave `draft`.
- Same-status "transition" → 422.

## 3. Status history

Each successful transition inserts `order_status_histories` (from, to, user, remarks, created_at) inside the same transaction. Creation inserts `from_status = null → initial`. History is append-only. Detail page timeline renders it plus created/system events.

## 4. Stock handling (`StockService`) — documented approach

- **Reserve (decrement `products.stock_quantity`) when an order becomes `confirmed`.** Draft/pending orders do not hold stock.
- On confirm: inside the transaction, `SELECT … FOR UPDATE` the involved products **ordered by id** (deadlock avoidance); if any `stock_quantity < quantity` → 422 `INSUFFICIENT_STOCK` listing products; else decrement and set `orders.stock_reserved = true`.
- **Cancel:** if `stock_reserved = true` (cancelled from confirmed/processing/ready) → increment stock back, set `stock_reserved = false`, add activity "Stock restored". Cancelling draft/pending changes no stock.
- **Completed:** stock stays deducted (goods shipped).
- Editing items is only allowed in draft/pending (no stock held), so no re-balancing needed.
- Every stock movement writes an activity entry; manual adjustments (`PATCH /products/{id}/stock`) write an audit log.
- After decrement, if `stock_quantity <= low_stock_threshold` dispatch `LowStockDetected` (notify Admins; bonus).
- Alternative considered: reserve at creation (blocks stock on abandoned drafts) and decrement at completion (risks overselling) — rejected.

## 5. Concurrency

- **Stock:** row lock as above.
- **Order edits:** optimistic locking — client sends `version`; `UPDATE … WHERE id=? AND version=?` increments version; zero rows → 409 `CONFLICT` "Order was modified by another user. Reload." Status changes lock the order row (`lockForUpdate`) and re-read status inside the transaction, so two concurrent confirmations cannot both succeed.
- Idempotency on create is optional (bonus): `Idempotency-Key` header.

## 6. Assignment

- Only active users with a role allowed to work orders can be assigned.
- On change: audit (`order.assigned` old/new user), activity entry, `OrderAssigned` event → notification to new assignee (and optionally old).
- Reassignment allowed in non-terminal states.

## 7. Audit logging (`AuditLogger`)

- `AuditLogger::log(action, model, old, new, label)` stores only **changed keys**; hides sensitive fields (password, tokens).
- Actions: `order.created`, `order.updated`, `order.deleted`, `order.status_changed`, `order.assigned`, `customer.created/updated/deleted`, `product.created/updated/stock_adjusted`, `user.created/updated/deleted`, `role.permissions_updated`, `auth.login` (optional).
- Written in the same transaction as the change. Label example: `Updated Order #ORD-10234`; diff example: `priority: normal → high`, `assigned_to: John → David` (resolve names for display in resource).
- Read-only, append-only; no endpoints to edit/delete.

## 8. Notifications

| Event | Recipients | Message |
|---|---|---|
| OrderAssigned | new assignee | "New order #ORD-… assigned to you." |
| OrderStatusChanged → confirmed | creator + assignee | "Order #… has been confirmed." |
| → cancelled | creator + assignee + managers | "Order #… was cancelled." |
| Order overdue/attention (optional scheduled job) | assignee | "Order #… requires your attention." |
| LowStockDetected | admins | "Product X is low on stock." |

Never notify the actor about their own action. Use queued listeners; store as database notifications with `data: {order_id, order_number, message, type}`.

## 9. Customers

- Soft delete/deactivate. Deactivated customers cannot be selected for new orders but old orders remain readable.
- Cannot hard-delete when orders exist. Email unique (case-insensitive).
- Detail stats computed by one grouped query (`GROUP BY status`), not N queries.

## 10. Validation messages (examples that must exist)

- "Customer is required." / "Customer must exist."
- "Order must contain at least one product."
- "Quantity must be greater than 0."
- "Product must exist." / "Product is inactive."
- "Invalid status transition is not allowed."
- "Insufficient stock for: {product} (available {n})."

## 11. Security rules

Sanctum tokens with expiry (e.g. 8h) + revocation on logout; login throttle; password hashing (bcrypt/argon); `$fillable` everywhere; Eloquent/query builder bindings only (no raw interpolation; whitelist `orderBy`); escape output in React (no `dangerouslySetInnerHTML`; notes rendered as text); same-origin SPA (API and React are served by Laravel, so no CORS is needed; if `config/cors.php` is published allow only `APP_URL`); `APP_DEBUG=false` outside local; no secrets in repo (`.env.example` only); API Resources whitelist fields (never serialise `password`, `remember_token`); policies on every resource route; Staff scoping enforced in the query, not the UI.
