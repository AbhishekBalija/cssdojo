import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { APP_VERSION } from "@cssdojo/shared";
import { env } from "./env";

export const app = new Hono();

app.get("/api/health", (c) => c.json({ ok: true, version: APP_VERSION }));

// The built client is served by the API too, so one container is a whole app.
app.use("/*", serveStatic({ root: env.CLIENT_DIST }));
app.get("*", serveStatic({ path: `${env.CLIENT_DIST}/index.html` }));
