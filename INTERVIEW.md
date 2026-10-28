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

### Rankings computed on read
**What:** the Wall, pack and challenge boards are one grouped query over `best_scores` per request; each best stores its own `points`. Finished packs are frozen once into `pack_results`.
**Why:** at hundreds of players a `GROUP BY` is cheaper than keeping a ranking table in sync. The cache can come later without changing the API.
**Interview angle:** "who passed whom" is a diff of two sorted lists taken before and after the write (`diffBoard`), which is pure and unit tested.

### Jobs without a scheduler
**What:** pack countdown jobs (opens soon, opened, final standings) run from busy routes at most once a minute. Each job claims a flag column with `UPDATE ... WHERE flag IS NULL RETURNING`.
**Why:** no cron service on the free host. The conditional update makes each job run exactly once even with two processes.

### Tests against a real database
**What:** `ranking.db.test.ts` runs only when `TEST_DATABASE_URL` names a database with "test" in it.
**Why:** points, locks and pack finals are SQL; mocking the database would test the mock. The name guard stops it emptying a real database.

## Scoring

### Comparing screenshots fairly
**What:** each frame scores `100 x S^2 x edge x C^2`, with `C = 1 - meanDeltaE / 12`, over the component region only. S is the share of matching pixels (pixelmatch), deltaE is the average CIE Lab colour difference, and `edge` is a penalty for mistakes along the outline.
**Why:** averaging over the whole canvas let small components hide their errors. The edge term exists because a wrong corner radius changes only a few soft (anti-aliased) pixels, which plain pixelmatch ignores.
**Fairness:** a pixel that matches its neighbour within one device pixel is forgiven, so two correct techniques that land text half a CSS pixel apart both score about 100.
**Two thresholds, one job each:** pixelmatch runs strict (0.05) where only one image paints a pixel (missing or extra shape) and looser (0.15) where both paint it. Inside the shape a difference is mostly a wrong colour, and the colour term already scores that. Before, a right-shaped button in the wrong fill lost on shape and on colour at once and scored 8 for that frame; now about 40. The loose threshold is only used where both images are covered, because thin text pixels otherwise counted as anti-aliasing and inflated text-only starters.
**Why squared colour:** exact colours are given on the brief, so a visible colour miss should cost clearly, while tiny JPEG-level noise (deltaE under 1) costs almost nothing.
**How it was tuned:** the golden set (known-wrong answers with a maximum score) is the test suite for the metric itself.

### Outcome checks, not technique checks
**What:** checks look at rendered pixels and the final DOM: did hover change anything, is there a 3:1 focus change around the element, is text 4.5:1, is a button still a button.
**Why:** choosing the technique is the fun part, so no check may require a property, selector or layout method.
**Gotcha we hit:** a native `<button>` already has a hover tint and a focus ring, so untouched starter code passed every check and scored 32.9. Checks now only count once every required part sits roughly where the target has it (a placement gate using box overlap, intersection over union). Lesson: test the worst answer, not only the near misses.

### Sandboxing untrusted HTML
**What:** sanitise (strip scripts, handlers, url(), imports), then render in a fresh browser context with JavaScript disabled and every network request aborted except our fonts, with a 5 second timeout.
**Why:** defence in depth: if the sanitiser misses something, the browser still cannot run it or reach the network.

### A promise-chain mutex
**What:** `tail = tail.then(task)` runs tasks one after another.
**Why:** the free host has 512 MB, so only one page renders at a time.

### Showing the player what the score counted
**What:** after a Submit the scorer returns a small mismatch map per state (red = shape, amber = colour) built from the same pixel flags that make the score. The play screen lays it over the output until the code changes.
**Why:** the live Mismatch view is a CSS `mix-blend-mode: difference` between the player's browser and the target PNG. It hides small colour gaps (a background 7/255 off looks black) and shows font anti-aliasing noise from the player's OS that the scorer never sees. The map comes from the scorer, so it can't disagree with the score.
**How:** the maps are not stored. The worker puts them in an in-memory map keyed by submission id, capped at 300 entries and 10 minutes (a tiny time-to-live cache: a JS `Map` keeps insertion order, so the first key is always the oldest to evict). Only the request the play screen waits on returns them.

## Auth

**Q: How does a guest's progress survive signing in?**
A guest gets a random player id that the browser keeps and sends in an `x-guest-id` header. After the first sign-in the client calls `POST /api/me/merge` once. In one transaction the server moves the guest's submissions, opens and best scores to the user's player. Where both have a best for the same board, the higher score wins (then the faster solve), and the earlier first open is kept so solve times stay honest. Belts are re-checked after, since combined solves can cross a threshold.

**Q: Why a test login, and why can it not leak to production?**
OAuth cannot run in CI, so Playwright signs in through `POST /api/test-login`, backed by Better Auth's email and password flow. It exists only when `ENABLE_TEST_LOGIN=true`, and the server refuses to start with it on when `API_URL` is https.

**Q: Why is the API URL the main app link, not the static site?**
`onrender.com` is on the public suffix list, so a client on one subdomain and the API on another are different sites. The session cookie would have to be sent cross-site (`SameSite=None; Secure`), which Safari and Firefox block by default. Partitioned cookies do not help either: the OAuth callback sets the cookie with the API as the top-level site, so it would never be sent from the client's site. The API container serves the built client too, so on the API URL everything is same-origin and the cookie stays `Lax`. The static site still works in browsers that allow third-party cookies.

## Rendered art and WebGL

**Q: Why are the cloth banners WebGL and not a video?**
They bend, so CSS transforms cannot move them, and a pre-rendered loop is heavy (about 1 MB for three banners with transparency) and needs two formats. A small shader moves a grid of points like hanging cloth instead: a vertex shader displaces each point with a few slow sine waves that grow towards the hem, and a fragment shader lights it with a fabric model (wrap diffuse plus sheen) and a weave normal map made in Blender. The whole thing is about 13 KB of texture plus a few KB of code.

**Q: How does text end up on the cloth but stay accessible?**
The page lays the text out as usual. A painter reads each element's position and computed font, draws it into a 2D canvas, and the shader samples that as a texture, so the print folds with the cloth. The real text stays in the page with a transparent fill, so links work and screen readers read it.

## Deploy and maintenance

### Same origin through a proxy
**What:** Vercel serves the static client and rewrites `/api/*` to the API on Render. The browser only ever sees one origin.
**Why:** two `onrender.com` hosts are different sites (it is on the public suffix list), so the session cookie was third-party and Safari and Firefox dropped it. Through the proxy it is first-party.
**Gotcha:** OAuth must call back to the proxy's origin, not the API's, or the cookie lands on the wrong site. That is why Better Auth's base URL (`AUTH_URL`) is the Vercel origin.

**Q: How do migrations run in production?**
At container start, before the server listens: `server/src/start.ts` runs Drizzle's migrator, then seeds challenges and the kata schedule idempotently (upserts). A failed migration stops the start, so Render keeps the previous deploy serving.

**Q: How would you scale the scorer?**
The queue is already in Postgres with `SKIP LOCKED`, so a second process running `bun run --filter @cssdojo/server worker` (with `RUN_SCORER_IN_PROCESS=false` on the API) takes jobs without code changes. Each worker holds one Chromium and renders one Submit at a time.

**Q: How do you keep dead code out?**
`bunx fallow dead-code` lists unused files, exports and dependencies. It runs clean on 0.1.0.
