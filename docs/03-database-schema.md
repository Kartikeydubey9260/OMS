# 03 — Database Schema (MySQL 8, InnoDB, utf8mb4)

Conventions: `id` BIGINT UNSIGNED PK; `created_at/updated_at` timestamps; money `DECIMAL(12,2)`; soft deletes where noted; FKs with explicit `ON DELETE` behaviour.

## users
| column | type | notes |
|---|---|---|
| id | bigint PK | |
| name | varchar(120) | |
| email | varchar(190) | **unique** |
| password | varchar(255) | hashed, hidden in resources |
| is_active | boolean default 1 | inactive users cannot log in |
| last_login_at | timestamp null | |
| remember_token, email_verified_at | | Laravel default |
| deleted_at | timestamp null | soft delete |

Roles/permissions via Spatie tables: `roles`, `permissions`, `model_has_roles`, `model_has_permissions`, `role_has_permissions`. Sanctum: `personal_access_tokens`.

## customers
| column | type | notes |
|---|---|---|
| id | bigint PK | |
| name | varchar(150) | index (prefix search) |
| email | varchar(190) | **unique**, index |
| phone | varchar(30) null | |
| company | varchar(150) null | |
| address_line1, address_line2, city, state, postal_code, country | varchar | address |
| is_active | boolean default 1 | deactivate instead of hard delete |
| deleted_at | timestamp null | |

Indexes: `(is_active, name)`, `(email)` unique.

## products
| column | type | notes |
|---|---|---|
| id | bigint PK | |
| sku | varchar(64) | **unique** |
| name | varchar(190) | index |
| description | text null | |
| price | decimal(12,2) | CHECK price >= 0 |
| tax_rate | decimal(5,2) null | optional override; default from config (10.00) |
| stock_quantity | int unsigned | available stock |
| low_stock_threshold | int unsigned default 5 | |
| status | enum('active','inactive') | index |
| deleted_at | timestamp null | |

Indexes: `sku` unique, `(status, name)`, `(stock_quantity)`.

## orders
| column | type | notes |
|---|---|---|
| id | bigint PK | |
| order_number | varchar(20) | **unique**, `ORD-10001` format |
| customer_id | FK customers | RESTRICT |
| created_by | FK users | |
| assigned_to | FK users null | SET NULL |
| status | varchar(20) | enum value, default `draft` |
| priority | varchar(10) | `low,normal,high,urgent` |
| order_date | date | |
| subtotal | decimal(12,2) | sum of line_subtotal |
| discount_type | enum('fixed','percent') null | |
| discount_value | decimal(12,2) default 0 | input value |
| discount_amount | decimal(12,2) default 0 | computed |
| tax_rate | decimal(5,2) | order-level rate used |
| tax_amount | decimal(12,2) | |
| total | decimal(12,2) | grand total |
| notes | text null | initial remarks |
| stock_reserved | boolean default 0 | true while stock is deducted for this order |
| confirmed_at, completed_at, cancelled_at | timestamp null | |
| cancellation_reason | varchar(255) null | |
| version | unsigned int default 1 | optimistic locking |
| deleted_at | timestamp null | soft delete |

**Indexes (list performance):**
- `UNIQUE (order_number)`
- `(status, order_date)`
- `(assigned_to, status, order_date)` — staff "my orders"
- `(customer_id, created_at)` — customer detail / recent orders
- `(priority, status)`
- `(order_date)`, `(total)` for sorting
- `(created_at)`

## order_items
| column | type | notes |
|---|---|---|
| id | bigint PK | |
| order_id | FK orders | CASCADE |
| product_id | FK products | RESTRICT |
| product_name | varchar(190) | **snapshot** |
| sku | varchar(64) | snapshot |
| quantity | int unsigned | > 0 |
| unit_price | decimal(12,2) | snapshot from product at time of order |
| line_subtotal | decimal(12,2) | qty × unit_price |
| discount_amount | decimal(12,2) | allocated share of discount |
| tax_amount | decimal(12,2) | allocated tax |
| line_total | decimal(12,2) | line_subtotal − discount + tax |

Indexes: `(order_id)`, `(product_id)`, optional unique `(order_id, product_id)` (merge duplicate products in a request).

## order_status_histories
`id, order_id FK CASCADE, from_status varchar null, to_status varchar, changed_by FK users, remarks varchar(500) null, created_at`. Index `(order_id, created_at)`. Append-only (no updates/deletes).

## order_notes
`id, order_id FK CASCADE, user_id FK, body text, created_at`. Index `(order_id, created_at)`.

## order_activities (feed shown on detail page)
`id, order_id FK CASCADE, user_id FK null, type varchar(30)` (`created, status_changed, assigned, note_added, updated, stock_adjusted, system`), `description varchar(255), meta json null, created_at`. Index `(order_id, created_at)`.

## audit_logs
| column | type | notes |
|---|---|---|
| id | bigint PK | |
| user_id | FK users null | actor |
| action | varchar(40) | `order.created`, `order.updated`, `order.deleted`, `order.status_changed`, `order.assigned`, `customer.updated`, `product.updated`, … |
| auditable_type | varchar(60) | `order`, `customer`, `product` |
| auditable_id | bigint | |
| label | varchar(120) | human text e.g. "Updated Order #ORD-10234" |
| old_values | json null | only changed keys |
| new_values | json null | only changed keys |
| ip_address | varchar(45) null | |
| created_at | timestamp | |

Indexes: `(auditable_type, auditable_id, created_at)`, `(user_id, created_at)`, `(action, created_at)`, `(created_at)`. Append-only. Candidate for monthly partitioning.

## notifications
Laravel default `notifications` table (uuid id, type, notifiable_type/id, data json, read_at, created_at). Index `(notifiable_id, read_at, created_at)`.

## jobs / failed_jobs / cache
Laravel defaults (database queue/cache driver is fine for the MVP; Redis optional).

## Relationships

```
User 1─* Order (created_by)            User 1─* Order (assigned_to)
Customer 1─* Order                     Order 1─* OrderItem *─1 Product
Order 1─* OrderStatusHistory           Order 1─* OrderNote
Order 1─* OrderActivity                User 1─* AuditLog
```

## Seed volumes (R-NFR-5)

5 users (1 admin, 2 managers, 2 staff — fixed credentials documented in README, e.g. `admin@oms.test / password`), 100 customers, 50 products, 500+ orders with realistic status mix (≈20% completed-heavy), 1–5 items each, status history consistent with current status, notes, activities and audit logs. Seeders must respect the transition map and stock rules (or write history directly and set `stock_reserved` consistently).
