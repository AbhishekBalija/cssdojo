# One image runs the API, the scorer worker and serves the built client.
# The Playwright base image pins the exact Chromium the scorer renders with,
# so scores are the same on every machine (local, CI, Render).
FROM mcr.microsoft.com/playwright:v1.63.0-noble AS base
ENV BUN_INSTALL=/usr/local/bun PATH=/usr/local/bun/bin:$PATH
RUN apt-get update && apt-get install -y --no-install-recommends unzip && rm -rf /var/lib/apt/lists/* \
  && curl -fsSL https://bun.sh/install | bash -s "bun-v1.4.4"
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
COPY shared/package.json shared/
COPY scorer/package.json scorer/
COPY server/package.json server/
COPY client/package.json client/
RUN bun install --frozen-lockfile

FROM deps AS build
COPY . .
RUN bun run build

FROM base AS runtime
ENV NODE_ENV=production PORT=8787 CLIENT_DIST=/app/client/dist
COPY --from=build /app /app
# Prove at build time that the scorer can launch the pinned browser.
RUN bun -e "const { chromium } = await import('playwright'); const b = await chromium.launch(); await b.close();"
EXPOSE 8787
CMD ["bun", "run", "server/src/start.ts"]
