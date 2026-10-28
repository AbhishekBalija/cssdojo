import { and, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { BELTS, MAX_POINTS, SOLVED_AT, SOLVES_PER_BELT, pointsFor, utcDate, type Belt, type SubmitRanking } from "@cssdojo/shared";
import type { Db } from "./db/client";
import { answerLocks, bestScores, challengeOpens, challenges, kataDays, playerBelts, players, submissions, user } from "./db/schema";
import { packLabel, packOf, stateOf } from "./packs";
import { syncBadges } from "./ranking/badges";
import { announceMove, diffBoard, type BoardMove } from "./ranking/moves";
import { challengeStandings, playerTags, rankOf, standings, totalPoints } from "./ranking/standings";

/** "library" or "kata:YYYY-MM-DD". */
export type Board = string;

function boardKataDate(board: Board): string | null {
  return board.startsWith("kata:") ? board.slice(5) : null;
}

/** Records the first time a player opens a challenge on a board (start of solve time). */
export async function recordOpen(db: Db, playerId: string, challengeId: string, board: Board): Promise<Date> {
  await db.insert(challengeOpens).values({ playerId, challengeId, board }).onConflictDoNothing();
  const [row] = await db
    .select({ openedAt: challengeOpens.openedAt })
    .from(challengeOpens)
    .where(and(eq(challengeOpens.playerId, playerId), eq(challengeOpens.challengeId, challengeId), eq(challengeOpens.board, board)));
  return row?.openedAt ?? new Date();
}

export interface ScoreOutcome {
  newBest: boolean;
  beltsEarned: Belt[];
  ranking: SubmitRanking | null;
}

async function handleOf(db: Db, playerId: string): Promise<string | null> {
  const [row] = await db.select({ handle: user.handle, name: user.name }).from(players).innerJoin(user, eq(user.id, players.userId)).where(eq(players.id, playerId));
  return row ? (row.handle ?? row.name) : null;
}

async function isLocked(db: Db, playerId: string, challengeId: string): Promise<boolean> {
  const [row] = await db.select({ at: answerLocks.lockedAt }).from(answerLocks).where(and(eq(answerLocks.playerId, playerId), eq(answerLocks.challengeId, challengeId)));
  return !!row;
}

/** Library challenges of a pack the player has solved. */
async function packSolved(db: Db, playerId: string, ids: string[]): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(bestScores)
    .where(and(eq(bestScores.playerId, playerId), eq(bestScores.board, "library"), inArray(bestScores.challengeId, ids), gte(bestScores.score, SOLVED_AT)));
  return row?.n ?? 0;
}

/**
 * After a scored Submit: keep it as the best score if it beats the old one, give it
 * points (Battle Pack challenges on the library board), then work out Wall and pack
 * moves, belts and badges. Once solutions are opened the library best is frozen.
 */
