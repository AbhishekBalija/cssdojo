# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Removed
- Unused exports and the unused `codemirror` meta package (found by `bunx fallow`).

### Changed
- Client deploys to Vercel and proxies `/api` and `/static` to the Render API, so sign-in cookies are first-party. New API settings `AUTH_URL` and `PAGES_REDIRECT_TO_CLIENT` (see `docs/guides/vercel.md`).
- Every challenge now uses a standard value scale (Tailwind-like: 0, 1, 2, even values to 14, then steps of 4; a type scale for fonts; fixed border widths and radii). 223 odd values such as 27px or 3px were snapped. A test fails on any new off-scale value.
- Scoring is fairer on colour: inside the shape, a wrong colour is scored by the colour term only, not counted again as missing shape. A right-shaped answer with the wrong focus fill now scores about 86. Colour cost is `C^2` with `C = 1 - deltaE / 12`.

### Fixed
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
