import { zValidator } from "@hono/zod-validator";
import { and, count, desc, eq, gte, ilike, inArray, isNotNull, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import {
  AdminHideSchema,
  AdminPlayerSearchSchema,
  AdminReasonOnlySchema,
  PackDatesSchema,
  SOLVED_AT,
  utcDate,
  type AdminActionRow,
  type AdminChallengeRow,
  type AdminMe,
  type AdminPackRow,
  type AdminPlayerDetail,
  type AdminPlayerRow,
  type AdminStats,
} from "@cssdojo/shared";
import { loadOverrides } from "../admin/overrides";
import { requireAdmin, type AdminVars } from "../admin/guard";
import { voidSubmission } from "../admin/void";
import { listChallenges } from "../challenges";
import { db } from "../db/client";
import { adminActions, bestScores, challenges, packs, playerBelts, playerSettings, players, scoreJobs, submissions, user } from "../db/schema";
import { getPack, listPacks, setPackDates, stateOf } from "../packs";
import { rankOf, standings } from "../ranking/standings";

// The admin panel API (docs/requirements/admin.md). Mounted at /api/admin, so the
// guard below only runs for these routes. Every write is logged with its reason.

export const adminRoutes = new Hono<{ Variables: AdminVars }>();
adminRoutes.use("*", requireAdmin);

async function logAction(adminId: string, action: string, target: string, before: unknown, after: unknown, reason: string): Promise<void> {
  await db.insert(adminActions).values({ adminId, action, target, before, after, reason });
}

adminRoutes.get("/me", (c) => c.json({ admin: true } satisfies AdminMe));

// ---------- Schedule ----------

adminRoutes.get("/packs", async (c) => {
  const counts = await db
    .select({ pack: challenges.packNumber, n: sql<number>`count(distinct ${bestScores.playerId})::int` })
    .from(bestScores)
    .innerJoin(challenges, eq(challenges.id, bestScores.challengeId))
    .where(and(eq(bestScores.board, "library"), isNotNull(challenges.packNumber)))
    .groupBy(challenges.packNumber);
  const byPack = new Map(counts.map((r) => [r.pack, r.n]));
  const out: AdminPackRow[] = listPacks().map((p) => ({
    number: p.number,
    title: p.title,
    belt: p.belt,
    state: stateOf(p),
    opensAt: p.opens.toISOString(),
    endsAt: p.ends.toISOString(),
    players: byPack.get(p.number) ?? 0,
  }));
  return c.json(out);
});

/**
 * Upcoming packs can move freely. A live pack can only run longer, so nobody loses
 * time they planned on. Finished packs have frozen standings and cannot change.
 */
adminRoutes.put("/packs/:number/dates", zValidator("json", PackDatesSchema), async (c) => {
  const pack = getPack(Number(c.req.param("number")));
  if (!pack) return c.json({ error: "No such Battle Pack" }, 404);
  const body = c.req.valid("json");
  const opens = new Date(body.opensAt);
  const ends = new Date(body.endsAt);
  const state = stateOf(pack);
  if (state === "finished") return c.json({ error: "A finished pack cannot change" }, 409);
  if (state === "live") {
    if (opens.getTime() !== pack.opens.getTime()) return c.json({ error: "A live pack keeps its open date" }, 409);
    if (ends < pack.ends) return c.json({ error: "A live pack can only be extended" }, 409);
  }
  const before = { opensAt: pack.opens.toISOString(), endsAt: pack.ends.toISOString() };
  await db.update(packs).set({ opensAt: opens, endsAt: ends }).where(eq(packs.number, pack.number));
  setPackDates(pack.number, opens, ends);
  await logAction(c.get("admin").id, "pack.dates", String(pack.number), before, { opensAt: body.opensAt, endsAt: body.endsAt }, body.reason);
  return c.json({ ok: true });
});

// ---------- Challenges ----------

adminRoutes.get("/challenges", async (c) => {
  const stats = await db
    .select({
      id: bestScores.challengeId,
      players: sql<number>`count(*)::int`,
      passed: sql<number>`(count(*) filter (where ${bestScores.score} >= ${SOLVED_AT}))::int`,
      avg: sql<number | null>`avg(${bestScores.score})::float`,
    })
    .from(bestScores)
    .where(eq(bestScores.board, "library"))
    .groupBy(bestScores.challengeId);
  const byId = new Map(stats.map((s) => [s.id, s]));
  const hidden = new Set((await db.select({ id: challenges.id }).from(challenges).where(isNotNull(challenges.hiddenAt))).map((r) => r.id));
  const out: AdminChallengeRow[] = listChallenges()
    .map((ch) => {
      const s = byId.get(ch.meta.id);
      return {
        id: ch.meta.id,
        number: ch.meta.number,
        title: ch.meta.title,
        belt: ch.meta.belt,
        kind: ch.meta.kind,
        packNumber: listPacks().find((p) => p.challenges.includes(ch.meta.id))?.number ?? null,
        hidden: hidden.has(ch.meta.id),
        goldenAnswers: ch.golden.length,
        players: s?.players ?? 0,
        passRate: s && s.players > 0 ? Math.round((s.passed / s.players) * 100) / 100 : 0,
        avgBest: s?.avg === null || s?.avg === undefined ? null : Math.round(s.avg * 10) / 10,
      };
    })
    .sort((a, b) => a.number - b.number);
  return c.json(out);
});

adminRoutes.post("/challenges/:id/hidden", zValidator("json", AdminHideSchema), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const [row] = await db.select({ hiddenAt: challenges.hiddenAt }).from(challenges).where(eq(challenges.id, id));
  if (!row) return c.json({ error: "No such challenge" }, 404);
  await db.update(challenges).set({ hiddenAt: body.hidden ? new Date() : null }).where(eq(challenges.id, id));
  await loadOverrides(db);
  await logAction(c.get("admin").id, body.hidden ? "challenge.hide" : "challenge.unhide", id, { hidden: !!row.hiddenAt }, { hidden: body.hidden }, body.reason);
  return c.json({ ok: true });
});

