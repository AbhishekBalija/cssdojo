# Agent guide for CSS Dojo

Read this before changing code.

- Runtime and package manager: Bun only (`bun add`, `bun run`, `bunx`). Never npm.
- TypeScript strict, no `any`. Validate inputs with zod (schemas live in `shared/`).
- Packages: `client` (React, Vite, Tailwind, shadcn-style components, lucide), `server` (Hono, Drizzle, Better Auth), `shared` (zod), `scorer` (Playwright, pixelmatch).
- Scoring rules are product decisions: 70% visual + 30% outcome checks, solved at 90. No check may require a specific property, selector or layout method. Hints say what is wrong, never how to fix it.
- Design tokens come from `client/src/tokens.css`. Do not invent colours. No em dashes in copy.
- Never commit `.env*` files except `.env.example`. Secrets come from the environment.
- Conventional Commits, CHANGELOG under Unreleased, SemVer. Never push to `main`.
- Done means: `bun run ci` and `bun run golden` pass, docs and INTERVIEW.md updated.
- Learning mode: add a 2 to 3 line comment when introducing a pattern (queue, middleware, ORM, auth).
