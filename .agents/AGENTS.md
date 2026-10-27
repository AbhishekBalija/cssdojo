# Agent guide for CSS Dojo

Read this before changing code. Then read `docs/context.md` for product decisions, hosting, open PRs and known open items.

## Working with Abhi

- Abhi wants full control of decisions. Ask before coding when requirements are unclear or several good options exist. If an approach has a flaw, say so directly.
- Do not refactor working code, add unrequested features, or add a dependency without proposing it with a reason first.
- Confirm before destructive steps: `rm -rf`, `git reset --hard`, force push, DB drops, schema migrations.
- Learning mode: Abhi forgets syntax easily. When you use a pattern that is new to them (queue, middleware, ORM, auth, transactions), add a 2 to 3 line note on what and why. Add interview-relevant concepts to `INTERVIEW.md`.
- Verify UI changes in a real browser with screenshots before saying they work. Test the worst answer (untouched starter), not only near misses.
- Make players' life easy: icons and glyphs ship ready in the starter (see `docs/guides/challenges.md`).
- Remind Abhi to commit after a meaningful chunk of work.

## Stack rules

- Runtime and package manager: Bun only (`bun add`, `bun run`, `bunx`). Never npm.
- TypeScript strict, no `any`. Validate inputs with zod (schemas live in `shared/`). Matt Pocock-style TypeScript patterns.
- Packages: `client` (React, Vite, Tailwind, shadcn-style components, lucide), `server` (Hono, Drizzle, Better Auth), `shared` (zod), `scorer` (Playwright, pixelmatch).
- Tests: Vitest for units, Playwright for e2e. DB tests need `TEST_DATABASE_URL` (the name must contain "test").
- Scoring rules are product decisions: 70% visual + 30% outcome checks, solved at 90. No check may require a specific property, selector or layout method. Hints say what is wrong, never how to fix it.
- Daily kata never counts toward belts or points. Points come from Battle Pack challenges only.
- Design tokens come from `client/src/tokens.css`. Do not invent colours. Motion follows `motion/approved-polish.md`. No em dashes in copy or docs.
- Never commit `.env*` files except `.env.example`. Secrets come from the environment. Keep `.env.example` in sync.

## Git

- Conventional Commits, CHANGELOG under Unreleased, SemVer.
- Branch names `fix/`, `feature/`, `chore/`, `docs/`. Open PRs into `feature/mvp` (ready for review, not draft) until release PR #15 merges. Never push to `main`.
- PR body: what changed, why, how to test, screenshots for UI.

## Done means

- `bun run ci` and `bun run golden` pass.
- Docs, `INTERVIEW.md` and `.env.example` are in sync.
- A summary of what changed, files touched, and a suggested commit message.
- Run `bunx fallow` now and then for unused code.
