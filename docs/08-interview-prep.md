# 08 — Interview / Code Review Prep

Short model answers matching the decisions in this pack. Adapt to what you actually built.

**Why service classes?** Business rules (pricing, transitions, stock) are reused by controllers, seeders, jobs and tests, and are testable without HTTP. Controllers only translate HTTP ↔ domain.

**Where does business logic live?** Services + Enums (transition map). Models hold relationships/scopes/casts; Policies hold authorization; Form Requests hold input validation.

**How do Policies work?** Gate-registered classes mapping abilities (`update`, `changeStatus`) to a user + model decision. Called via `$this->authorize()` or `FormRequest::authorize()`. Backed by Spatie permissions; Staff rule also checks `assigned_to === user.id`.

**Why a transaction on order creation?** Order, items, totals, activity, audit (and stock) must succeed or fail together; otherwise you get orders without items or audit gaps. Exceptions roll everything back.

**What if two users update the same order?** Optimistic locking: `version` column; stale write → 409. Status changes lock the row with `lockForUpdate` and re-validate the transition inside the transaction.

**Concurrent stock updates?** Pessimistic row locks on product rows, ordered by id to avoid deadlocks, check-then-decrement inside the transaction. Alternative: atomic `UPDATE … SET stock = stock - ? WHERE id=? AND stock >= ?` and check affected rows.

**Why these indexes?** They match the list filters and sorts: `(status, order_date)`, `(assigned_to, status, order_date)` for Staff, `(customer_id, created_at)` for customer pages; unique `order_number`, `sku`, `email`. Leftmost-prefix rule explains column order.

**Orders table at 10M rows?** Keep queries index-covered; cap `per_page`; switch to cursor/keyset pagination; avoid `COUNT(*)` on every page (approximate/cached totals); archive old completed orders; partition by date; read replica for reports; pre-aggregate dashboard.

**Investigate a slow query?** Slow query log / Telescope / `DB::listen`, then `EXPLAIN ANALYZE`, check index usage, rows examined, filesort, fix with index or query rewrite.

**N+1?** Loading relations in a loop (1 query + N). Fix with `with()`/`withCount()`, enable `Model::preventLazyLoading()` in non-prod.

**Why is totals recalculated on the server?** The client is untrusted; a modified request could set any price/total. Server reads prices from DB, computes in integer cents, stores a snapshot on items.

**Why snapshot name/price on order_items?** Product price changes must not rewrite history.

**Why Sanctum tokens?** Simple, revocable, works for SPA and Postman. Trade-off: token in storage is XSS-exposed; cookie-based SPA mode is safer but needs same-site domains + CSRF. Mitigations: short expiry, strict CSP, no `dangerouslySetInnerHTML`.

**How are queues used?** Notification listeners implement `ShouldQueue`; worker via `queue:work`. Bonus: CSV export job. Failures go to `failed_jobs`, retried with backoff.

**State management choice?** TanStack Query for server state (cache, dedupe, invalidation, retries, loading/error states); Zustand for small client state (auth, UI). Redux unnecessary because there is little shared client state.

**Avoid unnecessary API calls?** Query keys include filters, `staleTime`, debounced search, `keepPreviousData`, targeted invalidation after mutations.

**Real-time notifications?** Laravel broadcasting + Reverb/Pusher + Echo; for MVP, poll unread-count every 30–60s.

**1,000 simultaneous order updates?** Row-level locks only on touched rows, short transactions, queue non-critical side-effects, DB connection pooling/horizontal PHP workers, Redis for cache/queues, idempotency keys.

**Multi-tenancy?** `tenant_id` on every table + global scope + composite indexes starting with tenant_id; or DB-per-tenant for isolation. Unique constraints become per-tenant.

**Security risks remaining?** Token in localStorage, no 2FA, no per-tenant isolation, audit logs mutable by DB admins, rate limits basic. Improve with CSP, refresh/rotation, 2FA, signed audit chain.

**What did AI generate / what did you change?** Be honest and specific — fill in the README "AI Usage" section as you go (scaffolding, factories, tests, UI boilerplate vs. your review of transitions, locking, pricing, policies).

**How would you improve it?** Cursor pagination, Scout/Meilisearch, outbox for events, Redis cache, OpenAPI generation, E2E tests (Playwright), CI/CD, soft-delete restore flows, order versioning/diff UI.

**Why package-first Laravel + React monorepo?** Backend package ownership under `packages/OMS/*` mirrors Bagisto’s organization while React + TypeScript stays in the same Git repository. One repo simplifies shared tooling/CI, while the frontend can still be built as a separate artifact. A monorepo does not require React to live under `packages/OMS/Admin/src/Resources/assets`.

**How are dependencies managed?** Composer for PHP, npm for JS — both from the repo root with committed lockfiles; `composer setup` installs everything, CI uses `composer install` + `npm ci`; `composer audit` / `npm audit` before release. Playwright, Vitest and ESLint are root `devDependencies`.

**Tokens although the SPA is same-origin?** Tokens keep Postman, e2e and API consumers simple and revocable. The same-origin setup also allows Sanctum's cookie mode (HttpOnly + CSRF) as a hardening step because a token in `localStorage` is exposed to XSS; mitigations used: no `dangerouslySetInnerHTML`, notes rendered as text, short token expiry.

**How did you test it?** Pest feature/unit tests for rules (pricing, state machine, stock, RBAC, audit), Vitest for components, Playwright for real user flows across roles; a QA loop reruns everything, fixes root causes, and requires two clean dry runs (random test order, repeated e2e).
