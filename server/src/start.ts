// Container entry point: bring the database up to date, sync challenge
// metadata from disk, then start the API (which also runs the scorer worker).
import { runMigrations } from "./db/migrate";
import { seed } from "./db/seed";

await runMigrations();
const seeded = await seed();
console.log(`database ready: ${seeded.challenges} challenges, ${seeded.kata} kata days`);
await import("./index");
