import { db } from "../db/client";
import { PgScoreQueue } from "./pg-queue";

/** The process-wide queue the API enqueues into (and the in-process worker reads). */
export const queue = new PgScoreQueue(db);
