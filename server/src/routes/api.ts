import { zValidator } from "@hono/zod-validator";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import {
  MAX_POINTS,
  OpenRequestSchema,
  SOLVED_AT,
  SubmitRequestSchema,
  kataDayFor,
  nextResetAt,
  utcDate,
  type ChallengeProgress,
  type ChallengeSummary,
  type GalleryItem,
  type KataToday,
  type ScoreResult,
  type SolutionsView,
  type SubmissionView,
  type SubmitRanking,
} from "@cssdojo/shared";
import { getChallenge, listChallenges, toPublic } from "../challenges";
import { db } from "../db/client";
import { answerLocks, bestScores, kataSchedule, submissions } from "../db/schema";
import { HOUR, LIMITS, MemoryRateLimiter } from "../lib/rate-limit";
import { clientIp, withPlayer, type PlayerVars } from "../lib/player";
import { isHidden, packOf } from "../packs";
import { recordKataDay, recordOpen } from "../progress";
import { challengeStandings, playerTags } from "../ranking/standings";
import { queue } from "../scoring/runtime";
import { scoreEvents } from "../scoring/events";

const limiter = new MemoryRateLimiter();
const WAIT_MS = 15_000;

export const api = new Hono<{ Variables: PlayerVars }>();
api.use("*", withPlayer);

/** A challenge players can see: it exists and is not in a pack that has not opened yet. */
function visibleChallenge(id: string): ReturnType<typeof getChallenge> {
  return isHidden(id) ? undefined : getChallenge(id);
}

function backgroundOf(colors: string[]): string {
  return colors[0] ?? "#F1F2F4";
}

/** Only today's kata board accepts scores; past kata boards are closed. */
function boardIsOpen(board: string): boolean {
  return board === "library" || board === `kata:${utcDate()}`;
}

/** Review page data: every challenge and kata with its golden set and inspiration. */
api.get("/gallery", (c) => {
  const out: GalleryItem[] = listChallenges().map((ch) => ({
    id: ch.meta.id,
    number: ch.meta.number,
    title: ch.meta.title,
    belt: ch.meta.belt,
    kind: ch.meta.kind,
    kataDay: ch.meta.kataDay ?? null,
    brief: ch.meta.brief,
    background: backgroundOf(ch.meta.colors),
    frames: [...ch.meta.frames],
    checks: [...ch.meta.checks],
    golden: ch.golden.map((g) => ({ name: g.name, min: g.min, max: g.max, reason: g.reason })),
    inspiration: ch.meta.inspiration.map((i) => ({ source: i.source, url: i.url, note: i.note })),
  }));
  return c.json(out);
});

api.get("/challenges", async (c) => {
  const playerId = c.get("playerId");
  const bests = new Map<string, number>();
  if (playerId) {
    const rows = await db
      .select({ challengeId: bestScores.challengeId, score: sql<number>`max(${bestScores.score})` })
      .from(bestScores)
      .where(eq(bestScores.playerId, playerId))
      .groupBy(bestScores.challengeId);
    for (const r of rows) bests.set(r.challengeId, r.score);
  }
  const out: ChallengeSummary[] = listChallenges()
    .filter((ch) => !isHidden(ch.meta.id))
    .map((ch) => ({
    id: ch.meta.id,
    number: ch.meta.number,
    title: ch.meta.title,
    belt: ch.meta.belt,
    kind: ch.meta.kind,
    background: backgroundOf(ch.meta.colors),
    best: bests.get(ch.meta.id) ?? null,
  }));
  return c.json(out);
});

api.get("/challenges/:id", (c) => {
  const ch = visibleChallenge(c.req.param("id"));
  if (!ch) return c.json({ error: "Challenge not found" }, 404);
  return c.json(toPublic(ch));
});

