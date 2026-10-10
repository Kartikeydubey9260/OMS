---
name: deliverables
description: Use when producing final submission artifacts for the OMS: README, TECHNICAL_NOTES, Postman/OpenAPI docs, git history hygiene, seed credentials, AI-usage disclosure.
---

# Deliverables skill

## Git hygiene
Commit per feature, imperative present tense. Suggested sequence:
1. `Initial Laravel package monorepo and React setup` 2. `Create order database schema` 3. `Add seeders and factories` 4. `Implement authentication APIs` 5. `Add roles, permissions and policies` 6. `Implement customer and product modules` 7. `Implement order CRUD with server-side pricing` 8. `Implement order status workflow and stock handling` 9. `Add audit logging and notifications` 10. `Add dashboard APIs` 11. `Build frontend foundation and UI kit` 12. `Implement order listing UI` 13. `Implement order detail page` 14. `Implement order wizard` 15. `Add dashboard UI` 16. `Add responsive design` 17. `Add automated tests` 18. `Add API documentation and README`.
`.gitignore`: `.env`, `vendor`, `node_modules`, `storage/*.key`, build output. Commit `.env.example` only.

## README.md (root) — required sections
1. **Project overview** – what OMS does, roles, screenshots (optional).
2. **Technology stack** – Laravel, MySQL, Sanctum, Spatie permission, React + TypeScript, Vite, TanStack Query and selected state/chart libraries, (Redis/Docker if used).
3. **Features implemented / not implemented** (honest list incl. bonuses).
4. **Installation** – prerequisites (PHP 8.2+, Composer, Node 20.19+, MySQL 8); `composer setup` (installs PHP + JS deps, creates `.env`, key, migrates + seeds, builds assets) or the manual steps; run with `composer dev` (API + queue + Vite) and open `http://localhost:8000`.
5. **Environment configuration** – table of variables (`APP_URL, DB_*, QUEUE_CONNECTION, CACHE_STORE, OMS_TAX_RATE, OMS_LOGIN_THROTTLE, OMS_API_THROTTLE`) with safe example values only; note there is no CORS or `VITE_API_URL` because SPA and API share one origin.
6. **Database** – `php artisan migrate:fresh --seed`; seeded accounts table (admin/manager/staff with email+password) and data volumes.
7. **API documentation** – location of Postman collection / Swagger URL; envelope description.
8. **Architecture** – diagram (copy from `docs/02`), layering, folder structure.
9. **Business rules** – pricing, status transitions, stock approach (reserve on confirm, restore on cancel), concurrency, audit.
10. **Trade-offs** – decisions and alternatives (table from `docs/02`).
11. **Testing** – commands and what is covered.
12. **AI usage** – tools used; where used; what AI generated; what you wrote/reviewed manually; AI code you significantly modified (be specific, e.g. "AI proposed decrementing stock on create; changed to reserve-on-confirm with row locks").
13. **Known limitations & future improvements.**

## TECHNICAL_NOTES.md — required sections
Architecture · Major decisions · Challenges (and how solved) · Performance considerations (indexes, pagination, eager loading, caching) · Security considerations (authN/Z, mass assignment, SQLi, XSS, CSRF stance, rate limits, secrets) · Concurrency · AI tools used · Future improvements. Keep to 1–2 pages; templates in `docs/templates/`.

## API documentation
- **Postman**: `postman/OMS.postman_collection.json` + environment file; folders per module; login request has a test script saving `{{token}}`; collection-level Bearer auth `{{token}}`; example success + error responses for key endpoints.
- **Or OpenAPI**: `docs/openapi.yaml` (or `dedoc/scramble` / `l5-swagger` served at `/docs`). For every endpoint: path, method, auth, params, body, response, error response.

## Seed credentials (document in README)
| Role | Email | Password |
|---|---|---|
| Admin | admin@oms.test | password |
| Manager | manager@oms.test | password |
| Staff | staff@oms.test | password |
(+2 more users). Note: demo only — change in production.

## Final verification script (from the repo root — one install per language)
```
composer install && cp .env.example .env && php artisan key:generate
php artisan migrate:fresh --seed
npm ci && npx playwright install --with-deps chromium
composer lint && npm run typecheck
composer qa:dry        # Pest + Vitest + build + Playwright, twice, must end with DRY RUN CLEAN
```
Then walk through `docs/07-acceptance-checklist.md` once as each role in the browser.
