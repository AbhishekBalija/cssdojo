import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { BELTS, BoardSchema, SOLVED_AT, streakFrom, utcDate, type Belt, type LeaderboardRow, type MeView, type ProfileView, type RankingRow } from "@cssdojo/shared";
import { db } from "../db/client";
import { bestScores, challenges, playerBelts, players, user } from "../db/schema";
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

/** Overall ranking of signed-in players: highest belt, then solved count, then total of library bests. */
export async function rankings(playerId: string | null, limit = 100): Promise<RankingRow[]> {
  const rows = await db.execute<{ player_id: string; handle: string | null; name: string; image: string | null; belts: Belt[] | null; solved: number; total: number }>(sql`
    select p.id as player_id, u.handle, u.name, u.image,
      (select array_agg(pb.belt::text) from player_belts pb where pb.player_id = p.id) as belts,
      count(*) filter (where b.score >= ${SOLVED_AT})::int as solved,
      coalesce(sum(b.score), 0)::float as total
    from players p
    join "user" u on u.id = p.user_id
    join best_scores b on b.player_id = p.id and b.board = 'library'
    group by p.id, u.handle, u.name, u.image`);
  const top = (belts: Belt[] | null) => (belts && belts.length ? BELTS.filter((b) => belts.includes(b)).at(-1) ?? null : null);
  return [...rows]
    .map((r) => ({ r, topBelt: top(r.belts) }))
    .sort((a, b) => (b.topBelt ? BELTS.indexOf(b.topBelt) : -1) - (a.topBelt ? BELTS.indexOf(a.topBelt) : -1) || b.r.solved - a.r.solved || b.r.total - a.r.total)
    .slice(0, limit)
    .map(({ r, topBelt }, i) => ({ rank: i + 1, handle: r.handle ?? r.name, image: r.image, topBelt, solved: r.solved, total: Math.round(r.total * 10) / 10, me: r.player_id === playerId }));
}

meRoutes.get("/rankings", async (c) => c.json(await rankings(c.get("playerId"))));

/** Public profile by handle: belts, streak and best scores. */
meRoutes.get("/profile/:handle", async (c) => {
  const [u] = await db.select().from(user).where(eq(user.handle, c.req.param("handle")));
  if (!u) return c.json({ error: "No such player" }, 404);
  const [p] = await db.select({ id: players.id }).from(players).where(eq(players.userId, u.id));
  const empty = Object.fromEntries(BELTS.map((b) => [b, 0])) as Record<Belt, number>;
  const bests = p
    ? await db
        .select({ challengeId: bestScores.challengeId, number: challenges.number, title: challenges.title, belt: challenges.belt, board: bestScores.board, score: bestScores.score, solveMs: bestScores.solveMs, updatedAt: bestScores.updatedAt })
        .from(bestScores)
        .innerJoin(challenges, eq(challenges.id, bestScores.challengeId))
        .where(eq(bestScores.playerId, p.id))
        .orderBy(sql`${bestScores.updatedAt} desc`)
        .limit(100)
    : [];
  const out: ProfileView = {
    handle: u.handle ?? u.name,
    name: u.name,
    image: u.image,
    joined: u.createdAt.toISOString(),
    streak: p ? await kataStreak(p.id) : 0,
    belts: p ? (await db.select({ belt: playerBelts.belt }).from(playerBelts).where(eq(playerBelts.playerId, p.id))).map((r) => r.belt) : [],
    solvedPerBelt: p ? await solvedPerBelt(db, p.id) : empty,
    bests: bests.map((b) => ({ ...b, updatedAt: b.updatedAt.toISOString() })),
  };
  return c.json(out);
});
