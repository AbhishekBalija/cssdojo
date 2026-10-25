# One image runs the API, the scorer worker and serves the built client.
# The Playwright base image pins the exact Chromium the scorer renders with,
# so scores are the same on every machine (local, CI, Render).
FROM oven/bun:1.4.4 AS bun
FROM mcr.microsoft.com/playwright:v1.63.0-noble AS base
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
COPY shared/package.json shared/
COPY scorer/package.json scorer/
COPY server/package.json server/
COPY client/package.json client/
# The optional "ca" build secret lets builds behind a TLS-inspecting proxy reach
# the npm registry. CI and Render do not need it.
RUN --mount=type=secret,id=ca,required=false \
  if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; \
  bun install --frozen-lockfile

FROM deps AS build
COPY . .
RUN bun run build

FROM base AS runtime
ENV NODE_ENV=production PORT=8787 CLIENT_DIST=/app/client/dist
COPY --from=build /app /app
# Prove at build time that the scorer can launch the pinned browser.
RUN bun scorer/src/check-browser.ts
EXPOSE 8787
CMD ["bun", "run", "server/src/start.ts"]
