import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { APP_VERSION } from "@cssdojo/shared";
import { env } from "./env";
import { api } from "./routes/api";
import { meRoutes } from "./routes/me";

export const app = new Hono();

app.get("/api/health", (c) => c.json({ ok: true, version: APP_VERSION }));

app.route("/api", api);
app.route("/api", meRoutes);

// Rendered targets (PNG frames, thumbnails, replay JSON) and the bundled fonts.
app.use("/static/targets/*", serveStatic({ root: env.TARGETS_DIR, rewriteRequestPath: (p) => p.replace(/^\/static\/targets/, "") }));
app.use("/static/fonts/*", serveStatic({ root: env.FONTS_DIR, rewriteRequestPath: (p) => p.replace(/^\/static\/fonts/, "") }));

// The built client is served by the API too, so one container is a whole app.
app.use("/*", serveStatic({ root: env.CLIENT_DIST }));
// Every other GET is a client route: answer with the SPA shell.
app.get("*", async (c) => {
  if (c.req.path.startsWith("/api/") || c.req.path.startsWith("/static/")) return c.notFound();
  const file = Bun.file(`${env.CLIENT_DIST}/index.html`);
  if (!(await file.exists())) return c.text("Client not built. Run bun run build.", 503);
  return c.html(await file.text());
});
