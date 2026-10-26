import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { pointsFor, SOLVED_AT } from "@cssdojo/shared";
import type { Db } from "../db/client";
import { packFollows, packResults, packs } from "../db/schema";
import { getPack, packLabel, type Pack } from "../packs";
import { byPointsThenTime, type Standing } from "./standings";
import { addEvent, notify } from "./notify";

// Pack countdown jobs run lazily from busy routes, at most once a minute, so there
// is no cron to deploy. Each job sets a flag on the packs row, so it runs once.

const SOON_MS = 48 * 3_600_000;
const EVERY_MS = 60_000;
let lastRun = 0;
let running: Promise<void> | null = null;

/** Runs the pack jobs if a minute has passed since the last run. Never throws. */
export function tickPacks(db: Db, now: Date = new Date()): Promise<void> {
  if (running || now.getTime() - lastRun < EVERY_MS) return running ?? Promise.resolve();
  lastRun = now.getTime();
  running = runPackJobs(db, now)
    .catch((err: unknown) => console.error("pack jobs failed", err))
    .finally(() => {
      running = null;
    });
  return running;
}

async function followers(db: Db, packNumber: number): Promise<string[]> {
  return (await db.select({ id: packFollows.playerId }).from(packFollows).where(eq(packFollows.packNumber, packNumber))).map((r) => r.id);
}

export async function runPackJobs(db: Db, now: Date = new Date()): Promise<void> {
  const rows = await db.select().from(packs);
  for (const row of rows) {
    const pack = getPack(row.number);
    if (!pack) continue;
    const label = packLabel(pack.number);
    const href = `/packs/${pack.number}`;
    const opens = pack.opens.getTime();

    if (!row.soonSentAt && now.getTime() >= opens - SOON_MS && now.getTime() < opens) {
      const claimed = await db.update(packs).set({ soonSentAt: now }).where(and(eq(packs.number, pack.number), isNull(packs.soonSentAt))).returning({ n: packs.number });
      if (claimed.length) {
        for (const id of await followers(db, pack.number)) {
          await notify(db, { playerId: id, kind: "pack-soon", title: `${label} opens soon`, body: `${pack.title} opens within 2 days.`, href });
        }
      }
    }

    if (!row.openedSentAt && now.getTime() >= opens) {
      const claimed = await db.update(packs).set({ openedSentAt: now }).where(and(eq(packs.number, pack.number), isNull(packs.openedSentAt))).returning({ n: packs.number });
      if (claimed.length) {
        await addEvent(db, { kind: "pack-open", playerId: null, board: `pack:${pack.number}`, text: `${label}: ${pack.title} is open`, href });
        for (const id of await followers(db, pack.number)) {
          await notify(db, { playerId: id, kind: "pack-open", title: `${label} is open`, body: `${pack.title}: 6 new challenges.`, href });
        }
      }
    }

    if (!row.finalizedAt && now.getTime() >= pack.ends.getTime()) {
      await finalizePack(db, pack, now);
    }
  }
}

/**
 * Freezes a finished pack's standings into pack_results. Only Submits made before
 * the pack ended count, and Submits after opening solutions on a challenge are left
 * out, matching how the live board froze them.
 */
export async function finalizePack(db: Db, pack: Pack, now: Date = new Date()): Promise<void> {
  const best = await db.execute<{ player_id: string; challenge_id: string; score: number; at: Date }>(sql`
    select distinct on (s.player_id, s.challenge_id) s.player_id, s.challenge_id, s.score, s.created_at as at
    from submissions s
    join players p on p.id = s.player_id and p.user_id is not null
    left join answer_locks l on l.player_id = s.player_id and l.challenge_id = s.challenge_id
    where s.board = 'library' and s.score is not null
      and s.challenge_id in ${pack.challenges}
      and s.created_at < (${pack.ends.toISOString()}::timestamptz at time zone 'UTC')
      and (l.locked_at is null or s.created_at < l.locked_at)
    order by s.player_id, s.challenge_id, s.score desc, s.created_at asc`);
  const totals = new Map<string, Standing>();
  for (const r of best) {
    const t = totals.get(r.player_id) ?? { playerId: r.player_id, points: 0, solved: 0, reachedAt: new Date(0) };
    t.points += pointsFor(r.score, pack.belt);
    if (r.score >= SOLVED_AT) t.solved++;
    const at = new Date(r.at);
    if (at > t.reachedAt) t.reachedAt = at;
    totals.set(r.player_id, t);
  }
  const ranked = [...totals.values()].sort(byPointsThenTime);
  await db.transaction(async (tx) => {
    const claimed = await tx.update(packs).set({ finalizedAt: now }).where(and(eq(packs.number, pack.number), isNull(packs.finalizedAt))).returning({ n: packs.number });
    if (!claimed.length) return;
    if (ranked.length) {
      await tx
        .insert(packResults)
        .values(ranked.map((s, i) => ({ packNumber: pack.number, playerId: s.playerId, rank: i + 1, points: s.points, solved: s.solved })))
        .onConflictDoNothing();
    }
  });
}

/** Final standings of a finished pack, or null while it is still being played. */
export async function frozenResults(db: Db, packNumber: number): Promise<(typeof packResults.$inferSelect)[] | null> {
  const [row] = await db.select({ at: packs.finalizedAt }).from(packs).where(and(eq(packs.number, packNumber), isNotNull(packs.finalizedAt)));
  if (!row) return null;
  return db.select().from(packResults).where(eq(packResults.packNumber, packNumber)).orderBy(packResults.rank);
}
