# 0007. Rankings computed on read, pack jobs run lazily

Status: accepted, 2026-10-26

## Context
The approved ranking (docs/requirements/ranking.md) needs an all-time Wall, a board per Battle Pack and per challenge, "passed you" notifications and pack countdowns. The app runs on one free Render instance with no cron.

## Decision
- Each library best stores its `points`. Boards are grouped queries over `best_scores`, sorted by points then the time the total was reached.
- On a new best the scorer worker reads each affected board before and after the write and diffs them to find passed players and big moves.
- Pack jobs (opens soon, opened, final standings) run from busy routes at most once a minute and claim a flag column on `packs`, so each runs once.
- A finished pack's standings are frozen into `pack_results` from Submits made before it ended, ignoring Submits after opening solutions.

## Consequences
- No extra service or table to keep in sync. Two board reads per affected board on each new best, fine at hundreds of players.
- If traffic grows, the Wall can be cached in a table refreshed after each new best without changing the API.
- A pack can open a minute late if nobody visits; the client counts down from `opensAt` itself, so players do not see the delay.
