# React frontend skill — OMS

Use React + TypeScript by default. New UI source should use `.tsx` / `.ts`; avoid plain JS unless there is a documented reason.

- Keep React in the OMS monorepo and align frontend asset ownership with the package that owns the UI. Preferred example: `packages/OMS/Admin/src/Resources/assets/`.
- A separate frontend workspace within the same repository is acceptable if a real build boundary is needed.
- Use reusable typed components and domain-oriented feature folders.
- Use React Router, TanStack Query, and a small client-state solution such as Zustand only where justified.
- Use React Hook Form + Zod or another justified typed validation approach.
- Use Vitest + React Testing Library and Playwright for important flows.
- Define typed API contracts and consistent loading, empty, error, success and permission-denied states.
- Backend authorization remains authoritative; frontend route guards and hidden controls are only UX.
- Blade is not the product UI. A minimal shell is allowed only if the chosen serving model needs it.
