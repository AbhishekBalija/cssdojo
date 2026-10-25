import { EventEmitter } from "node:events";
import { eq, sql } from "drizzle-orm";
import { MAX_ATTEMPTS, type ScoreJob, type ScoreQueue } from "@cssdojo/scorer";
import type { Db } from "../db/client";
import { scoreJobs } from "../db/schema";

/** A job left "running" longer than this is assumed lost (worker crashed) and retried. */
const STALE_SECONDS = 60;

/**
 * Postgres-backed job queue.
 * Learning note: `FOR UPDATE SKIP LOCKED` locks the row we pick and makes other
 * workers skip it instead of waiting, so many workers can share one table safely.
 */
export class PgScoreQueue implements ScoreQueue {
  private readonly signal = new EventEmitter();
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async enqueue(submissionId: string): Promise<void> {
    await this.db.insert(scoreJobs).values({ submissionId });
    this.signal.emit("work");
  }

  async claim(): Promise<ScoreJob | null> {
    const rows = await this.db.execute<{ id: string; submission_id: string; attempts: number }>(sql`
      UPDATE score_jobs SET status = 'running', locked_at = now(), attempts = attempts + 1
      WHERE id = (
        SELECT id FROM score_jobs
        WHERE status = 'queued'
           OR (status = 'running' AND locked_at < now() - make_interval(secs => ${STALE_SECONDS}) AND attempts < ${MAX_ATTEMPTS})
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING id, submission_id, attempts`);
    const row = rows[0];
    return row ? { id: row.id, submissionId: row.submission_id, attempts: row.attempts } : null;
  }

  async complete(jobId: string): Promise<void> {
    await this.db.update(scoreJobs).set({ status: "done", lockedAt: null }).where(eq(scoreJobs.id, jobId));
  }

  async fail(jobId: string, error: string): Promise<void> {
    await this.db
      .update(scoreJobs)
      .set({ status: sql`CASE WHEN ${scoreJobs.attempts} >= ${MAX_ATTEMPTS} THEN 'failed'::job_status ELSE 'queued'::job_status END`, error, lockedAt: null })
      .where(eq(scoreJobs.id, jobId));
  }

  waitForWork(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.signal.off("work", done);
        resolve();
      };
      const timer = setTimeout(done, ms);
      this.signal.on("work", done);
    });
  }
}
