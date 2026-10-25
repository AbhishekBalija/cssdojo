# 0001. One Bun workspace, one container

Status: accepted, 2026-10-25

## Context
The MVP runs on Render's free plan with a small team (one person). The scorer needs Chromium; the API needs Postgres.

## Decision
A Bun workspace with `shared`, `scorer`, `server` and `client`. One Docker image (on the pinned Playwright base) runs the API, the scorer worker and serves the built client. A static site deploy of the client exists as well.

## Consequences
- One deploy, one health check, no service-to-service auth.
- The scorer competes with the API for 512 MB, so it renders one Submit at a time. The queue (ADR 0003) lets a separate worker take over later with `server/src/worker.ts`.
