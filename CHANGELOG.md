# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Removed
- Unused exports and the unused `codemirror` meta package (found by `bunx fallow`).

### Fixed
- Live target: the focus state showed the hover fill (it drew the first focus-plus-hover frame). It now shows the real focus frame, in the live target and the :focus preview.
- Preview fonts failed to load on the split static-site deploy (no CORS on `/static/*`).
- Fonts are bundled by Vite so the static site does not depend on the API for UI fonts.
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