// ---------- Players ----------

/** Points and solves on the library board, per player. */
async function totals(playerIds: string[]): Promise<Map<string, { points: number; solved: number }>> {
  if (playerIds.length === 0) return new Map();
  const rows = await db
    .select({
      playerId: bestScores.playerId,
      points: sql<number>`coalesce(sum(${bestScores.points}), 0)::int`,
      solved: sql<number>`(count(*) filter (where ${bestScores.score} >= ${SOLVED_AT}))::int`,
    })
    .from(bestScores)
    .where(and(eq(bestScores.board, "library"), inArray(bestScores.playerId, playerIds)))
    .groupBy(bestScores.playerId);
  return new Map(rows.map((r) => [r.playerId, { points: r.points, solved: r.solved }]));
}

const playerColumns = {
  playerId: players.id,
  hiddenAt: players.hiddenAt,
  createdAt: players.createdAt,
  userId: players.userId,
  handle: user.handle,
  name: user.name,
  email: user.email,
};

type PlayerRecord = { playerId: string; userId: string | null; hiddenAt: Date | null; createdAt: Date; handle: string | null; name: string | null; email: string | null };

function playerRow(r: PlayerRecord, t: { points: number; solved: number } | undefined): AdminPlayerRow {
  return {
    playerId: r.playerId,
    handle: r.handle,
    name: r.name,
    email: r.email,
    points: t?.points ?? 0,
    solved: t?.solved ?? 0,
    hidden: !!r.hiddenAt,
    createdAt: r.createdAt.toISOString(),
  };
}

adminRoutes.get("/players", zValidator("query", AdminPlayerSearchSchema), async (c) => {
  const q = `%${c.req.valid("query").q.replace(/[%_\\]/g, "\\$&")}%`;
  const rows = await db
    .select(playerColumns)
    .from(players)
    .innerJoin(user, eq(user.id, players.userId))
    .where(or(ilike(user.handle, q), ilike(user.email, q), ilike(user.name, q)))
    .orderBy(user.handle)
    .limit(50);
  const t = await totals(rows.map((r) => r.playerId));
  return c.json(rows.map((r) => playerRow(r, t.get(r.playerId))));
});

async function findPlayer(id: string): Promise<PlayerRecord | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const [row] = await db.select(playerColumns).from(players).leftJoin(user, eq(user.id, players.userId)).where(eq(players.id, id));
  return row;
}

adminRoutes.get("/players/:id", async (c) => {
  const p = await findPlayer(c.req.param("id"));
  if (!p) return c.json({ error: "No such player" }, 404);
  const t = await totals([p.playerId]);
  const belts = (await db.select({ belt: playerBelts.belt }).from(playerBelts).where(eq(playerBelts.playerId, p.playerId))).map((r) => r.belt);
  const subs = await db.select().from(submissions).where(eq(submissions.playerId, p.playerId)).orderBy(desc(submissions.createdAt)).limit(50);
  const out: AdminPlayerDetail = {
    ...playerRow(p, t.get(p.playerId)),
    belts,
    // The rank this player would have, counting them even when hidden.
    wallRank: rankOf(await standings(db, undefined, p.playerId), p.playerId),
    submissions: subs.map((s) => ({
      id: s.id,
      challengeId: s.challengeId,
      board: s.board,
      score: s.score,
      status: s.status,
      voided: !!s.voidedAt,
      code: s.code,
      createdAt: s.createdAt.toISOString(),
    })),
  };
  return c.json(out);
});

adminRoutes.post("/players/:id/hidden", zValidator("json", AdminHideSchema), async (c) => {
  const p = await findPlayer(c.req.param("id"));
  if (!p) return c.json({ error: "No such player" }, 404);
  const body = c.req.valid("json");
  await db.update(players).set({ hiddenAt: body.hidden ? new Date() : null }).where(eq(players.id, p.playerId));
  await logAction(c.get("admin").id, body.hidden ? "player.hide" : "player.unhide", p.playerId, { hidden: !!p.hiddenAt, handle: p.handle }, { hidden: body.hidden }, body.reason);
  return c.json({ ok: true });
});

