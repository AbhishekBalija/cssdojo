import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { APP_VERSION } from "@cssdojo/shared";
import { allowedOrigins, env } from "./env";
import { cors } from "hono/cors";
import { adminRoutes } from "./routes/admin";
import { api } from "./routes/api";
import { authRoutes } from "./routes/auth";
import { meRoutes } from "./routes/me";
import { rankingRoutes } from "./routes/ranking";

export const app = new Hono();

app.get("/api/health", (c) => c.json({ ok: true, version: APP_VERSION }));

// The split deploy serves the client from another origin, so the API allows it with credentials.
app.use(
  "/api/*",
  cors({ origin: allowedOrigins, credentials: true, allowHeaders: ["content-type", "x-guest-id"], exposeHeaders: ["x-guest-id"] }),
);

app.route("/api", authRoutes);
app.route("/api", api);
app.route("/api", meRoutes);
app.route("/api", rankingRoutes);
// Mounted on its own path so its admin check never runs for other routes.
app.route("/api/admin", adminRoutes);

// Rendered targets (PNG frames, thumbnails, replay JSON) and the bundled fonts.
// They are public files, and the preview iframe has an opaque ("null") origin, so
// any origin may read them. Without this, fonts failed to load in the preview on
// the split static-site deploy.
app.use("/static/*", cors({ origin: "*" }));
app.use("/static/targets/*", serveStatic({ root: env.TARGETS_DIR, rewriteRequestPath: (p) => p.replace(/^\/static\/targets/, "") }));
app.use("/static/fonts/*", serveStatic({ root: env.FONTS_DIR, rewriteRequestPath: (p) => p.replace(/^\/static\/fonts/, "") }));

// When the client lives elsewhere (Vercel), pages on this host move there.
if (env.PAGES_REDIRECT_TO_CLIENT === "true") {
  app.get("*", (c, next) => {
    if (c.req.path.startsWith("/api/") || c.req.path.startsWith("/static/")) return next();
    const url = new URL(c.req.url);
    return c.redirect(new URL(url.pathname + url.search, env.CLIENT_URL).toString(), 308);
  });
}

// The built client is served by the API too, so one container is a whole app.
app.use("/*", serveStatic({ root: env.CLIENT_DIST }));
// Every other GET is a client route: answer with the SPA shell.
app.get("*", async (c) => {
  if (c.req.path.startsWith("/api/") || c.req.path.startsWith("/static/")) return c.notFound();
  const file = Bun.file(`${env.CLIENT_DIST}/index.html`);
  if (!(await file.exists())) return c.text("Client not built. Run bun run build.", 503);
  return c.html(await file.text());
});
