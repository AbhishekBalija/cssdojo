# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
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
- MIT license, contributing guide, code of conduct, security policy, PR and issue templates.