/** Swaps the handle for a neutral one and lets the player pick a new handle straight away. */
adminRoutes.post("/players/:id/reset-handle", zValidator("json", AdminReasonOnlySchema), async (c) => {
  const p = await findPlayer(c.req.param("id"));
  if (!p?.userId) return c.json({ error: "No such signed-in player" }, 404);
  const body = c.req.valid("json");
  let handle = "";
  for (let i = 0; i < 10 && !handle; i++) {
    const candidate = `player-${crypto.randomUUID().slice(0, 6)}`;
    const [taken] = await db.select({ id: user.id }).from(user).where(eq(user.handle, candidate));
    if (!taken) handle = candidate;
  }
  if (!handle) return c.json({ error: "Could not pick a new handle, try again" }, 500);
  await db.update(user).set({ handle, updatedAt: sql`now()` }).where(eq(user.id, p.userId));
  // Clear the 30-day wait so the player can choose their own handle again.
  await db.insert(playerSettings).values({ playerId: p.playerId, handleChangedAt: null }).onConflictDoUpdate({ target: playerSettings.playerId, set: { handleChangedAt: null } });
  await logAction(c.get("admin").id, "player.reset-handle", p.playerId, { handle: p.handle }, { handle }, body.reason);
  return c.json({ ok: true, handle });
});

adminRoutes.post("/submissions/:id/void", zValidator("json", AdminReasonOnlySchema), async (c) => {
  const id = c.req.param("id");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return c.json({ error: "No such submission" }, 404);
  const body = c.req.valid("json");
  const admin = c.get("admin");
  const result = await voidSubmission(db, id, admin.id);
  if (!result) return c.json({ error: "No such submission, or it is already voided" }, 404);
  await logAction(admin.id, "submission.void", id, result.before, result.after, body.reason);
  return c.json({ ok: true, ...result });
});

// ---------- Health and stats ----------

adminRoutes.get("/stats", async (c) => {
  const today = new Date(`${utcDate()}T00:00:00Z`);
  const dayAgo = new Date(Date.now() - 86_400_000);
  const [signups] = await db.select({ n: count() }).from(user).where(gte(user.createdAt, today));
  const [subs] = await db
    .select({
      submits: sql<number>`count(*)::int`,
      active: sql<number>`count(distinct ${submissions.playerId})::int`,
      solves: sql<number>`(count(*) filter (where ${submissions.score} >= ${SOLVED_AT}))::int`,
    })
    .from(submissions)
    .where(gte(submissions.createdAt, today));
  const days = await db.execute<{ date: string; signups: number; active: number; submits: number }>(sql`
    with d as (select generate_series(current_date - 29, current_date, interval '1 day')::date as date)
    select to_char(d.date, 'YYYY-MM-DD') as date,
      (select count(*)::int from "user" u where u.created_at::date = d.date) as signups,
      (select count(distinct s.player_id)::int from submissions s where s.created_at::date = d.date) as active,
      (select count(*)::int from submissions s where s.created_at::date = d.date) as submits
    from d order by d.date`);
  const [queue] = await db
    .select({ queued: sql<number>`count(*)::int`, oldest: sql<Date | null>`min(${scoreJobs.createdAt})` })
    .from(scoreJobs)
    .where(eq(scoreJobs.status, "queued"));
  const [failed] = await db.select({ n: count() }).from(scoreJobs).where(and(eq(scoreJobs.status, "failed"), gte(scoreJobs.createdAt, dayAgo)));
  const [speed] = await db
    .select({ avg: sql<number | null>`avg(extract(epoch from (${submissions.finishedAt} - ${submissions.createdAt})))::float` })
    .from(submissions)
    .where(and(eq(submissions.status, "done"), gte(submissions.createdAt, dayAgo)));
  const out: AdminStats = {
    today: { signups: signups?.n ?? 0, activePlayers: subs?.active ?? 0, submits: subs?.submits ?? 0, solves: subs?.solves ?? 0 },
    days: [...days].map((d) => ({ date: d.date, signups: d.signups, activePlayers: d.active, submits: d.submits })),
    scorer: {
      queued: queue?.queued ?? 0,
      oldestQueuedSec: queue?.oldest ? Math.round((Date.now() - new Date(queue.oldest).getTime()) / 1000) : null,
      failedLastDay: failed?.n ?? 0,
      avgScoreSec: speed?.avg === null || speed?.avg === undefined ? null : Math.round(speed.avg * 10) / 10,
    },
  };
  return c.json(out);
});

// ---------- Audit log ----------

adminRoutes.get("/actions", async (c) => {
  const rows = await db
    .select({ a: adminActions, handle: user.handle, name: user.name })
    .from(adminActions)
    .innerJoin(user, eq(user.id, adminActions.adminId))
    .orderBy(desc(adminActions.createdAt))
    .limit(100);
  const out: AdminActionRow[] = rows.map((r) => ({
    id: r.a.id,
    admin: r.handle ?? r.name,
    action: r.a.action,
    target: r.a.target,
    before: r.a.before,
    after: r.a.after,
    reason: r.a.reason,
    at: r.a.createdAt.toISOString(),
  }));
  return c.json(out);
});
