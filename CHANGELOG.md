# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Admin panel at `/admin` for emails in `ADMIN_EMAILS` (spec in `docs/requirements/admin.md`), with separate Battle Packs and Daily kata tabs: change Battle Pack dates (upcoming packs freely, live packs only longer), hide or unhide a broken challenge, find a player, hide them from boards, reset a handle, void a Submit (best score, points and belts are rebuilt), health and 30-day stats, and an audit log with a reason for every change.
- Migration `0002_admin`: `hidden_at` on challenges and players, `voided_at` and `voided_by` on submissions, and the `admin_actions` table.
- Ranking (rules in `docs/requirements/ranking.md`): points per Battle Pack challenge by belt (white 200 up to black 1000, `max * ((score - 50) / 50)^2`), the Wall (all-time points), ties to whoever got there first.
- Battle Packs: 5 packs of 6 challenges in `challenges/packs.json`. Upcoming packs hide their challenges, live packs run 28 days, finished packs keep frozen final standings and stay playable.
- Opening solutions locks your points on that challenge (`POST /api/challenges/:id/solutions/open`), then shows the top five answers and our reference. Solutions no longer need a 90.
- Streak days: a Submit on today's kata that changed the starter code.
- 18 badges, a notification bell ("passed you" at most once per board per hour), public live moves, notification settings and handle change (once per 30 days).
- API routes: `/packs`, `/boards/wall|pack|challenge|streaks`, `/events`, `/notifications`, `/kata/days`, `/settings`. `/me`, `/profile`, challenge progress and Submit results carry points, rank and badges.
- Migration `0001_ranking`: new tables and columns, plus a backfill of streak days from past kata bests.
- Front screens from the approved mockup (v49): the dojo shell (sidebar, LIVE line, streak tag, bell, toasts), Home, the Daily kata page with its calendar, Battle Packs and the pack page, the Wall and the pack, challenge and streak boards, profile and public profile with badges, Settings, Sign in, and empty, error and 404 states.
- Play screen: a slim header with the pack, belt, a target picker and Prev / Next; CSS completions and folded markup in the editor; a result card after a new best or first solve; a belt earned card; a Solutions page that asks before locking your points.
- Interaction polish (`motion/approved-polish.md`): stacked toasts, rolling digits, gliding tabs, page and theme fades, a streak tag that swings only when it grows, mismatch (hold D), onion skin (hold G), a measuring crosshair, states playback, hover frames on tiles, full-screen confetti on a first solve, an optional solve sound and a quiet "Saved" label.
- Settings: handle, notifications, theme, reduce motion, sound and editor ligatures.
- Test database: set `TEST_DATABASE_URL` and an `.env.test` (see CONTRIBUTING), then `bun run db:test:migrate`, `db:test:seed` and `dev:test` keep test data out of the dev database. `bun run test` now loads `.env.local`, so the Postgres tests run locally.

### Documentation
- Handoff for local agents: `docs/context.md` (decisions, hosting, open PRs, open items) and a fuller `.agents/AGENTS.md`, with root `CLAUDE.md` as a symlink to it so Claude Code loads it.

### Removed
- Unused exports and the unused `codemirror` meta package (found by `bunx fallow`).

