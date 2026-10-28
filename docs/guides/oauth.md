# OAuth setup (GitHub and Google)

Sign-in uses Better Auth. A provider turns on when both its client id and secret are set; with neither, the sign-in page shows only what is configured.

## Callback URLs

| Provider | Callback URL |
| --- | --- |
| GitHub | `https://cssdojo-api.onrender.com/api/auth/callback/github` |
| Google | `https://cssdojo-api.onrender.com/api/auth/callback/google` |

For local development add `http://localhost:8787/api/auth/callback/<provider>`. GitHub OAuth apps take one callback each, so make a second app for local use.

## GitHub

1. GitHub, Settings, Developer settings, OAuth Apps, New OAuth App.
2. Homepage URL `https://cssdojo-api.onrender.com`, callback as above.
3. Copy the client id and generate a secret into `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

## Google

1. Google Cloud console, APIs and Services, Credentials, Create OAuth client id, Web application.
2. Authorised JavaScript origins: `https://cssdojo-api.onrender.com` and `https://cssdojo.onrender.com`.
3. Authorised redirect URI: the Google callback above.
4. Put the values in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. While the consent screen is in testing, only listed test users can sign in.

## Test login

`ENABLE_TEST_LOGIN=true` adds a name-only sign-in for local runs and CI (Playwright). It is backed by Better Auth's email and password flow and is refused on any https deploy.
