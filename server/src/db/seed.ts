import { sql } from "drizzle-orm";
import { loadAllChallenges } from "@cssdojo/scorer";
import { db, sqlClient } from "./client";
import { challenges, kataSchedule } from "./schema";

// Copies challenge metadata from the folders on disk into Postgres and rebuilds
// the kata schedule. Idempotent: run it after every deploy.
export async function seed(): Promise<{ challenges: number; kata: number }> {
  const all = await loadAllChallenges();
  for (const c of all) {
    await db
      .insert(challenges)
      .values({ id: c.meta.id, number: c.meta.number, title: c.meta.title, belt: c.meta.belt, kind: c.meta.kind })
      .onConflictDoUpdate({
        target: challenges.id,
        set: { number: c.meta.number, title: c.meta.title, belt: c.meta.belt, kind: c.meta.kind, updatedAt: sql`now()` },
      });
  }
  const kata = all.filter((c) => c.meta.kind === "kata").sort((a, b) => (a.meta.kataDay ?? 0) - (b.meta.kataDay ?? 0));
  await db.transaction(async (tx) => {
    await tx.delete(kataSchedule);
    if (kata.length > 0) {
      await tx.insert(kataSchedule).values(kata.map((c, i) => ({ day: i + 1, challengeId: c.meta.id })));
    }
  });
  return { challenges: all.length, kata: kata.length };
}

if (import.meta.main) {
  const result = await seed();
  console.log(`seeded ${result.challenges} challenges, ${result.kata} kata days`);
  await sqlClient.end();
}
