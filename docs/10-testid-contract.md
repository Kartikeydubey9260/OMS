# 10 — Frontend test contract (`data-testid`, URLs, formats)

Playwright and Vitest rely on this contract. The frontend **must** implement it; changing a name means updating the tests in the same commit. Selectors are `getByTestId` (attribute `data-testid`).

## Global conventions
- Auth persistence: Zustand `persist` key **`oms-auth`**, stored value `{"state":{"token":"…","user":{…}},"version":0}` in `localStorage`.
- Currency: USD via `Intl.NumberFormat('en-US',{style:'currency',currency:'USD'})` → `$363.00`. Counts use `toLocaleString('en-US')` → `12,345`.
- Status labels are Capitalised (`Draft, Pending, Confirmed, Processing, Ready, Completed, Cancelled`); priority labels `Low, Normal, High, Urgent`.
- Native `<select>` elements are used for: status, priority, assignee, discount type, status-change target, filters. Option `value` = enum key (`pending`, `high`, …) or user id.
- Every page renders `page-title` (h1). Toasts render `toast` with `role="status"` (success) or `role="alert"` (error).
- Default tax rate shown/used: 10%.
- Query retry: network errors retry at most once; 4xx never retried (so error states appear < 10 s).
- Generic: `field-error` on every inline validation message, `aria-invalid="true"` on the invalid control.
- Browser console must stay free of errors (React warnings count) during normal flows.

## Routes
`/login`, `/dashboard`, `/orders`, `/orders/new`, `/orders/:id`, `/orders/:id/edit`, `/customers`, `/customers/new`, `/customers/:id`, `/customers/:id/edit`, `/products`, `/products/new`, `/users`, `/audit-logs`, `/notifications`, `/403`.
Landing after login: Admin/Manager → `/dashboard`; Staff → `/orders`. Unauthenticated access → `/login`. Forbidden route → renders `forbidden-page`. Unknown → `not-found-page`.

## Orders list URL state
Query params (shareable, back-button safe): `search, status, priority, customer_id, assigned_to, date_from, date_to, sort, direction, page, per_page`.

## Test IDs

### Auth & shell
`login-email`, `login-password`, `login-submit`, `login-error`, `user-menu` (contains user name), `logout-button`, `nav-toggle` (mobile only), `nav-dashboard`, `nav-orders`, `nav-customers`, `nav-products`, `nav-users`, `nav-audit`, `page-title`, `toast`, `forbidden-page`, `not-found-page`

### Notifications
`notification-bell`, `notification-badge` (absent when 0), `notification-item`, `notification-mark-all`

### Orders list
`orders-new`, `orders-search`, `orders-filter-status`, `orders-filter-priority`, `orders-filter-assignee`, `orders-filter-from`, `orders-filter-to`, `orders-table`, `order-row` (attributes `data-order-number`, `data-total` numeric, `data-status`), `orders-sort-order_date`, `orders-sort-total`, `orders-sort-status`, `orders-sort-priority`, `orders-sort-customer`, `orders-pagination`, `orders-page-info` (text `Page 1 of 2`), `orders-next`, `orders-prev`, `orders-per-page`, `orders-skeleton`, `orders-empty` (text "No orders found."), `orders-error` (text "Unable to load orders."), `orders-retry`

### Order detail
`order-number`, `order-status`, `order-priority`, `order-assignee`, `order-total`, `order-customer-name`, `order-customer-email`, `order-items-table`, `order-item-row`, `order-timeline`, `order-activity`, `order-detail-skeleton`, `order-detail-error`
Actions (rendered **only** when allowed): `action-edit`, `action-status`, `action-assign`, `action-note`, `action-cancel`, `action-delete`
Dialogs: `status-select`, `status-remarks`, `status-submit`, `assign-select`, `assign-submit`, `note-input`, `note-submit`, `cancel-reason`, `confirm-ok`, `confirm-cancel`

### Order edit (conflict test)
`edit-priority` (select), `edit-save`

### Wizard (create/edit)
`wizard-step-1` … `wizard-step-5` (visible only for the active step), `wizard-next`, `wizard-back`, `wizard-submit`, `wizard-customer-search`, `wizard-customer-option`, `wizard-product-search`, `wizard-product-option`, `wizard-qty-<index>`, `wizard-remove-<index>`, `wizard-discount-type`, `wizard-discount-value`, `wizard-priority`, `wizard-assignee`, `wizard-date`, `wizard-status`, `wizard-notes`, `wizard-preview-total`, `wizard-review-total`, `wizard-review-customer`

### Dashboard
`stat-total-orders`, `stat-pending`, `stat-confirmed`, `stat-processing`, `stat-completed`, `stat-cancelled`, `stat-revenue`, `stat-avg`, `stat-customers`, `stat-products`, `chart-status`, `chart-revenue`, `revenue-period-day`, `revenue-period-week`, `revenue-period-month`

### Customers
`customers-search`, `customer-new`, `customer-name`, `customer-email`, `customer-phone`, `customer-submit`, `customer-row`, `customer-stat-total`, `customer-stat-pending`, `customer-stat-completed`, `customer-stat-cancelled`, `customer-stat-value`, `customer-recent-orders`

### Products
`products-search`, `product-new`, `product-name`, `product-sku`, `product-price`, `product-stock`, `product-submit`, `product-row`

## Seeded accounts (must exist after `migrate:fresh --seed`, any env)
| Role | Name | Email | Password |
|---|---|---|---|
| Admin | Admin User | admin@oms.test | password |
| Manager | Manager User | manager@oms.test | password |
| Staff | Staff User | staff@oms.test | password |
| Staff | Second Staff | staff2@oms.test | password |
| Manager | Second Manager | manager2@oms.test | password |

## Environment required for QA (monorepo root)
- `.env.e2e` (copy of `.env.e2e.example`, git-ignored): `APP_ENV=e2e`, `APP_URL=http://localhost:8001`, own database `oms_e2e`, `QUEUE_CONNECTION=sync`, `CACHE_STORE=array`, `OMS_LOGIN_THROTTLE=100000`, `OMS_API_THROTTLE=100000`. Production defaults stay `5/min` (login, keyed by email+IP) and `120/min` (API).
- One Laravel server serves **both** the API and the built SPA on `http://localhost:8001` (same origin; no CORS, no separate Vite port). Playwright's `globalSetup` runs `npm run build` and `php artisan migrate:fresh --seed`; the web server runs with `PHP_CLI_SERVER_WORKERS=4` so concurrent-request tests are real.
- Pest uses a **different** database (`oms_test` via `phpunit.xml`) so `RefreshDatabase` never wipes the e2e data.
- Unknown `/api/*` URLs must return the JSON 404 envelope (never the SPA HTML).
