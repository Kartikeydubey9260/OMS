# Order Management System

> One-paragraph overview of the application and the three roles.

## Tech stack
Laravel · MySQL · Sanctum (or documented auth choice) · Spatie Permission · Bagisto-inspired `packages/OMS/*` · React + TypeScript · Vite

## Features
- [x] ...
- [ ] (bonus not done) ...

## Installation (monorepo: Laravel + React + TypeScript in one package-oriented monorepo, one install per language)
```bash
composer setup            # composer install, .env, key, migrate:fresh --seed, npm ci, npm run build
# manual alternative
composer install && cp .env.example .env && php artisan key:generate
# create the MySQL database, set DB_* in .env
php artisan migrate:fresh --seed && npm ci
composer dev              # php artisan serve + queue worker + Vite HMR -> http://localhost:8000
```

## Environment variables
| Variable | Purpose | Example |
|---|---|---|
| APP_URL | app + API origin (React SPA is served from the same origin if using Laravel-hosted assets) | http://localhost:8000 |
| DB_DATABASE / DB_USERNAME / DB_PASSWORD | MySQL | oms / oms / (set locally) |
| QUEUE_CONNECTION | queue driver | database |
| OMS_TAX_RATE | default tax % | 10 |
| OMS_LOGIN_THROTTLE / OMS_API_THROTTLE | requests per minute | 5 / 120 |

## Database & seed data
`php artisan migrate:fresh --seed` → 5 users, 100 customers, 50 products, 500+ orders (+ notes, history, audit logs).
| Role | Email | Password |
|---|---|---|

## API documentation
Postman: `postman/OMS.postman_collection.json` (import + environment).

## Architecture
(diagram + layering + folder structure)

## Business rules
Pricing · status transitions · stock (reserve on confirm / restore on cancel) · concurrency · audit.

## Trade-offs
| Decision | Chosen | Alternatives | Why |

## Testing
`php artisan test` · `npm run test:unit`

## AI usage
- Tools used:
- Where used:
- Generated with AI:
- Written/reviewed manually:
- AI code significantly modified:

## Limitations & future improvements