export async function recordScore(db: Db, submissionId: string): Promise<ScoreOutcome> {
  const [s] = await db.select().from(submissions).where(eq(submissions.id, submissionId));
  if (!s || s.score === null) return { newBest: false, beltsEarned: [], ranking: null };
  const score = s.score;
  const [ch] = await db.select().from(challenges).where(eq(challenges.id, s.challengeId));
  if (!ch) return { newBest: false, beltsEarned: [], ranking: null };
  const openedAt = await recordOpen(db, s.playerId, s.challengeId, s.board);
  // solve_ms is a 32-bit column; a Submit 25+ days after the first open would overflow it.
  const solveMs = Math.min(2_147_483_647, Math.max(0, s.createdAt.getTime() - openedAt.getTime()));

  const library = s.board === "library";
  const pack = library ? packOf(s.challengeId) : undefined;
  const locked = library && (await isLocked(db, s.playerId, s.challengeId));
  const handle = await handleOf(db, s.playerId);
  const ranked = library && !!handle;
  const pointsBefore = await totalPoints(db, s.playerId);
  const wallBefore = ranked && pack ? await standings(db) : [];
  const packBefore = ranked && pack && stateOf(pack) === "live" ? await standings(db, pack.number) : [];
  const chBefore = ranked ? await challengeStandings(db, s.challengeId) : [];

  const [prev] = await db
    .select()
    .from(bestScores)
    .where(and(eq(bestScores.playerId, s.playerId), eq(bestScores.challengeId, s.challengeId), eq(bestScores.board, s.board)));
  const points = pack ? pointsFor(score, ch.belt) : 0;
  let newBest = false;
  if (!locked && (!prev || score > prev.score)) {
    newBest = true;
    await db
      .insert(bestScores)
      .values({ playerId: s.playerId, challengeId: s.challengeId, board: s.board, score, points, submissionId: s.id, solveMs, kataDate: boardKataDate(s.board) })
      .onConflictDoUpdate({
        target: [bestScores.playerId, bestScores.challengeId, bestScores.board],
        set: { score, points, submissionId: s.id, solveMs, updatedAt: sql`now()` },
      });
  }
  const beltsEarned = newBest && score >= SOLVED_AT ? await awardBelts(db, s.playerId) : [];

  let passed: string[] = [];
  let wallMove: BoardMove = { rankBefore: null, rankAfter: null, passed: [] };
  if (newBest && ranked && handle) {
    const chAfter = await challengeStandings(db, s.challengeId);
    const chHref = `/c/${s.challengeId}`;
    await announceMove(db, { key: `challenge:${s.challengeId}`, name: ch.title, href: chHref }, s.playerId, handle, diffBoard(chBefore, chAfter, s.playerId), chAfter);
    if (pack) {
      const wallAfter = await standings(db);
      wallMove = diffBoard(wallBefore, wallAfter, s.playerId);
      await announceMove(db, { key: "wall", name: "the Wall", href: "/leaderboard" }, s.playerId, handle, wallMove, wallAfter);
      // A finished pack shows frozen final standings, so moves there are not news.
      if (stateOf(pack) === "live") {
        const packAfter = await standings(db, pack.number);
        const board = { key: `pack:${pack.number}`, name: packLabel(pack.number), href: `/packs/${pack.number}`, live: true };
        await announceMove(db, board, s.playerId, handle, diffBoard(packBefore, packAfter, s.playerId), packAfter);
      }
      const tags = await playerTags(db, wallMove.passed);
      passed = wallMove.passed.map((id) => tags.get(id)?.handle).filter((h): h is string => !!h);
    }
  } else if (ranked && pack) {
    const rank = rankOf(wallBefore, s.playerId);
    wallMove = { rankBefore: rank, rankAfter: rank, passed: [] };
  }

  // Badges that depend on this moment: solved on the first scored Submit, or a pack cleared while live.
  const extra: string[] = [];
  if (score >= SOLVED_AT) {
    const [tries] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(submissions)
      .where(and(eq(submissions.playerId, s.playerId), eq(submissions.challengeId, s.challengeId), isNotNull(submissions.score)));
    if ((tries?.n ?? 0) === 1) extra.push("sharp-eye");
  }
  const solvedInPack = pack ? await packSolved(db, s.playerId, pack.challenges) : 0;
  if (pack && newBest && stateOf(pack) === "live" && solvedInPack === pack.challenges.length) extra.push("live-finisher");
  const badgesEarned = await syncBadges(db, s.playerId, extra);

  const today = `kata:${utcDate(s.createdAt)}`;
  const [kataDay] = s.board === today ? await db.select().from(kataDays).where(and(eq(kataDays.playerId, s.playerId), eq(kataDays.date, utcDate(s.createdAt)))) : [];
  const ranking: SubmitRanking = {
    points: library ? (newBest ? points : (prev?.points ?? 0)) : 0,
    maxPoints: pack ? MAX_POINTS[ch.belt] : 0,
    gained: newBest ? points - (prev?.points ?? 0) : 0,
    locked,
    wall: library ? { before: pointsBefore, after: await totalPoints(db, s.playerId), rankBefore: wallMove.rankBefore, rankAfter: wallMove.rankAfter, passed } : null,
    pack: pack ? { number: pack.number, title: pack.title, solved: solvedInPack } : null,
    badgesEarned,
    streakCounted: !!kataDay,
  };
  await db.update(submissions).set({ ranking }).where(eq(submissions.id, s.id));
  return { newBest, beltsEarned, ranking };
}

/** True when a kata Submit changed the starter code, which is what keeps a streak alive. */
export function changedStarter(starter: string, code: string): boolean {
  const squash = (t: string) => t.replace(/\s+/g, "");
  return squash(code) !== squash(starter);
}

/** Counts today's kata for the streak. Returns true when this Submit counted. */
export async function recordKataDay(db: Db, playerId: string, board: Board, starter: string, code: string): Promise<boolean> {
  const date = boardKataDate(board);
  if (!date || date !== utcDate() || !changedStarter(starter, code)) return false;
  await db.insert(kataDays).values({ playerId, date }).onConflictDoNothing();
  return true;
}

/** Solved challenges per belt for one player. Daily kata is for fun and streaks only, so it never counts toward belts. */
export async function solvedPerBelt(db: Db, playerId: string): Promise<Record<Belt, number>> {
  const rows = await db
    .select({ belt: challenges.belt, n: sql<number>`count(distinct ${bestScores.challengeId})::int` })
    .from(bestScores)
    .innerJoin(challenges, eq(challenges.id, bestScores.challengeId))
    .where(and(eq(bestScores.playerId, playerId), eq(challenges.kind, "challenge"), sql`${bestScores.score} >= ${SOLVED_AT}`))
    .groupBy(challenges.belt);
  const out = Object.fromEntries(BELTS.map((b) => [b, 0])) as Record<Belt, number>;
  for (const r of rows) out[r.belt] = r.n;
  return out;
}

/** Belts are earned in order: 5 solves of a belt, and every lower belt already earned. */
export async function awardBelts(db: Db, playerId: string): Promise<Belt[]> {
  const solved = await solvedPerBelt(db, playerId);
  const have = new Set((await db.select({ belt: playerBelts.belt }).from(playerBelts).where(eq(playerBelts.playerId, playerId))).map((r) => r.belt));
  const earned: Belt[] = [];
  for (const belt of BELTS) {
    if (have.has(belt)) continue;
    if (solved[belt] < SOLVES_PER_BELT) break;
    await db.insert(playerBelts).values({ playerId, belt }).onConflictDoNothing();
    earned.push(belt);
  }
  return earned;
}
