import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, sqlClient } from "./client";

// Applies every SQL file in server/drizzle that has not run yet. Safe to run
// on each start: Drizzle records applied migrations in its own table.
export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: path.join(import.meta.dirname, "../../drizzle") });
}

if (import.meta.main) {
  await runMigrations();
  console.log("migrations applied");
  await sqlClient.end();
}
