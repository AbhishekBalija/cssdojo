import { eq } from "drizzle-orm";
import type { Context, MiddlewareHandler } from "hono";
import { db } from "../db/client";
import { players } from "../db/schema";
import { getSessionUser, type SessionUser } from "./session";

// Learning note: Hono middleware runs before route handlers. This one works out
// who is playing (a signed-in user or a guest) and stores it on the context.

export interface PlayerVars {
  /** Null only on read routes when a guest has not played yet. */
  playerId: string | null;
  user: SessionUser | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const GUEST_HEADER = "x-guest-id";

async function playerForUser(userId: string): Promise<string> {
  const [row] = await db.select({ id: players.id }).from(players).where(eq(players.userId, userId));
  if (row) return row.id;
  const [created] = await db.insert(players).values({ userId }).onConflictDoNothing().returning({ id: players.id });
  if (created) return created.id;
  const [again] = await db.select({ id: players.id }).from(players).where(eq(players.userId, userId));
  if (!again) throw new Error("could not create player");
  return again.id;
}

async function existingGuest(c: Context): Promise<string | null> {
  const header = c.req.header(GUEST_HEADER);
  if (!header || !UUID.test(header)) return null;
  const [row] = await db.select({ id: players.id, userId: players.userId }).from(players).where(eq(players.id, header));
  return row && !row.userId ? row.id : null;
}

async function guestPlayer(c: Context): Promise<string> {
  const existing = await existingGuest(c);
  if (existing) return existing;
  const [created] = await db.insert(players).values({}).returning({ id: players.id });
  if (!created) throw new Error("could not create guest");
  return created.id;
}

/**
 * Sets `playerId` and `user`. Writes (POST) create a guest player when needed;
 * reads only look one up, so crawlers never create rows.
 */
export const withPlayer: MiddlewareHandler<{ Variables: PlayerVars }> = async (c, next) => {
  const user = await getSessionUser(c);
  const create = c.req.method !== "GET";
  const playerId = user ? await playerForUser(user.id) : create ? await guestPlayer(c) : await existingGuest(c);
  c.set("user", user);
  c.set("playerId", playerId);
  if (!user && playerId) c.header(GUEST_HEADER, playerId);
  await next();
};

export function clientIp(c: Context): string {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? "local";
}
