import { keepOverridesFresh } from "./admin/overrides";
import { app } from "./app";
import { loadChallenges } from "./challenges";
import { db } from "./db/client";
import { env } from "./env";
import { queue } from "./scoring/runtime";
import { runWorker } from "./scoring/worker";

await loadChallenges();
await keepOverridesFresh(db);
if (env.RUN_SCORER_IN_PROCESS === "true") void runWorker(db, queue);

const server = Bun.serve({ port: env.PORT, fetch: app.fetch, idleTimeout: 30 });
console.log(`CSS Dojo API listening on ${server.url}`);
