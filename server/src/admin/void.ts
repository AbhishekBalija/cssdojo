import { and, asc, desc, eq, isNotNull, isNull, lte } from "drizzle-orm";
import { BELTS, SOLVES_PER_BELT, pointsFor, type Belt } from "@cssdojo/shared";
import type { Db } from "../db/client";
import { answerLocks, bestScores, challengeOpens, challenges, playerBelts, submissions } from "../db/schema";
import { packOf } from "../packs";
import { solvedPerBelt } from "../progress";

// Voiding a Submit (for example a copied answer) means it stops counting. The best
// score for that challenge is rebuilt from the player's other Submits, and belts the
// player no longer qualifies for are taken back. Badges already earned stay.

export interface VoidResult {
  before: { score: number | null; best: number | null; belts: Belt[] };
  after: { best: number | null; belts: Belt[] };
}

async function beltsOf(db: Db, playerId: string): Promise<Belt[]> {
  const rows = await db.select({ belt: playerBelts.belt }).from(playerBelts).where(eq(playerBelts.playerId, playerId));
  return BELTS.filter((b) => rows.some((r) => r.belt === b));
}

async function bestOf(db: Db, playerId: string, challengeId: string, board: string): Promise<number | null> {
  const [row] = await db
    .select({ score: bestScores.score })
    .from(bestScores)
    .where(and(eq(bestScores.playerId, playerId), eq(bestScores.challengeId, challengeId), eq(bestScores.board, board)));
  return row?.score ?? null;
}

/** Rebuilds one best score from the Submits that still count. */
async function rebuildBest(db: Db, playerId: string, challengeId: string, board: string): Promise<void> {
  // Opening solutions freezes the library best, so only Submits from before the lock may set it.
  const [lock] =
    board === "library"
      ? await db.select({ at: answerLocks.lockedAt }).from(answerLocks).where(and(eq(answerLocks.playerId, playerId), eq(answerLocks.challengeId, challengeId)))
      : [];
  const [top] = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.playerId, playerId),
        eq(submissions.challengeId, challengeId),
        eq(submissions.board, board),
        eq(submissions.status, "done"),
        isNotNull(submissions.score),
        isNull(submissions.voidedAt),
        lock ? lte(submissions.createdAt, lock.at) : undefined,
      ),
    )
    .orderBy(desc(submissions.score), asc(submissions.createdAt))
    .limit(1);

  const where = and(eq(bestScores.playerId, playerId), eq(bestScores.challengeId, challengeId), eq(bestScores.board, board));
  if (!top || top.score === null) {
    await db.delete(bestScores).where(where);
    return;
  }
  const [ch] = await db.select({ belt: challenges.belt }).from(challenges).where(eq(challenges.id, challengeId));
  const points = board === "library" && packOf(challengeId) && ch ? pointsFor(top.score, ch.belt) : 0;
  const [open] = await db
    .select({ at: challengeOpens.openedAt })
    .from(challengeOpens)
    .where(and(eq(challengeOpens.playerId, playerId), eq(challengeOpens.challengeId, challengeId), eq(challengeOpens.board, board)));
  const solveMs = Math.min(2_147_483_647, Math.max(0, top.createdAt.getTime() - (open?.at ?? top.createdAt).getTime()));
  const kataDate = board.startsWith("kata:") ? board.slice(5) : null;
  // updatedAt is when the player reached this score, which decides ties on the boards.
  const row = { score: top.score, points, submissionId: top.id, solveMs, updatedAt: top.createdAt };
  await db
    .insert(bestScores)
    .values({ playerId, challengeId, board, kataDate, ...row })
    .onConflictDoUpdate({ target: [bestScores.playerId, bestScores.challengeId, bestScores.board], set: row });
}

/** Takes back belts the player no longer has 5 solves for. Belts go in order, so a lost belt also drops every belt above it. */
async function trimBelts(db: Db, playerId: string): Promise<void> {
  const solved = await solvedPerBelt(db, playerId);
  const keep = new Set<Belt>();
  for (const belt of BELTS) {
    if (solved[belt] < SOLVES_PER_BELT) break;
    keep.add(belt);
  }
  for (const belt of await beltsOf(db, playerId)) {
    if (!keep.has(belt)) await db.delete(playerBelts).where(and(eq(playerBelts.playerId, playerId), eq(playerBelts.belt, belt)));
  }
}

/** Voids one Submit. Returns null when it does not exist or is already voided. */
export async function voidSubmission(db: Db, submissionId: string, adminId: string): Promise<VoidResult | null> {
  const [s] = await db.select().from(submissions).where(eq(submissions.id, submissionId));
  if (!s || s.voidedAt) return null;
  const before = { score: s.score, best: await bestOf(db, s.playerId, s.challengeId, s.board), belts: await beltsOf(db, s.playerId) };
  await db.update(submissions).set({ voidedAt: new Date(), voidedBy: adminId }).where(eq(submissions.id, submissionId));
  await rebuildBest(db, s.playerId, s.challengeId, s.board);
  await trimBelts(db, s.playerId);
  return { before, after: { best: await bestOf(db, s.playerId, s.challengeId, s.board), belts: await beltsOf(db, s.playerId) } };
}
