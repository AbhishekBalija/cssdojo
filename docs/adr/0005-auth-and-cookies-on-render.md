# 0005. Better Auth, and the API URL as the main app link

Status: accepted, 2026-10-25

## Context
GitHub and Google sign-in with sessions in our own Postgres. The brief deploys a static client and an API on separate `onrender.com` hosts. `onrender.com` is on the public suffix list, so those hosts are different sites.

## Decision
- Better Auth on the Drizzle adapter, mounted at `/api/auth/*`, callbacks on the API host.
- The API container also serves the client, and its URL is the main app link: same-origin, `SameSite=Lax` cookies, works in every browser.
- The static site sends the cookie cross-site (`SameSite=None; Secure`), which works where third-party cookies are allowed. Partitioned cookies were rejected: the OAuth callback sets the cookie with the API as the top-level site, so it would never be sent from the static site.
- A dev-only test login backs Playwright; the server refuses to start with it on over https.

## Consequences
- A custom domain with both on one site (for example `app.` and `api.` under one domain) would make the static site fully work later.

## Update, 2026-10-26: client on Vercel
The client moved to Vercel and proxies `/api` and `/static` to Render (see `docs/guides/vercel.md`). One origin again, so `SameSite=Lax` cookies work everywhere. Better Auth's base URL is the new `AUTH_URL` (the Vercel origin), and `PAGES_REDIRECT_TO_CLIENT` sends page requests on the Render host to Vercel.
