# Technical Notes - Order Management System (OMS)

## Architecture
The OMS is built utilizing a modular monolithic architecture within Laravel, splitting the domains into isolated packages (`Core`, `Users`, `Customers`, `Products`, `Inventory`, `Orders`, `Admin`, `API`). This design ensures that boundaries are respected and the system remains highly maintainable as it grows. The frontend is an SPA built with React, styled with Tailwind CSS, and uses React Query for robust server-state management.

## Major Decisions
- **Package-Driven Design:** Chosen to prevent "Big Ball of Mud" scenarios. Business logic is encapsulated in Domain-Driven packages.
- **React Query for Data Fetching:** Implemented to handle caching, background updates, and stale-while-revalidate strategies automatically.
- **Spatie Laravel-Permission:** Utilized for a clean, battle-tested approach to RBAC.

## Challenges
- **Strict Domain Boundaries:** Managing inter-package communication required careful use of service contracts and events to avoid tight coupling.
- **State Synchronization:** Ensuring the Kanban board reflects realtime-like state changes without excessive API polling.

## Performance Considerations
- **Eager Loading:** Critical relationships are eager-loaded in API Resources to prevent N+1 queries.
- **Database Indexing:** Indexes were applied to frequently queried columns like status and dates.
- **Pagination:** Implemented across all listing endpoints to handle large datasets effectively.

## Security Considerations
- **Authentication & Authorization:** Handled via Laravel Sanctum (stateless tokens) and Policies.
- **Mass Assignment:** Carefully guarded models, exposing only `$fillable` fields.
- **Validation:** Strict Request Validation for all incoming data to prevent injection and malicious inputs.

## AI Tools Used
- Gemini Advanced (Antigravity Agent) was used to accelerate boilerplate generation, assist with the architecture scaffolding, generate automated test cases (Pest & Playwright), and refactor complex logic.
