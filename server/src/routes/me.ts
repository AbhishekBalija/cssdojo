import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import {
  BELTS,
  BoardSchema,
  SOLVED_AT,
  addDays,
  longestRun,
  streakDetail,
  streakFrom,
  utcDate,
  type Belt,
  type LeaderboardRow,
  type MeView,
  type ProfileView,
  type RankingRow,
} from "@cssdojo/shared";
import { db } from "../db/client";
import { bestScores, challenges, playerBelts, players, submissions, user } from "../db/schema";
import { env } from "../env";
import { withPlayer, type PlayerVars } from "../lib/player";
import { solvedPerBelt } from "../progress";
import { badgeViews, syncBadges } from "../ranking/badges";
import { kataDates, rankOf, standings, totalPoints } from "../ranking/standings";
import { tickPacks } from "../ranking/tick";
import { packStandings, unreadCount } from "./ranking";
import { listPacks, stateOf } from "../packs";

export const meRoutes = new Hono<{ Variables: PlayerVars }>();
meRoutes.use("*", withPlayer);

meRoutes.get("/me", async (c) => {
  const playerId = c.get("playerId");
  const u = c.get("user");
  const empty = { white: 0, yellow: 0, green: 0, brown: 0, black: 0 };
  await tickPacks(db);
  // Signing in is itself a badge, and belts or streaks may have landed since the last check.
  if (playerId && u) await syncBadges(db, playerId);
  const dates = playerId ? await kataDates(db, playerId) : [];
  const wall = await standings(db);
  const detail = streakDetail(dates);
  const out: MeView = {
    player: { id: playerId ?? "", guest: !u },
    user: u ? { id: u.id, name: u.name, handle: u.handle, image: u.image } : null,
    streak: detail.current,
    points: playerId ? await totalPoints(db, playerId) : 0,
    wallRank: playerId ? rankOf(wall, playerId) : null,
    wallPlayers: wall.length,
    unread: playerId ? await unreadCount(playerId) : 0,
    streakDetail: detail,
    belts: playerId ? (await db.select({ belt: playerBelts.belt }).from(playerBelts).where(eq(playerBelts.playerId, playerId))).map((r) => r.belt) : [],
    solvedPerBelt: playerId ? await solvedPerBelt(db, playerId) : empty,
    testLogin: env.ENABLE_TEST_LOGIN === "true",
    providers: { github: !!env.GITHUB_CLIENT_ID && !!env.GITHUB_CLIENT_SECRET, google: !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET },
  };
  return c.json(out);
});

/** Signed-in players only: best score, ties broken by solve time. */
async function leaderboard(challengeId: string, board: string, playerId: string | null, limit = 50): Promise<LeaderboardRow[]> {
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
async function rankings(playerId: string | null, limit = 100): Promise<RankingRow[]> {
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

/** Share of a player's scored Submits that passed each outcome check. */
async function checkRates(playerId: string): Promise<ProfileView["checks"]> {
  const rows = await db.execute<{ id: string; label: string; pass_rate: number }>(sql`
    select c->>'id' as id, max(c->>'label') as label, avg(case when (c->>'pass')::boolean then 1 else 0 end)::float as pass_rate
    from ${submissions} s, jsonb_array_elements(s.result->'checks') c
    where s.player_id = ${playerId} and s.status = 'done' and s.result->>'status' = 'scored'
    group by c->>'id' order by 1`);
  return [...rows].map((r) => ({ id: r.id, label: r.label, passRate: Math.round(r.pass_rate * 100) / 100 }));
}

async function packFinishes(playerId: string): Promise<ProfileView["packs"]> {
  const out: ProfileView["packs"] = [];
  for (const pack of [...listPacks()].reverse()) {
    const state = stateOf(pack);
    if (state === "upcoming") continue;
    const ranked = await packStandings(pack);
    const rank = rankOf(ranked, playerId);
    if (rank) out.push({ number: pack.number, title: pack.title, rank, players: ranked.length, live: state === "live" });
  }
  return out;
}

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
  const dates = p ? await kataDates(db, p.id) : [];
  const today = utcDate();
  const last12 = Array.from({ length: 12 }, (_, i) => addDays(today, i - 11));
  const kataBests = p
    ? await db
        .select({ board: bestScores.board, score: bestScores.score })
        .from(bestScores)
        .where(and(eq(bestScores.playerId, p.id), inArray(bestScores.board, last12.map((d) => `kata:${d}`))))
    : [];
  const kataScore = new Map(kataBests.map((k) => [k.board, k.score]));
  const [solved] = p
    ? await db
        .select({ n: sql<number>`count(distinct ${bestScores.challengeId})::int` })
        .from(bestScores)
        .where(and(eq(bestScores.playerId, p.id), gte(bestScores.score, SOLVED_AT)))
    : [];
  const out: ProfileView = {
    handle: u.handle ?? u.name,
    name: u.name,
    image: u.image,
    joined: u.createdAt.toISOString(),
    streak: streakFrom(dates, today),
    points: p ? await totalPoints(db, p.id) : 0,
    wallRank: p ? rankOf(await standings(db), p.id) : null,
    solved: solved?.n ?? 0,
    longestStreak: longestRun(dates),
    badges: await badgeViews(db, p?.id ?? null),
    kata: last12.map((date) => ({ date, score: kataScore.get(`kata:${date}`) ?? null })),
    checks: p ? await checkRates(p.id) : [],
    packs: p ? await packFinishes(p.id) : [],
    belts: p ? (await db.select({ belt: playerBelts.belt }).from(playerBelts).where(eq(playerBelts.playerId, p.id))).map((r) => r.belt) : [],
    solvedPerBelt: p ? await solvedPerBelt(db, p.id) : empty,
    bests: bests.map((b) => ({ ...b, updatedAt: b.updatedAt.toISOString() })),
  };
  return c.json(out);
});
