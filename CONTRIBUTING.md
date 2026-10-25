# Contributing to CSS Dojo

Thanks for helping. CSS Dojo is small on purpose, so a few rules keep it easy to work on.

## Setup

1. Install [Bun](https://bun.sh) 1.4 or newer and Docker.
2. `bun install`
3. `cp .env.example .env.local` and fill what you need.
4. `docker compose up db -d` for Postgres, then `bun run db:migrate && bun run db:seed`.
5. `bun run dev` starts the API (8787) and the client (5173).

## Before you open a PR

- `bun run ci` (lint, typecheck, unit tests) passes.
- `bun run golden` passes if you touched the scorer or a challenge.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`).
- Add a line to `CHANGELOG.md` under Unreleased.
- Branch names: `feature/...`, `fix/...`, `chore/...`, `docs/...`.

## Adding a challenge

See [docs/guides/challenges.md](docs/guides/challenges.md). Designs must be original: study real UI, never copy one source, and record your inspiration in `challenge.json`.

## Rules of thumb

- Bun only, never npm.
- TypeScript strict, no `any`.
- Validate every input with zod.
- No new dependency without a short reason in the PR.
