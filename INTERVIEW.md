# Interview notes

Concepts used in CSS Dojo, from basic to advanced, with why and how they were built. Grows with every task.

## Basics

### Monorepo with Bun workspaces
**What:** one repository, several packages (`client`, `server`, `shared`, `scorer`) that import each other by name.
**Why here:** the client and the server must agree on the shape of a challenge and a score. Putting zod schemas in `shared` gives one source of truth.
**How:** the root `package.json` lists `workspaces`; packages depend on each other with `workspace:*`.

### TypeScript strict mode
**What:** compiler flags that forbid implicit `any`, unchecked nulls and unsafe indexing (`noUncheckedIndexedAccess`).
**Why:** most runtime bugs in JS are "undefined is not a function". Strict mode moves them to compile time.

### Environment validation
**What:** parse `process.env` with a zod schema at startup (`server/src/env.ts`).
**Why:** a missing or malformed variable fails immediately with a readable message, not later in a request.

## Delivery

### Docker image with a pinned browser
**What:** the image is based on `mcr.microsoft.com/playwright:v1.63.0-noble`, which ships an exact Chromium build.
**Why:** pixel scores must be identical on a laptop, in CI and in production. Fonts and the browser version change rendering, so both are pinned.

## Data

### ORM and migrations (Drizzle)
**What:** tables are TypeScript objects (`server/src/db/schema.ts`). `drizzle-kit generate` diffs them and writes SQL files; `migrate()` applies new files on start.
**Why:** typed queries catch column typos at compile time, and SQL migration files are reviewable in PRs.
**Interview angle:** migrations must be forward-only and safe to run twice. Drizzle records applied files in its own table.

### Guests and users as one "player"
**What:** every row (submissions, best scores) points at a `players` row. A guest gets a player with no user; signing in links or merges it.
**Why:** guest progress carries over with one UPDATE instead of copying data between two shapes.

### A job queue in Postgres
**What:** `score_jobs` rows are claimed with `SELECT ... FOR UPDATE SKIP LOCKED`.
**Why:** no Redis needed yet. `SKIP LOCKED` lets several workers pull from the same table without taking the same job, and a crashed worker's lock is released with its transaction.
