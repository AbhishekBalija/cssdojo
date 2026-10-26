import { sql } from "drizzle-orm";
import { loadAllChallenges } from "@cssdojo/scorer";
import { db, sqlClient } from "./client";
import { MAX_POINTS, POINTS_FLOOR } from "@cssdojo/shared";
import { listPacks, packOf } from "../packs";
import { bestScores, challenges, kataSchedule, packs } from "./schema";

// Copies challenge metadata from the folders on disk into Postgres and rebuilds
// the kata schedule. Idempotent: run it after every deploy.
export async function seed(): Promise<{ challenges: number; kata: number; packs: number }> {
  const all = await loadAllChallenges();
  const known = new Set(all.map((c) => c.meta.id));
  for (const p of listPacks()) {
    const missing = p.challenges.filter((id) => !known.has(id));
    if (missing.length) throw new Error(`packs.json: pack ${p.number} names unknown challenges ${missing.join(", ")}`);
    const offBelt = all.filter((c) => p.challenges.includes(c.meta.id) && c.meta.belt !== p.belt).map((c) => c.meta.id);
    if (offBelt.length) throw new Error(`packs.json: pack ${p.number} is ${p.belt} but has ${offBelt.join(", ")}`);
    await db
      .insert(packs)
      .values({ number: p.number, title: p.title, description: p.description, belt: p.belt, opensAt: p.opens, endsAt: p.ends })
      .onConflictDoUpdate({ target: packs.number, set: { title: p.title, description: p.description, belt: p.belt, opensAt: p.opens, endsAt: p.ends } });
  }
  for (const c of all) {
    const packNumber = packOf(c.meta.id)?.number ?? null;
    await db
      .insert(challenges)
      .values({ id: c.meta.id, number: c.meta.number, title: c.meta.title, belt: c.meta.belt, kind: c.meta.kind, packNumber })
      .onConflictDoUpdate({
        target: challenges.id,
        set: { number: c.meta.number, title: c.meta.title, belt: c.meta.belt, kind: c.meta.kind, packNumber, updatedAt: sql`now()` },
      });
  }
  const kata = all.filter((c) => c.meta.kind === "kata").sort((a, b) => (a.meta.kataDay ?? 0) - (b.meta.kataDay ?? 0));
  await db.transaction(async (tx) => {
    await tx.delete(kataSchedule);
    if (kata.length > 0) {
      await tx.insert(kataSchedule).values(kata.map((c, i) => ({ day: i + 1, challengeId: c.meta.id })));
    }
  });
  await backfillPoints();
  return { challenges: all.length, kata: kata.length, packs: listPacks().length };
}

/**
 * Recomputes the points of every library best from its score and its challenge's belt.
 * Only pack challenges give points. Idempotent, so it also fixes rows after a belt or pack change.
 */
export async function backfillPoints(): Promise<void> {
  const cases = sql.join(
    Object.entries(MAX_POINTS).map(([belt, max]) => sql`when ${belt} then ${max}`),
    sql` `,
  );
  await db.execute(sql`
    update ${bestScores} b set points = case when c.pack_number is null or b.board <> 'library' then 0
      else round(((case c.belt::text ${cases} end)::float) * power(least(1, greatest(0, (b.score - ${POINTS_FLOOR}) / ${100 - POINTS_FLOOR}::float)), 2))::int end
    from ${challenges} c where c.id = b.challenge_id`);
}

if (import.meta.main) {
  const result = await seed();
  console.log(`seeded ${result.challenges} challenges, ${result.kata} kata days, ${result.packs} packs`);
  await sqlClient.end();
}
