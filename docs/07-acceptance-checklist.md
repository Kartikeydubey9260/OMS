# 07 — Acceptance Checklist

Tick every box before submission. Ref = requirement ID in `01-requirements.md`.

## Backend

- [ ] `migrate:fresh --seed` works from scratch; app usable immediately (R-NFR-5)
- [ ] Login/logout/me; protected APIs return 401 without token (R-AUTH-1)
- [ ] Roles Admin/Manager/Staff seeded with permissions; Admin can edit permissions (R-ROLE-*)
- [ ] Policies enforced on every route; Staff sees only assigned orders (R-AUTH-2)
- [ ] Order CRUD with multi-item, discount, tax, totals recomputed server-side (R-ORD-1/2)
- [ ] Unit test: 2×100 + 3×50, discount 20, tax 33, total 363
- [ ] Status machine + invalid transitions return 422 (R-ORD-3)
- [ ] Status history stored and returned (R-ORD-4)
- [ ] Notes, assignment, activity feed (R-ORD-5/6)
- [ ] Listing: search (5 fields), filters (5), sort (5), server pagination (R-ORD-7)
- [ ] Audit log for all listed actions with old/new values; Admin viewer (R-AUD-*)
- [ ] Customer module + stats; soft delete (R-CUS-*)
- [ ] Product module; unique SKU; stock reserve on confirm, restore on cancel; documented (R-PRD-*)
- [ ] Dashboard APIs real data incl. revenue day/week/month (R-DASH-*)
- [ ] Notifications read/unread/mark-all (R-NOT-1)
- [ ] Order create is one DB transaction (order, items, totals, stock if applicable, activity, audit)
- [ ] Events/Listeners + queued job used meaningfully
- [ ] Consistent JSON success/error envelope; no stack traces in prod
- [ ] Form Requests, API Resources, Services, Policies present; thin controllers
- [ ] Indexes per schema doc; no N+1 (verify with `preventLazyLoading` in dev)
- [ ] Concurrency: row-lock for stock, version check → 409
- [ ] Rate limiting on login/API; `$fillable` on all models; no secrets committed

## Frontend

- [ ] React + TypeScript frontend in the OMS monorepo, preferably package-owned assets; Blade is mount shell only if needed. Vite build/typecheck pass.
- [ ] Protected + permission routes; 401 → login
- [ ] Order list: search, filters, sort, pagination, URL-synced, debounced
- [ ] Order detail: summary, customer, items, timeline, activity, permission-based actions (R-FE-5)
- [ ] Create/Edit wizard with 5 steps, Zod validation, backend errors mapped to fields (R-FE-4)
- [ ] Customers, Products, Dashboard (cards + 2 charts), Users/Roles, Audit, Notifications screens
- [ ] Loading skeleton / empty / error+retry on every major screen (R-FE-3)
- [ ] Responsive (mobile/tablet/desktop)
- [ ] Server state in TanStack Query, client state in Zustand; explained in README

## Quality & delivery

- [ ] Backend tests: auth, order create/update, status transition, invalid transition, validation, authorization, customer create, product create (R-NFR-4)
- [ ] Frontend tests: reasonable set passing
- [ ] Pint / ESLint / Prettier clean
- [ ] Postman collection or OpenAPI committed (R-API-2)
- [ ] README complete: overview, stack, install, env, DB, API docs, architecture, trade-offs, AI usage
- [ ] TECHNICAL_NOTES: architecture, decisions, challenges, performance, security, AI tools, future improvements
- [ ] Git history has meaningful commits
- [ ] You can explain every file (see `08-interview-prep.md`)
- [ ] Monorepo: exactly one `composer.json` and one `package.json`; no `frontend/` or `backend/` folder; lockfiles committed; `public/build` ignored
- [ ] `composer qa:dry` (or `bash qa-kit/scripts/qa/dry-run.sh 2`) ends with `DRY RUN CLEAN`; `QA_REPORT.md` committed
