import { and, eq, gte, sql } from "drizzle-orm";
import { BADGES, SOLVED_AT, badgeById, longestRun, type BadgeView, type Belt } from "@cssdojo/shared";
import type { Db } from "../db/client";
import { answerLocks, bestScores, playerBadges, playerBelts, players } from "../db/schema";
import { listPacks } from "../packs";
import { addEvent, notify } from "./notify";
import { kataDates } from "./standings";

// Badges are worked out from what is already stored (solves, belts, streak days),
// so running the check twice never awards twice. Two badges depend on the moment
// they happen (Sharp eye, Live finisher); callers pass those in as `extra`.

interface Facts {
  solvedIds: Set<string>;
  perfect: boolean;
  belts: Belt[];
  lockedIds: Set<string>;
  longestStreak: number;
  signedIn: boolean;
}

async function facts(db: Db, playerId: string): Promise<Facts> {
  const solved = await db
    .selectDistinct({ id: bestScores.challengeId })
    .from(bestScores)
    .where(and(eq(bestScores.playerId, playerId), gte(bestScores.score, SOLVED_AT)));
  const [perfect] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(bestScores)
    .where(and(eq(bestScores.playerId, playerId), gte(bestScores.score, 100)));
  const belts = await db.select({ belt: playerBelts.belt }).from(playerBelts).where(eq(playerBelts.playerId, playerId));
  const locks = await db.select({ id: answerLocks.challengeId }).from(answerLocks).where(eq(answerLocks.playerId, playerId));
  const [p] = await db.select({ userId: players.userId }).from(players).where(eq(players.id, playerId));
  return {
    solvedIds: new Set(solved.map((r) => r.id)),
    perfect: (perfect?.n ?? 0) > 0,
    belts: belts.map((b) => b.belt),
    lockedIds: new Set(locks.map((l) => l.id)),
    longestStreak: longestRun(await kataDates(db, playerId)),
    signedIn: !!p?.userId,
  };
}

function clearedPacks(f: Facts): number[] {
  return listPacks()
    .filter((p) => p.challenges.every((id) => f.solvedIds.has(id)))
    .map((p) => p.number);
}

/** Progress toward each badge (count so far), from stored facts. */
function progressOf(f: Facts): Record<string, number> {
  const unaided = [...f.solvedIds].filter((id) => !f.lockedIds.has(id)).length;
  const cleared = clearedPacks(f).length;
  const bestPackSolves = Math.max(0, ...listPacks().map((p) => p.challenges.filter((id) => f.solvedIds.has(id)).length));
  return {
    "pack-cleared": bestPackSolves,
    "two-packs": cleared,
    "ten-solves": f.solvedIds.size,
    "thirty-solves": f.solvedIds.size,
    "streak-3": f.longestStreak,
    "streak-7": f.longestStreak,
    "streak-30": f.longestStreak,
    "no-peeking": unaided,
  };
}

function qualifies(f: Facts): Set<string> {
  const out = new Set<string>();
  for (const b of f.belts) out.add(`belt-${b}`);
  const progress = progressOf(f);
  for (const def of BADGES) {
    if (def.goal !== undefined && def.group !== "belts" && (progress[def.id] ?? 0) >= def.goal) out.add(def.id);
  }
  if (f.perfect) out.add("perfect-100");
  if (f.signedIn) out.add("on-the-mat");
  return out;
}

/**
 * Awards every badge the player now qualifies for, plus any `extra` ones the caller
 * saw happen. Sends a bell notification per new badge and a public event for belts.
 * Returns the ids earned now.
 */
export async function syncBadges(db: Db, playerId: string, extra: string[] = []): Promise<string[]> {
  const f = await facts(db, playerId);
  const want = qualifies(f);
  for (const id of extra) if (badgeById(id)?.enabled) want.add(id);
  const have = new Set((await db.select({ id: playerBadges.badgeId }).from(playerBadges).where(eq(playerBadges.playerId, playerId))).map((r) => r.id));
  const earned: string[] = [];
  for (const id of want) {
    if (have.has(id)) continue;
    const inserted = await db.insert(playerBadges).values({ playerId, badgeId: id }).onConflictDoNothing().returning({ id: playerBadges.badgeId });
    if (inserted.length === 0) continue;
    earned.push(id);
    const def = badgeById(id);
    if (!def) continue;
    if (def.group === "belts") {
      const belt = id.slice("belt-".length);
      await notify(db, { playerId, kind: "belt", title: `${def.name} earned`, body: "5 solves of that belt. Keep going.", href: "/me" });
      if (f.signedIn) await addEvent(db, { kind: "belt", playerId, board: "wall", text: `earned ${belt} belt`, href: "/leaderboard" });
    } else {
      await notify(db, { playerId, kind: "badge", title: `Badge earned: ${def.name}`, body: def.description, href: "/me" });
    }
  }
  return earned;
}

/** Every badge with when you earned it and your progress toward counted ones. */
export async function badgeViews(db: Db, playerId: string | null): Promise<BadgeView[]> {
  if (!playerId) return BADGES.map((b) => ({ id: b.id, earnedAt: null, progress: b.goal !== undefined ? 0 : null }));
  const f = await facts(db, playerId);
  const progress = progressOf(f);
  const solvedPerBelt = new Map<string, number>();
  const rows = await db.select().from(playerBadges).where(eq(playerBadges.playerId, playerId));
  const earned = new Map(rows.map((r) => [r.badgeId, r.earnedAt]));
  const beltSolves = await db.execute<{ belt: Belt; n: number }>(sql`
    select c.belt, count(distinct b.challenge_id)::int as n from best_scores b join challenges c on c.id = b.challenge_id
    where b.player_id = ${playerId} and b.score >= ${SOLVED_AT} group by c.belt`);
  for (const r of beltSolves) solvedPerBelt.set(`belt-${r.belt}`, r.n);
  return BADGES.map((b) => {
    const at = earned.get(b.id);
    const p = b.group === "belts" ? (solvedPerBelt.get(b.id) ?? 0) : (progress[b.id] ?? null);
    return { id: b.id, earnedAt: at ? at.toISOString() : null, progress: b.goal !== undefined ? Math.min(p ?? 0, b.goal) : null };
  });
}
