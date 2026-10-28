import { and, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { BELTS, SOLVED_AT, type Belt, type PlayerTag } from "@cssdojo/shared";
import type { Db } from "../db/client";
import { bestScores, challenges, events, kataDays, playerBelts, players, user } from "../db/schema";

// Standings are computed from best_scores on each request. At today's scale (hundreds
// of players, 30 pack challenges) one grouped query is cheap; if it grows, cache the
// Wall in a table refreshed after each new best.

export interface Standing {
  playerId: string;
  points: number;
  solved: number;
  /** When the player reached their current total: ties go to the earlier time. */
  reachedAt: Date;
}

/** Highest belt per player, for the belt-tinted banners. */
export async function topBelts(db: Db, playerIds: string[]): Promise<Map<string, Belt>> {
  const out = new Map<string, Belt>();
  if (playerIds.length === 0) return out;
  const rows = await db.select({ playerId: playerBelts.playerId, belt: playerBelts.belt }).from(playerBelts).where(inArray(playerBelts.playerId, playerIds));
  for (const r of rows) {
    const cur = out.get(r.playerId);
    if (!cur || BELTS.indexOf(r.belt) > BELTS.indexOf(cur)) out.set(r.playerId, r.belt);
  }
  return out;
}

/** Public name, picture and top belt for each player (signed-in players only). */
export async function playerTags(db: Db, playerIds: string[]): Promise<Map<string, PlayerTag>> {
  const out = new Map<string, PlayerTag>();
  if (playerIds.length === 0) return out;
  const rows = await db
    .select({ playerId: players.id, handle: user.handle, name: user.name, image: user.image })
    .from(players)
    .innerJoin(user, eq(user.id, players.userId))
    .where(inArray(players.id, playerIds));
  const belts = await topBelts(db, playerIds);
  for (const r of rows) out.set(r.playerId, { handle: r.handle ?? r.name, image: r.image, belt: belts.get(r.playerId) ?? null });
  return out;
}

/** Points-then-time order shared by every board. */
export function byPointsThenTime(a: Standing, b: Standing): number {
  return b.points - a.points || a.reachedAt.getTime() - b.reachedAt.getTime();
}

/**
 * Totals of signed-in players over pack challenges on the library board.
 * Pass a pack number to limit it to that pack.
 */
export async function standings(db: Db, packNumber?: number): Promise<Standing[]> {
  const rows = await db
    .select({
      playerId: bestScores.playerId,
      points: sql<number>`coalesce(sum(${bestScores.points}), 0)::int`,
      solved: sql<number>`(count(*) filter (where ${bestScores.score} >= ${SOLVED_AT}))::int`,
      reachedAt: sql<Date>`max(${bestScores.updatedAt})`,
    })
    .from(bestScores)
    .innerJoin(challenges, eq(challenges.id, bestScores.challengeId))
    .innerJoin(players, and(eq(players.id, bestScores.playerId), isNotNull(players.userId)))
    .where(
      and(
        eq(bestScores.board, "library"),
        packNumber === undefined ? isNotNull(challenges.packNumber) : eq(challenges.packNumber, packNumber),
      ),
    )
    .groupBy(bestScores.playerId);
  return rows.map((r) => ({ ...r, reachedAt: new Date(r.reachedAt) })).sort(byPointsThenTime);
}

/** One challenge's library board: best score, then whoever reached it first. Signed-in players only. */
export async function challengeStandings(db: Db, challengeId: string): Promise<Standing[]> {
  const rows = await db
    .select({ playerId: bestScores.playerId, score: bestScores.score, points: bestScores.points, reachedAt: bestScores.updatedAt })
    .from(bestScores)
    .innerJoin(players, and(eq(players.id, bestScores.playerId), isNotNull(players.userId)))
    .where(and(eq(bestScores.challengeId, challengeId), eq(bestScores.board, "library")));
  return rows
    .sort((a, b) => b.score - a.score || a.reachedAt.getTime() - b.reachedAt.getTime())
    .map((r) => ({ playerId: r.playerId, points: r.points, solved: r.score >= SOLVED_AT ? 1 : 0, reachedAt: r.reachedAt }));
}

/** All-time points of one player, signed in or not. */
export async function totalPoints(db: Db, playerId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${bestScores.points}), 0)::int` })
    .from(bestScores)
    .where(and(eq(bestScores.playerId, playerId), eq(bestScores.board, "library")));
  return row?.n ?? 0;
}

/** 1-based rank of a player in sorted standings, or null when absent. */
export function rankOf(sorted: Standing[], playerId: string): number | null {
  const i = sorted.findIndex((s) => s.playerId === playerId);
  return i < 0 ? null : i + 1;
}

/** Rank changes in the last 24 hours on a board, summed per player from "moved" events. */
export async function movedLastDay(db: Db, board: string): Promise<Map<string, number>> {
  const since = new Date(Date.now() - 86_400_000);
  const rows = await db
    .select({ playerId: events.playerId, delta: sql<number>`coalesce(sum(${events.delta}), 0)::int` })
    .from(events)
    .where(and(eq(events.board, board), eq(events.kind, "moved"), gte(events.createdAt, since)))
    .groupBy(events.playerId);
  return new Map(rows.filter((r) => r.playerId).map((r) => [r.playerId as string, r.delta]));
}

// ---------- Streaks ----------

export async function kataDates(db: Db, playerId: string): Promise<string[]> {
  const rows = await db.select({ d: kataDays.date }).from(kataDays).where(eq(kataDays.playerId, playerId));
  return rows.map((r) => r.d);
}