### Changed
- Pack dates now live in Postgres. `packs.json` only sets a new pack's first dates, so `db:seed` no longer resets a date changed in the admin panel.
- Postgres tests run one file at a time (a separate Vitest project), since they share the test database.
- Daily kata is for fun and streaks only: kata solves no longer count toward belts or belt badges.
- Play screen: the challenge description is gone and the outcome checks fold into one line with a pass count.
- Reset in the editor now offers Undo; toasts clear when you move to another challenge.
- Nine targets with layout mishaps fixed: ticket stub and boarding pass text no longer sits on the card edge, profile card no longer fills the canvas, breadcrumbs fit with room for the focus ring, text link ring no longer touches the next word, accordion focus ring follows the rounded card, avatar initials are no longer cut, tabs lose the ghost hover underline. The scorer puts the caret at the end after tabbing into a field instead of showing the value selected.
- Icons are given, never drawn: the ticks in Done chip and Stepper, the tooltip arrow and the breadcrumb separators now ship as inline SVG in the starter. A test fails if a reference uses an `<svg>` its starter lacks.
- Client deploys to Vercel and proxies `/api` and `/static` to the Render API, so sign-in cookies are first-party. New API settings `AUTH_URL` and `PAGES_REDIRECT_TO_CLIENT` (see `docs/guides/vercel.md`).
- Every challenge now uses a standard value scale (Tailwind-like: 0, 1, 2, even values to 14, then steps of 4; a type scale for fonts; fixed border widths and radii). 223 odd values such as 27px or 3px were snapped. A test fails on any new off-scale value.
- Scoring is fairer on colour: inside the shape, a wrong colour is scored by the colour term only, not counted again as missing shape. A right-shaped answer with the wrong focus fill now scores about 86. Colour cost is `C^2` with `C = 1 - deltaE / 12`.

