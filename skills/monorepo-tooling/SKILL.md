# Monorepo tooling skill — OMS

Read `AGENTS.md` and `docs/11-monorepo-setup.md` first. Do not apply the sibling variant's architecture.

## Repository boundary
This folder is its own future project root. Do not begin work in the parent dual-pack directory or sibling variant.

## Composer and npm
Use root Composer autoloading for internal `packages/OMS/*` packages. Use one root npm manifest and Vite/TypeScript tooling by default. React + TypeScript should live with its UI package under `packages/OMS/*/src/Resources/assets/` where practical. A nested npm manifest is allowed only for a documented workspace/build boundary.

## Rules
- Commit Composer/npm lockfiles.
- Never commit `.env`, secrets, `node_modules`, generated build output or credentials.
- Keep path aliases, Vite entry points, test globs and scripts consistent with the selected layout.
- Validate configuration and scripts after edits.
- Do not blindly overwrite Laravel scaffold files; merge required configuration.
- Ensure CI runs backend tests, frontend tests, type checks, lint/build and e2e as appropriate.
- Do not claim checks passed without executing them.
