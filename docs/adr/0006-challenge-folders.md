# 0006. Challenges are folders in the repo

Status: accepted, 2026-10-25

## Context
Challenges need review, history and tests like code.

## Decision
One folder per challenge: `challenge.json` (zod-validated meta, inspiration with sources), `starter.html`, `reference.html`, `note.md`, and `golden/*.html` with expected score ranges. Kata are challenges with `kind: "kata"` and a `kataDay`. The seed syncs folders into Postgres at start; `bun run targets` renders target frames at image build.

## Consequences
- Adding a challenge is a PR, and CI proves it scores as intended.
- The 14-day kata cycle loops; adding kata extends it without code changes.
