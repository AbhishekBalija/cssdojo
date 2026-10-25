# CSS Dojo

Practise CSS by rebuilding small, real UI pieces: buttons, cards, inputs, toggles. Each Submit is rendered in a pinned Chromium and scored 0 to 100: 70% visual match and 30% outcome checks (does hover change, can keyboard users see focus, is the text readable). How you build it is up to you.

Belts run white to black. A daily kata resets at 00:00 UTC.

> Status: 0.1.0, MVP in progress.

## Quick start

```bash
bun install
docker compose up --build   # Postgres + app on http://localhost:8787
```

Develop with hot reload:

```bash
cp .env.example .env.local
docker compose up db -d
bun run db:migrate && bun run db:seed
bun run dev                 # API :8787, client :5173
```

## Scripts

| Command | What it does |
| --- | --- |
| `bun run ci` | Lint, typecheck, unit tests |
| `bun run golden` | Golden-set scoring test (needs Chromium) |
| `bun run e2e` | Playwright end-to-end against a running app |
| `bun run targets` | Render target images and replay frames for every challenge |

## Layout

```
client/   React + Vite + Tailwind play screen and pages
server/   Hono API, Drizzle schema, Better Auth
shared/   zod schemas and types used everywhere
scorer/   Playwright renderer, visual metric, outcome checks, job queue worker
challenges/  one folder per challenge (and kata/)
docs/     requirements, architecture, ADRs, guides
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Licensed under [MIT](LICENSE).
