# Architecture

CSS Dojo is one Bun workspace with four packages and one deployable container.

```mermaid
flowchart LR
  subgraph Browser
    UI[React client<br/>TanStack Router + Query<br/>CodeMirror 6]
    IF[Output iframe<br/>sandboxed srcDoc]
  end
  subgraph API["cssdojo-api (Docker on Render)"]
    H[Hono API<br/>zod validation, rate limits]
    BA[Better Auth<br/>GitHub, Google]
    W[Scorer worker<br/>in-process]
    CH[Chromium<br/>Playwright, JS and network off]
    ST[Static files<br/>client, targets, fonts]
  end
  PG[(Neon Postgres<br/>Drizzle)]
  UI -- "/api/*" --> H
  UI -- "/api/auth/*" --> BA
  UI --> IF
  H -- "insert submission + score_job" --> PG
  W -- "claim job FOR UPDATE SKIP LOCKED" --> PG
  W --> CH
  W -- "result, best score, belts" --> PG
  H -- "long-poll result" --> UI
  BA --> PG
  ST --> UI
```

## A Submit, step by step

```mermaid
sequenceDiagram
  participant C as Client
  participant A as API
  participant Q as score_jobs (Postgres)
  participant W as Worker
  participant R as Chromium
  C->>A: POST /api/submissions {challengeId, code, board}
  A->>A: rate limit, 50 KB cap, board open?
  A->>Q: insert submission + job (queued)
  A-->>C: 202 {id}
  C->>A: GET /api/submissions/:id?wait=1 (long-poll)
  W->>Q: claim next job (SKIP LOCKED)
  W->>R: render rest, hover, focus at 2x (fresh context, 5 s limit)
  W->>W: visual metric + outcome checks
  W->>Q: done, best score, belts
  A-->>C: result with per-check hints
```

## Packages

| Package | Role |
| --- | --- |
| `shared` | zod schemas and types for challenges, scores and the API; sanitizer; kata dates; fonts |
| `scorer` | renderer, visual metric, outcome checks, golden-set runner, target builder |
| `server` | Hono API, Drizzle schema and migrations, Better Auth, Postgres queue and worker |
| `client` | React app: play screen, kata, leaderboard, profile, gallery, asset sheet |

## Data model

```mermaid
erDiagram
  user ||--o| players : "signs in as"
  players ||--o{ submissions : makes
  players ||--o{ challenge_opens : opens
  players ||--o{ best_scores : holds
  players ||--o{ player_belts : earns
  challenges ||--o{ submissions : "scored against"
  challenges ||--o{ best_scores : ""
  challenges ||--o{ kata_schedule : "day N"
  submissions ||--o| score_jobs : queued
```

A guest is a `players` row with no `user_id`. On first sign-in its rows move to the user's player (see ADR 0004).

Decisions are recorded in [../adr](../adr).
