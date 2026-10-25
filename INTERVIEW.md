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
