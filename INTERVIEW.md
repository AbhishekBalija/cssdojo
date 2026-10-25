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

## Scoring

### Comparing screenshots fairly
**What:** each frame scores `100 x S^2 x edge x (1 - meanDeltaE / 20)` over the component region only. S is the share of matching pixels (pixelmatch), deltaE is the average CIE Lab colour difference, and `edge` is a penalty for mistakes along the outline.
**Why:** averaging over the whole canvas let small components hide their errors. The edge term exists because a wrong corner radius changes only a few soft (anti-aliased) pixels, which plain pixelmatch ignores.
**Fairness:** a pixel that matches its neighbour within one device pixel is forgiven, so two correct techniques that land text half a CSS pixel apart both score about 100.
**How it was tuned:** the golden set (known-wrong answers with a maximum score) is the test suite for the metric itself.

### Outcome checks, not technique checks
**What:** checks look at rendered pixels and the final DOM: did hover change anything, is there a 3:1 focus change around the element, is text 4.5:1, is a button still a button.
**Why:** choosing the technique is the fun part, so no check may require a property, selector or layout method.

### Sandboxing untrusted HTML
**What:** sanitise (strip scripts, handlers, url(), imports), then render in a fresh browser context with JavaScript disabled and every network request aborted except our fonts, with a 5 second timeout.
**Why:** defence in depth: if the sanitiser misses something, the browser still cannot run it or reach the network.

### A promise-chain mutex
**What:** `tail = tail.then(task)` runs tasks one after another.
**Why:** the free host has 512 MB, so only one page renders at a time.
