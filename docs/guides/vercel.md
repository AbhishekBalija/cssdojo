# Client on Vercel, API on Render

The client is a static Vite build on Vercel (project `cssdojo`, https://cssdojo-tau.vercel.app). The API, scorer and Postgres stay on Render and Neon.

`vercel.json` proxies `/api/*` and `/static/*` to `https://cssdojo-api.onrender.com`. To the browser everything is one origin, so:

- the client calls `/api` on its own origin (`VITE_API_URL` stays empty),
- sign-in cookies are first-party `SameSite=Lax` and work in Safari and Firefox too,
- OAuth callbacks go to the Vercel origin and are proxied to Render.

## API settings for this setup (Render, `cssdojo-api`)

| Key | Value |
| --- | --- |
| `CLIENT_URL` | `https://cssdojo-tau.vercel.app` |
| `AUTH_URL` | `https://cssdojo-tau.vercel.app` (Better Auth's base URL: callbacks and cookies live here) |
| `PAGES_REDIRECT_TO_CLIENT` | `true` (pages opened on the Render host move to Vercel) |
| `API_URL` | unchanged, `https://cssdojo-api.onrender.com` |

## OAuth apps

- GitHub OAuth app, Authorization callback URL: `https://cssdojo-tau.vercel.app/api/auth/callback/github`
- Google OAuth client, Authorised redirect URI: `https://cssdojo-tau.vercel.app/api/auth/callback/google`, and add `https://cssdojo-tau.vercel.app` to Authorised JavaScript origins.

Change the OAuth apps and the three API settings together; until then sign-in keeps using the Render host.

## Keep the two deploys on the same code

The client and API share types (for example the challenge's `fonts` list). Vercel deploys production from `main`, Render from the branch set in its service settings. Point both at the same branch, or a new client can meet an old API and fail. Every other branch gets a Vercel preview (behind Vercel sign-in).

## Free plan notes

The Render API sleeps after 15 minutes. The first request through the proxy then waits for it to wake (about 20 to 60 seconds); the site itself loads at once from Vercel's CDN.
