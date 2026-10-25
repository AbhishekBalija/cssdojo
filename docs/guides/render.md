# Deploying to Render

CSS Dojo runs on Render's free plan as two services in the **cssdojo** project, plus a Neon Postgres database.

| Service | Type | URL | What it serves |
| --- | --- | --- | --- |
| `cssdojo-api` | Docker web service | https://cssdojo-api.onrender.com | API, scorer (Chromium), rendered targets, fonts, and the built client |
| `cssdojo` | Static site | https://cssdojo.onrender.com | The built client only, calling the API cross-site |

**Use the API URL as the main app link.** It serves the client too, so sign-in cookies are same-origin and work in every browser. The static site works where third-party cookies are allowed (Chrome by default). Safari and Firefox block the session cookie there, because `onrender.com` is a public suffix and the two hosts are different sites.

`render.yaml` describes both services. They were created through the Render API with the same settings.

## Environment variables (API)

| Key | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string (secret) |
| `BETTER_AUTH_SECRET` | random 32 bytes, set once (secret) |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub OAuth app (secret) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client (secret) |
| `API_URL` | `https://cssdojo-api.onrender.com` |
| `CLIENT_URL` | `https://cssdojo.onrender.com` |
| `ENABLE_TEST_LOGIN` | `false` (the server refuses to start with it on over https) |
| `RUN_SCORER_IN_PROCESS` | `true` |

The static site needs only `VITE_API_URL=https://cssdojo-api.onrender.com`.

## What happens on deploy

1. Render builds the Dockerfile: install, build the client, render every challenge's target frames.
2. On start, `server/src/start.ts` runs the Drizzle migrations against `DATABASE_URL`, seeds challenges and the kata schedule, then starts the API with the scorer worker in-process.
3. Render checks `/api/health`.

Both services auto-deploy from `feature/mvp`. Switch the branch to `main` in each service's settings after the release PR merges.

## Free plan notes

- The API sleeps after 15 minutes without traffic. The first request after that takes about a minute.
- 512 MB of memory holds one Chromium. The scorer renders one Submit at a time and queues the rest in Postgres.

## Smoke test

```
curl https://cssdojo-api.onrender.com/api/health
curl https://cssdojo-api.onrender.com/api/kata/today
```
Then open the site, play a challenge, and sign in with GitHub or Google.