### Fixed
- Light theme: cards, pack banners and the today / next highlight used heavy dark-theme shadows. They now have lighter ones.
- The pixel label on the Output slider picked up the close button's `.x` style.
- Pack countdowns under a day show seconds, so the clock visibly ticks.
- Play and the main pack card button open the pack screen (`/packs/:n`) instead of the first challenge.
- Pack countdowns: the chip and big clock styles hit each rolling digit and garbled the numbers.
- Under 1120px the live target frame was hidden by the header LIVE rule.
- Phone play: the score cards covered the Editor / Output / Target tabs.
- Phone: pages scrolled sideways (mountain art), the menu button covered the LIVE label, the streak tag overlapped page titles, and board tables squeezed player names.
- Light theme: Wall pillar labels were white on white.
- A missing challenge showed "Loading" for several seconds before the error; 404s no longer retry.
- Profile kata chart: scores under 70 sat on the 70 line, days before you joined showed "missed", and labels overlapped the axis.
- Guests who solve a challenge with nothing else to show are told to sign in instead of "Nothing moved this time".
- Signing out resets the "Get started" list; My attempts and the challenge leaderboard show a loading state; "No belt yet" and "1 player" wording on boards; no request for pack 0.
- Mismatch now tells the truth: the :hover and :focus preview marks only what the scorer hovers or tabs to (7 challenges showed false red), and after a Submit the scorer's own map (red = shape, amber = colour) replaces the live overlay until the code changes. A Submit whose stage background colour differs from the target now says so.
- `bun run dev`, `db:migrate` and `db:seed` did not see the root `.env.local`: `bun run --filter` executes inside the package folder, where bun does not look up parent env files. They now pass `--env-file=.env.local`.
- The player middleware ran once per route group, so a guest's first POST could create several guest rows. It now runs once per request.
- A Submit more than 24 days after first opening a challenge overflowed the solve-time column and failed to record.
- Scoring: untouched starter code no longer passes the outcome checks. Checks only count once every required part is placed roughly like the target (starter on #001 went from 32.9 with 5/5 checks to 2.9 with 0/5). Golden set now caps starter answers at 15.
- Live target: clicking it and pressing Tab now shows its keyboard focus state. Before, the code editor kept Tab for indenting, so the focus state was unreachable from the keyboard.
- Live target: the focus state showed the hover fill (it drew the first focus-plus-hover frame). It now shows the real focus frame, in the live target and the :focus preview.
- Preview fonts failed to load on the split static-site deploy (no CORS on `/static/*`).
- Fonts are bundled by Vite so the static site does not depend on the API for UI fonts.
- The theme follows the system light or dark setting until you pick one.
- Long lines wrap in the editor instead of running off the edge.
- Challenge #022: the "Most popular" badge no longer wraps onto two lines.
- Submit stays disabled until the starter code has loaded. An early click used to submit an empty answer, which came back as "missing parts".
- Play screen no longer shrinks to its content width (a Tailwind `fixed` utility collided with our class name).

### Added
- Play screen lists the fonts a target uses, next to its colours. A click copies a ready `font-family` value.
- Bun workspace with `client`, `server`, `shared` and `scorer` packages, all at 0.1.0.
- TypeScript strict mode, ESLint, Vitest and Playwright setup.
- Dockerfile (pinned Playwright Chromium) and `docker-compose.yml` with local Postgres.
- GitHub Actions CI: lint, typecheck, unit tests, Docker build.
- Drizzle schema: Better Auth tables, players (guest or user), challenges, kata schedule, opens, submissions, score jobs queue, best scores, belts. First migration `0000_init`.
- Seed script that syncs challenge folders into Postgres and rebuilds the kata schedule; container start runs migrations and seed.
- Challenge metadata zod schema in `shared` and a folder loader in `scorer`.
- Scorer package: Playwright renderer (one shared Chromium, fresh JS-off context per Submit, only bundled fonts load, 5 s limit), visual metric (shape, colour and an edge penalty, one-device-pixel drift forgiven), outcome checks with hints, sanitizer, golden-set runner.
- Postgres score queue (`FOR UPDATE SKIP LOCKED`) behind a `ScoreQueue` interface, worker loop, best-score and belt recording.
- Bundled Onest, Martian Mono and Instrument Serif fonts (OFL).
- `bun run targets`: renders each challenge's target frames, thumbnail and live-target canvas replay (Web Animations paused and scrubbed) into `.generated/targets`, served at `/static/targets`; runs during the Docker build.
- Challenge folder tests: schema, golden count, hooks kept in the starter, kata days without gaps.
- Challenge authoring guide `docs/guides/challenges.md`.
- Play screen: React 19 client with TanStack Router and Query, CodeMirror 6 editor, output, target and diff views, live-target replay, outcome checks with hints, score tiles, attempts, solutions after 90, leaderboard dialog, phone pane switcher and a "best on desktop" note.
- API: challenge list and detail, open, submit (rate limited, 50 KB cap), long-poll for results, attempts, progress, nudge after 3 Submits, `/me`, leaderboard, today's kata.
- Privacy and terms pages.
- Challenges 002 to 012 (white and yellow belts), each with a golden set and recorded inspiration.
- Challenges 013 to 030 (green, brown and black belts), each with a golden set and recorded inspiration.
- Sign-in with Better Auth: GitHub and Google OAuth, unique public handles, a dev-only test login (`ENABLE_TEST_LOGIN`, refused on https deploys), and guest progress merged onto the account on first sign-in (best score wins, earliest open kept, belts re-checked).
- Daily kata: 14 kata (k-101 to k-114) with golden sets, a 14-day cycle from 2026-10-26 that loops back to day 1, a kata board per UTC day that closes at 00:00 UTC, and a streak of consecutive kata days.
- Leaderboard page: today's kata board, overall ranking (highest belt, then solved count, then total best score) and per-challenge boards; `GET /api/rankings`.
- Profile pages `/me` and `/u/:handle`: belt progress toward each belt, streak, best scores and sign out; `GET /api/profile/:handle`.
- Brand assets from `bun run brand`: SVG mark, dark and light logos, app icon, PNG favicons and touch icons, web manifest, belt badges (dark and light), the 1200x630 share image and its HTML template, Open Graph tags.
- Empty and error state components, a router-level error page, and the `/assets` review sheet.
- Render deploy: `render.yaml` (Docker API service plus static client site), guides `docs/guides/render.md` and `docs/guides/oauth.md`.
- Architecture overview with Mermaid diagrams, six ADRs, draft v0.1.0 release notes (`docs/releases/v0.1.0.md`), and more interview notes.
- Gallery review page `/gallery` and `GET /api/gallery`: target frames, belt, checks, golden set and inspiration per challenge and kata.
- MIT license, contributing guide, code of conduct, security policy, PR and issue templates.