/** The player's standing on a challenge: best, attempts, points, and the note once unlocked. */
api.get("/challenges/:id/progress", async (c) => {
  const ch = visibleChallenge(c.req.param("id"));
  if (!ch) return c.json({ error: "Challenge not found" }, 404);
  const playerId = c.get("playerId");
  const maxPoints = packOf(ch.meta.id) ? MAX_POINTS[ch.meta.belt] : 0;
  if (!playerId) return c.json({ best: null, attempts: 0, note: null, solved: false, points: 0, maxPoints, locked: false } satisfies ChallengeProgress);
  const [attempts] = await db
    .select({ n: count() })
    .from(submissions)
    .where(and(eq(submissions.playerId, playerId), eq(submissions.challengeId, ch.meta.id), eq(submissions.status, "done"), sql`${submissions.score} is not null`));
  const [best] = await db
    .select({ score: sql<number | null>`max(${bestScores.score})` })
    .from(bestScores)
    .where(and(eq(bestScores.playerId, playerId), eq(bestScores.challengeId, ch.meta.id)));
  const [library] = await db
    .select({ points: bestScores.points })
    .from(bestScores)
    .where(and(eq(bestScores.playerId, playerId), eq(bestScores.challengeId, ch.meta.id), eq(bestScores.board, "library")));
  const n = attempts?.n ?? 0;
  const bestScore = best?.score ?? null;
  const progress: ChallengeProgress = {
    best: bestScore,
    attempts: n,
    note: n >= 3 && ch.note ? ch.note : null,
    solved: (bestScore ?? 0) >= SOLVED_AT,
    points: library?.points ?? 0,
    maxPoints,
    locked: await hasLock(playerId, ch.meta.id),
  };
  return c.json(progress);
});

async function hasLock(playerId: string, challengeId: string): Promise<boolean> {
  const [row] = await db.select({ at: answerLocks.lockedAt }).from(answerLocks).where(and(eq(answerLocks.playerId, playerId), eq(answerLocks.challengeId, challengeId)));
  return !!row;
}

/** Solutions for one challenge. The top five answers and our reference only show once you opened them. */
async function solutionsView(challengeId: string, reference: string, playerId: string | null): Promise<SolutionsView> {
  const locked = playerId ? await hasLock(playerId, challengeId) : false;
  if (!playerId || !locked) return { locked: false, frozen: null, reference: null, top: [] };
  const [mine] = await db
    .select({ score: bestScores.score, points: bestScores.points })
    .from(bestScores)
    .where(and(eq(bestScores.playerId, playerId), eq(bestScores.challengeId, challengeId), eq(bestScores.board, "library")));
  const top = (await challengeStandings(db, challengeId)).slice(0, 5);
  const ids = top.map((t) => t.playerId);
  const codes = ids.length
    ? await db
        .select({ playerId: bestScores.playerId, score: bestScores.score, code: submissions.code })
        .from(bestScores)
        .innerJoin(submissions, eq(submissions.id, bestScores.submissionId))
        .where(and(eq(bestScores.challengeId, challengeId), eq(bestScores.board, "library"), inArray(bestScores.playerId, ids)))
    : [];
  const byPlayer = new Map(codes.map((r) => [r.playerId, r]));
  const tags = await playerTags(db, ids);
  return {
    locked: true,
    frozen: mine ? { score: mine.score, points: mine.points } : null,
    reference,
    top: top.flatMap((t, i) => {
      const row = byPlayer.get(t.playerId);
      const player = tags.get(t.playerId);
      return row && player ? [{ rank: i + 1, player, score: row.score, chars: row.code.length, code: row.code }] : [];
    }),
  };
}

api.get("/challenges/:id/solutions", async (c) => {
  const ch = visibleChallenge(c.req.param("id"));
  if (!ch) return c.json({ error: "Challenge not found" }, 404);
  return c.json(await solutionsView(ch.meta.id, ch.reference, c.get("playerId")));
});

/** Opening solutions locks your points on this challenge at your best so far. */
api.post("/challenges/:id/solutions/open", async (c) => {
  const ch = visibleChallenge(c.req.param("id"));
  const playerId = c.get("playerId");
  if (!ch || !playerId) return c.json({ error: "Challenge not found" }, 404);
  await db.insert(answerLocks).values({ playerId, challengeId: ch.meta.id }).onConflictDoNothing();
  return c.json(await solutionsView(ch.meta.id, ch.reference, playerId));
});

api.post("/challenges/:id/open", zValidator("json", OpenRequestSchema), async (c) => {
  const ch = visibleChallenge(c.req.param("id"));
  const playerId = c.get("playerId");
  if (!ch || !playerId) return c.json({ error: "Challenge not found" }, 404);
  const { board } = c.req.valid("json");
  const openedAt = await recordOpen(db, playerId, ch.meta.id, board);
  return c.json({ openedAt: openedAt.toISOString() });
});

