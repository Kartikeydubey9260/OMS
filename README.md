# Order Management System (OMS)

A robust, modular Order Management System built with **Laravel 12** and **React**. This repository uses a monorepo, package-first architecture pattern to cleanly separate domains.

## Features

- **Package-Driven Architecture**: Business logic is separated into independent packages (`Core`, `Users`, `Customers`, `Products`, `Inventory`, `Orders`, `Admin`, `API`).
- **React + TypeScript Frontend**: A modern SPA frontend integrated via Vite.
- **Role-Based Access Control (RBAC)**: Comprehensive permissions using Spatie Laravel-Permission (Admin, Manager, Staff roles).
- **Authentication**: Stateless API authentication powered by Laravel Sanctum.
- **Kanban & Detail Views**: Intuitive order tracking and management workflows.
- **Automated Testing**: Fully tested using Pest PHP (Backend) and Playwright (E2E).

## Prerequisites

Before setting up the project, ensure your environment meets the following requirements:
- **PHP**: ^8.2 (or PHP 8.3+)
- **Node.js**: ^20.19 (LTS recommended)
- **Composer**: ^2.7
- **Database**: SQLite (default for dev/testing), MySQL 8+, or PostgreSQL.

## Installation & Setup

Follow these steps to setup the project locally for development or production:

### 1. Clone the repository

```bash
git clone <repository-url>
cd OMS
```

### 2. Install Dependencies

You only need to install PHP dependencies using Composer (frontend assets are pre-built):

```bash
composer install
```

### 3. Run the Interactive Installer

We have provided a streamlined, interactive command to configure your environment, database, and generate the application key automatically:

```bash
php artisan oms:install
```

This command will:
- Prompt for your App Name and URL.
- Let you choose your preferred database connection (MySQL, SQLite, etc.) via an interactive radio menu.
- Securely prompt for your database credentials (passwords will be hidden as `*****`).
- Create and populate your `.env` file automatically.
- Generate your Laravel application key.
- Create `database/database.sqlite` if you select SQLite.
- Run `php artisan migrate:fresh --seed` automatically to initialize the database with schema and default users.

**Default Credentials (from Seeder):**
- Admin: `admin@example.com` / `password`
- Manager: `manager@example.com` / `password`
- Staff: `staff@example.com` / `password`

### 5. Build Frontend Assets

Compile the React frontend assets using Vite:

```bash
npm run build
# For local development with Hot Module Replacement (HMR):
# npm run dev
```

### 6. Start the Application

Start the local Laravel development server:

```bash
php artisan serve
```

The application will now be available at `http://localhost:8000`.

## Running Tests

This project includes a comprehensive suite of automated tests.

### Backend Tests (Pest)

To run the backend unit and feature tests:

```bash
./vendor/bin/pest
```

### Code Formatting (Pint)

To verify or fix PHP code formatting:

```bash
./vendor/bin/pint --test
# Or auto-fix: ./vendor/bin/pint
```

### End-to-End Tests (Playwright)

To run the E2E tests, ensure the application is running and use the QA scripts provided:

```bash
npx playwright install --with-deps
npx playwright test -c qa-kit/e2e/playwright.config.ts
```

Alternatively, you can run the full QA suite which executes linting, pest, and playwright tests:

```bash
bash qa-kit/scripts/qa/run-all.sh
```

## Contributing & Extensibility

Developers can add new features by creating or extending the domain packages located in `packages/OMS/`. 

1. Create models, controllers, and migrations inside the relevant domain package.
2. Register any new Service Providers in `bootstrap/providers.php`.
3. Add React components in `packages/OMS/Admin/src/Resources/assets/`.
