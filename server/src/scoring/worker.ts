import { eq, sql } from "drizzle-orm";
import { MAX_ATTEMPTS, scoreAnswer, type ScoreQueue } from "@cssdojo/scorer";
import type { ScoreResult } from "@cssdojo/shared";
import { getChallenge, renderer, targetFor } from "../challenges";
import type { Db } from "../db/client";
import { submissions } from "../db/schema";
import { recordScore } from "../progress";
import { rememberMaps, scoreEvents } from "./events";

const IDLE_WAIT_MS = 5 * 60_000;

async function processOne(db: Db, queue: ScoreQueue): Promise<boolean> {
  const job = await queue.claim();
  if (!job) return false;
  try {
    const [sub] = await db.select().from(submissions).where(eq(submissions.id, job.submissionId));
    if (!sub) throw new Error("submission not found");
    const challenge = getChallenge(sub.challengeId);
    if (!challenge) throw new Error(`unknown challenge ${sub.challengeId}`);
    await db.update(submissions).set({ status: "running" }).where(eq(submissions.id, sub.id));

    const result: ScoreResult = await scoreAnswer(renderer, await targetFor(challenge), sub.code, (maps) => rememberMaps(sub.id, maps));
    const scored = result.status === "scored";
    await db
      .update(submissions)
      .set({
        status: "done",
        result,
        score: scored ? result.score : null,
        visual: scored ? result.visual : null,
        checksPassed: scored ? result.checksPassed : null,
        checksRun: scored ? result.checksRun : null,
        finishedAt: sql`now()`,
      })
      .where(eq(submissions.id, sub.id));
    const progress = scored ? await recordScore(db, sub.id) : { newBest: false, beltsEarned: [], ranking: null };
    await queue.complete(job.id);
    scoreEvents.emit(sub.id, { result, ...progress });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`score job ${job.id} failed: ${message}`);
    await queue.fail(job.id, message);
    if (job.attempts >= MAX_ATTEMPTS) {
      await db.update(submissions).set({ status: "failed", error: message, finishedAt: sql`now()` }).where(eq(submissions.id, job.submissionId));
      scoreEvents.emit(job.submissionId, { error: message });
    }
  }
  return true;
}

/** Runs forever: score everything waiting, then sleep until new work is signalled. */
export async function runWorker(db: Db, queue: ScoreQueue, signal?: AbortSignal): Promise<void> {
  console.log("scorer worker started");
  while (!signal?.aborted) {
    const didWork = await processOne(db, queue).catch((err: unknown) => {
      console.error("scorer worker error", err);
      return false;
    });
    if (!didWork) await queue.waitForWork(IDLE_WAIT_MS);
  }
}
