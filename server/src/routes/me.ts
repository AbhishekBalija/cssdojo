import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { BoardSchema, streakFrom, utcDate, type LeaderboardRow, type MeView } from "@cssdojo/shared";
import { db } from "../db/client";
import { bestScores, playerBelts, players, user } from "../db/schema";
import { env } from "../env";
import { withPlayer, type PlayerVars } from "../lib/player";
import { solvedPerBelt } from "../progress";

export const meRoutes = new Hono<{ Variables: PlayerVars }>();
meRoutes.use("*", withPlayer);

export async function kataStreak(playerId: string): Promise<number> {
  const rows = await db.selectDistinct({ d: bestScores.kataDate }).from(bestScores).where(and(eq(bestScores.playerId, playerId), isNotNull(bestScores.kataDate)));
  return streakFrom(rows.map((r) => r.d).filter((d): d is string => !!d), utcDate());
}

meRoutes.get("/me", async (c) => {
  const playerId = c.get("playerId");
  const u = c.get("user");
  const empty = { white: 0, yellow: 0, green: 0, brown: 0, black: 0 };
  const out: MeView = {
    player: { id: playerId ?? "", guest: !u },
    user: u ? { id: u.id, name: u.name, handle: u.handle, image: u.image } : null,
    streak: playerId ? await kataStreak(playerId) : 0,
    belts: playerId ? (await db.select({ belt: playerBelts.belt }).from(playerBelts).where(eq(playerBelts.playerId, playerId))).map((r) => r.belt) : [],
    solvedPerBelt: playerId ? await solvedPerBelt(db, playerId) : empty,
    testLogin: env.ENABLE_TEST_LOGIN === "true",
    providers: { github: !!env.GITHUB_CLIENT_ID && !!env.GITHUB_CLIENT_SECRET, google: !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET },
  };
  return c.json(out);
});

/** Signed-in players only: best score, ties broken by solve time. */
export async function leaderboard(challengeId: string, board: string, playerId: string | null, limit = 50): Promise<LeaderboardRow[]> {
  const rows = await db
    .select({ playerId: bestScores.playerId, score: bestScores.score, solveMs: bestScores.solveMs, handle: user.handle, name: user.name, image: user.image })
    .from(bestScores)
    .innerJoin(players, eq(players.id, bestScores.playerId))
    .innerJoin(user, eq(user.id, players.userId))
    .where(and(eq(bestScores.challengeId, challengeId), eq(bestScores.board, board)))
    .orderBy(sql`${bestScores.score} desc`, asc(bestScores.solveMs))
    .limit(limit);
  return rows.map((r, i) => ({ rank: i + 1, handle: r.handle ?? r.name, image: r.image, score: r.score, solveMs: r.solveMs, me: r.playerId === playerId }));
}

meRoutes.get("/leaderboard/:id", async (c) => {
  const board = BoardSchema.safeParse(c.req.query("board") ?? "library");
  if (!board.success) return c.json({ error: "Bad board" }, 400);
  return c.json(await leaderboard(c.req.param("id"), board.data, c.get("playerId")));
});