api.post("/submissions", zValidator("json", SubmitRequestSchema), async (c) => {
  const body = c.req.valid("json");
  const playerId = c.get("playerId");
  const user = c.get("user");
  const ch = visibleChallenge(body.challengeId);
  if (!ch || !playerId) return c.json({ error: "Challenge not found" }, 404);
  if (!boardIsOpen(body.board)) return c.json({ error: "That kata board closed at 00:00 UTC. Play it from the library." }, 409);
  const limit = user ? LIMITS.user : LIMITS.guest;
  if (!limiter.hit(`p:${playerId}`, limit, HOUR) || !limiter.hit(`ip:${clientIp(c)}`, LIMITS.ip, HOUR)) {
    return c.json({ error: user ? "That is a lot of Submits. Take a breath and try again in a few minutes." : "Guests get 30 Submits an hour. Sign in for more." }, 429);
  }
  await recordOpen(db, playerId, ch.meta.id, body.board);
  const [sub] = await db.insert(submissions).values({ playerId, challengeId: ch.meta.id, board: body.board, code: body.code }).returning({ id: submissions.id });
  if (!sub) return c.json({ error: "Could not save your Submit" }, 500);
  await recordKataDay(db, playerId, body.board, ch.starter, body.code);
  await queue.enqueue(sub.id);
  return c.json({ id: sub.id }, 202);
});

function view(s: typeof submissions.$inferSelect, extra: Partial<SubmissionView> = {}): SubmissionView {
  return {
    id: s.id,
    challengeId: s.challengeId,
    board: s.board,
    status: s.status,
    result: (s.result as ScoreResult | null) ?? null,
    error: s.error,
    createdAt: s.createdAt.toISOString(),
    ...(s.ranking ? { ranking: s.ranking as SubmitRanking } : {}),
    ...extra,
  };
}

/** `?wait=1` holds the request until the score is ready (or 15 s pass). */
api.get("/submissions/:id", async (c) => {
  const id = c.req.param("id");
  const playerId = c.get("playerId");
  if (!playerId || !/^[0-9a-f-]{36}$/i.test(id)) return c.json({ error: "Not found" }, 404);
  const load = async () => (await db.select().from(submissions).where(and(eq(submissions.id, id), eq(submissions.playerId, playerId))))[0];
  let s = await load();
  if (!s) return c.json({ error: "Not found" }, 404);
  if (c.req.query("wait") && (s.status === "queued" || s.status === "running")) {
    const extra = await new Promise<Partial<SubmissionView>>((resolve) => {
      const timer = setTimeout(() => {
        scoreEvents.off(id, onDone);
        resolve({});
      }, WAIT_MS);
      const onDone = (e: { newBest?: boolean; beltsEarned?: SubmissionView["beltsEarned"] }) => {
        clearTimeout(timer);
        resolve({ newBest: e.newBest ?? false, beltsEarned: e.beltsEarned ?? [] });
      };
      scoreEvents.once(id, onDone);
      // The score may have landed between the first read and subscribing.
      void load().then((again) => {
        if (again && again.status !== "queued" && again.status !== "running") onDone({});
      });
    });
    s = (await load()) ?? s;
    return c.json(view(s, extra));
  }
  return c.json(view(s));
});

/** The player's recent Submits on one challenge, newest first. */
api.get("/challenges/:id/attempts", async (c) => {
  const playerId = c.get("playerId");
  if (!playerId) return c.json([]);
  const rows = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.playerId, playerId), eq(submissions.challengeId, c.req.param("id")), inArray(submissions.status, ["done", "failed"])))
    .orderBy(desc(submissions.createdAt))
    .limit(30);
  return c.json(rows.map((r) => ({ ...view(r), code: r.code })));
});

api.get("/kata/today", async (c) => {
  const schedule = await db.select().from(kataSchedule).orderBy(kataSchedule.day);
  if (schedule.length === 0) return c.json({ error: "No kata yet" }, 404);
  const date = utcDate();
  const day = kataDayFor(date, schedule.length);
  const entry = schedule[day - 1];
  if (!entry) return c.json({ error: "No kata yet" }, 404);
  const out: KataToday = { date, day, cycleLength: schedule.length, challengeId: entry.challengeId, resetsAt: nextResetAt().toISOString() };
  return c.json(out);
});
