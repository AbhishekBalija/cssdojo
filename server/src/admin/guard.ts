import { eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { testLoginEnabled } from "../auth";
import { db } from "../db/client";
import { user } from "../db/schema";
import { adminEmails } from "../env";
import { getSessionUser, type SessionUser } from "../lib/session";

// Learning note: this middleware is the only gate in front of /api/admin/*. The
// client hides the admin link too, but that is just for looks; the server decides.

export interface AdminVars {
  admin: SessionUser;
}

/** True when this signed-in user's email is in ADMIN_EMAILS and the provider verified it. */
export async function isAdmin(u: SessionUser | null): Promise<boolean> {
  if (!u || !adminEmails.has(u.email.toLowerCase())) return false;
  // The dev test login makes accounts without a provider, so it cannot verify emails.
  if (testLoginEnabled) return true;
  const [row] = await db.select({ verified: user.emailVerified }).from(user).where(eq(user.id, u.id));
  return !!row?.verified;
}

/** 404 for everyone else, so the admin routes do not show they exist. */
export const requireAdmin: MiddlewareHandler<{ Variables: AdminVars }> = async (c, next) => {
  const u = await getSessionUser(c);
  if (!(await isAdmin(u)) || !u) return c.json({ error: "Not found" }, 404);
  c.set("admin", u);
  await next();
};
