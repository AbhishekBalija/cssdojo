// Standalone scorer worker entry point: `bun server/src/worker.ts`.
// Today the API runs the worker in-process (RUN_SCORER_IN_PROCESS=true) because
// the free host gives us one container. Splitting it out later means starting
// this file as its own service and setting RUN_SCORER_IN_PROCESS=false on the API.
// (A separate worker also needs a cross-process wake-up such as LISTEN/NOTIFY;
// until then it polls every few minutes and on every signal.)
import { keepOverridesFresh } from "./admin/overrides";
import { loadChallenges } from "./challenges";
import { db } from "./db/client";
import { PgScoreQueue } from "./scoring/pg-queue";
import { runWorker } from "./scoring/worker";

await loadChallenges();
await keepOverridesFresh(db);
await runWorker(db, new PgScoreQueue(db));
