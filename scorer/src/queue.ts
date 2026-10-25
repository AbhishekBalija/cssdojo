// The scorer only talks to a queue through this interface. Today it is backed by
// Postgres (server/src/scoring/pg-queue.ts); a Redis or managed queue later is a
// new adapter, not a rewrite.

export interface ScoreJob {
  id: string;
  submissionId: string;
  attempts: number;
}

export interface ScoreQueue {
  /** Adds a job for this submission and wakes a worker. */
  enqueue(submissionId: string): Promise<void>;
  /** Takes the oldest waiting job, or null when there is none. */
  claim(): Promise<ScoreJob | null>;
  complete(jobId: string): Promise<void>;
  fail(jobId: string, error: string): Promise<void>;
  /** Resolves when new work may be waiting (or after `ms`). */
  waitForWork(ms: number): Promise<void>;
}

export const MAX_ATTEMPTS = 3;
