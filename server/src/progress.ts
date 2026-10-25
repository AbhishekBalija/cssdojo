import { and, eq, sql } from "drizzle-orm";
import { BELTS, SOLVED_AT, SOLVES_PER_BELT, type Belt } from "@cssdojo/shared";
import type { Db } from "./db/client";
import { bestScores, challengeOpens, challenges, playerBelts, submissions } from "./db/schema";

/** "library" or "kata:YYYY-MM-DD". */
export type Board = string;

export function kataBoard(date: string): Board {
  return `kata:${date}`;
}

export function boardKataDate(board: Board): string | null {
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

/**
 * After a scored Submit: keep it as the best score if it beats the old one,
 * then award any belt the player now qualifies for. Returns the belts earned now.
 */
export async function recordScore(db: Db, submissionId: string): Promise<{ newBest: boolean; beltsEarned: Belt[] }> {
  const [s] = await db.select().from(submissions).where(eq(submissions.id, submissionId));
  if (!s || s.score === null) return { newBest: false, beltsEarned: [] };
  const openedAt = await recordOpen(db, s.playerId, s.challengeId, s.board);
  const solveMs = Math.max(0, s.createdAt.getTime() - openedAt.getTime());

  const [prev] = await db
    .select()
    .from(bestScores)
    .where(and(eq(bestScores.playerId, s.playerId), eq(bestScores.challengeId, s.challengeId), eq(bestScores.board, s.board)));
  let newBest = false;
  if (!prev || s.score > prev.score) {
    newBest = true;
    await db
      .insert(bestScores)
      .values({ playerId: s.playerId, challengeId: s.challengeId, board: s.board, score: s.score, submissionId: s.id, solveMs, kataDate: boardKataDate(s.board) })
      .onConflictDoUpdate({
        target: [bestScores.playerId, bestScores.challengeId, bestScores.board],
        set: { score: s.score, submissionId: s.id, solveMs, updatedAt: sql`now()` },
      });
  }
  const beltsEarned = newBest && s.score >= SOLVED_AT ? await awardBelts(db, s.playerId) : [];
  return { newBest, beltsEarned };
}

/** Solved challenges per belt for one player (any board counts). */
export async function solvedPerBelt(db: Db, playerId: string): Promise<Record<Belt, number>> {
  const rows = await db
    .select({ belt: challenges.belt, n: sql<number>`count(distinct ${bestScores.challengeId})::int` })
    .from(bestScores)
    .innerJoin(challenges, eq(challenges.id, bestScores.challengeId))
    .where(and(eq(bestScores.playerId, playerId), sql`${bestScores.score} >= ${SOLVED_AT}`))
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
