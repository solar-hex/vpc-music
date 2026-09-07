# Contributing to VPC Music

Thanks for contributing to VPC Music.

This repository is a pnpm monorepo with:

- `apps/api` — Express + Drizzle + PostgreSQL API
- `apps/web` — React + Vite SPA
- `shared` — shared constants and music utilities
- `scripts` — migration, deployment, and maintenance scripts

## Prerequisites

- Node.js 20+
- pnpm 9.15+
- Docker Desktop or a local PostgreSQL 16 instance

## Local setup

1. Clone the repo.
2. Install dependencies:
   - `pnpm install`
3. Create environment files:
   - `.env`
   - `apps/api/.env`
   - `apps/web/.env.local`
4. Start the local database:
   - `pnpm docker:up`
5. Push the schema:
   - `pnpm db:push`
6. Start the apps:
   - `pnpm dev`

Default local URLs:

- API: `http://localhost:3001`
- Web: `http://localhost:5176`

## Common commands

### Workspace

- `pnpm dev` — run API and web together
- `pnpm build` — build shared router artifacts
- `pnpm lint` — run web linting
- `pnpm typecheck` — run web type-checking
- `pnpm test:all` — run web, API and script tests (what CI runs)
- `pnpm test:scripts` — run script tests only
- `pnpm preflight` — run project preflight checks

### API

- `pnpm --filter @vpc-music/api dev`
- `pnpm --filter @vpc-music/api test`
- `pnpm db:generate`
- `pnpm db:migrate`
- `pnpm db:seed`

### Web

- `pnpm --filter @vpc-music/web dev`
- `pnpm --filter @vpc-music/web test`
- `pnpm --filter @vpc-music/web typecheck`
- `pnpm --filter @vpc-music/web lint`

## Development expectations

### 1. Keep changes focused

- Prefer the smallest change that fully solves the task.
- Avoid unrelated refactors in the same commit.
- Preserve existing public APIs unless the task requires a change.

### 2. Match existing patterns

- Use the current file and folder structure.
- Reuse shared helpers from `shared/` when behavior is needed in both apps.
- Keep role-aware behavior consistent: observers read, musicians edit songs, admins manage the team (see `docs/archive/role.md` for the original role model).

### 3. Add validation with the change

For feature work or bug fixes:

- add or update tests near the changed behavior
- run the most relevant test files locally
- update docs or task tracking when a milestone is completed

Examples:

- API route changes → add/update tests in `apps/api/src/test`
- UI changes → add/update tests in `apps/web/src/test`
- shared music utilities → add/update tests in `scripts` or relevant package tests

### 4. Preserve accessibility and stage usability

When updating UI:

- keep controls keyboard reachable
- keep labels clear
- avoid shrinking touch targets
- preserve dark-stage readability

## Coding guidelines

### API

- Keep routes authenticated unless they are intentionally public.
- Enforce org scoping on org-owned resources.
- Prefer route-level tests for auth, permission, and validation behavior.

### Web

- Favor small, testable React components.
- Keep state local unless it is clearly shared app state.
- Prefer existing design-system classes from `apps/web/src/styles/index.css`.

### Shared music logic

- Keep converters deterministic.
- Preserve ChordPro fidelity where possible.
- Add regression coverage for edge-case chord parsing and transposition.

## Pull request checklist

Before opening a PR, make sure to:

- [ ] keep the change scoped
- [ ] run the relevant tests
- [ ] update docs if behavior changed
- [ ] add a line to `CHANGELOG.md` under "Unreleased"
- [ ] include screenshots or notes for UI changes when helpful

## Commit guidance

A clean history is preferred.

Suggested approach:

- one commit for behavior
- one commit for tests if that makes review easier
- one commit for docs if substantial

If the work is small, a single well-named commit is fine.

## Reporting issues

When reporting a bug or proposing a feature, include:

- affected area (`api`, `web`, `shared`, or `scripts`)
- expected behavior
- actual behavior
- reproduction steps
- screenshots or sample ChordPro when relevant
