import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { auth, testLoginEnabled } from "../auth";
import { db } from "../db/client";
import { mergeGuest } from "../merge";
import { GUEST_HEADER, withPlayer, type PlayerVars } from "../lib/player";

export const authRoutes = new Hono<{ Variables: PlayerVars }>();

// Better Auth answers everything under /api/auth: OAuth redirects, callbacks, session, sign-out.
authRoutes.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw));

const TEST_PASSWORD = "dojo-test-login-only";
const TestLoginSchema = z.object({ name: z.string().trim().min(2).max(30).regex(/^[\w .-]+$/) });

/**
 * Dev and CI only (ENABLE_TEST_LOGIN=true): signs in as a named test user without OAuth,
 * so Playwright can run the full loop. Off in production, where the route answers 404.
 */
authRoutes.post("/test-login", zValidator("json", TestLoginSchema), async (c) => {
  if (!testLoginEnabled) return c.notFound();
  const { name } = c.req.valid("json");
  const email = `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@test.cssdojo.local`;
  let res = await auth.api.signInEmail({ body: { email, password: TEST_PASSWORD }, asResponse: true });
  if (!res.ok) res = await auth.api.signUpEmail({ body: { email, password: TEST_PASSWORD, name }, asResponse: true });
  if (!res.ok) return c.json({ error: "Test login failed" }, 500);
  const out = c.json({ ok: true });
  for (const cookie of res.headers.getSetCookie()) out.headers.append("set-cookie", cookie);
  return out;
});

/** Called once after sign-in: moves the browser's guest progress onto the account. */
authRoutes.post("/me/merge", withPlayer, async (c) => {
  const user = c.get("user");
  const playerId = c.get("playerId");
  if (!user || !playerId) return c.json({ error: "Sign in first" }, 401);
  const guestId = c.req.header(GUEST_HEADER);
  if (!guestId || !/^[0-9a-f-]{36}$/i.test(guestId)) return c.json({ moved: 0, beltsEarned: [] });
  return c.json(await mergeGuest(db, guestId, playerId));
});
