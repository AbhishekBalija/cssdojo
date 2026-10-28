import { zValidator } from "@hono/zod-validator";
import { and, count, desc, eq, getTableColumns, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import {
  ANNOUNCER_KINDS,
  BELTS,
  HANDLE_CHANGE_DAYS,
  KATA_EPOCH,
  PackNotifySchema,
  ReadNotificationsSchema,
  SOLVED_AT,
  SettingsPatchSchema,
  kataDayFor,
  longestRun,
  nextResetAt,
  streakFrom,
  utcDate,
  type Belt,
  type ChallengeBoardRow,
  type EventView,
  type KataMonth,
  type NotificationView,
  type NotificationsView,
  type PackBoardRow,
  type PackChallengeTile,
  type PackDetail,
  type PackSummary,
  type PlayerTag,
  type SettingsView,
  type StreakRow,
  type WallRow,
  type WallView,
} from "@cssdojo/shared";
import { getChallenge } from "../challenges";
import { db } from "../db/client";
import { account, answerLocks, bestScores, events, kataDays, kataSchedule, notifications, packFollows, playerSettings, players, submissions, user } from "../db/schema";
import { withPlayer, type PlayerVars } from "../lib/player";
import { getPack, isHidden, listPacks, stateOf, visibleChallenges, type Pack } from "../packs";
import { challengeStandings, movedLastDay, onBoards, playerTags, rankOf, standings, topBelts, type Standing } from "../ranking/standings";
import { frozenResults, tickPacks } from "../ranking/tick";

export const rankingRoutes = new Hono<{ Variables: PlayerVars }>();
rankingRoutes.use("*", withPlayer);

const PAGE = 50;
const NO_TAG: PlayerTag = { handle: "player", image: null, belt: null };

function background(id: string): string {
  return getChallenge(id)?.meta.colors[0] ?? "#F1F2F4";
}

// ---------- Battle Packs ----------

/**
 * Standings of a pack: frozen results once finished, live totals before that.
 * Players an admin hid are left out, except for the viewer themself.
 */
export async function packStandings(pack: Pack, viewer?: string | null): Promise<Standing[]> {
  const frozen = await frozenResults(db, pack.number);
  if (!frozen) return standings(db, pack.number, viewer);
  const hidden = new Set((await db.select({ id: players.id }).from(players).where(isNotNull(players.hiddenAt))).map((r) => r.id));
  return frozen
    .filter((r) => !hidden.has(r.playerId) || r.playerId === viewer)
    .map((r) => ({ playerId: r.playerId, points: r.points, solved: r.solved, reachedAt: new Date(0) }));
}

async function packSummary(pack: Pack, playerId: string | null, now: Date): Promise<PackSummary & { ranked: Standing[] }> {
  const state = stateOf(pack, now);
  const base = { number: pack.number, title: pack.title, description: pack.description, opensAt: pack.opens.toISOString(), endsAt: pack.ends.toISOString(), state };
  const notify = playerId ? (await db.select().from(packFollows).where(and(eq(packFollows.playerId, playerId), eq(packFollows.packNumber, pack.number)))).length > 0 : false;
  if (state === "upcoming") {
    return { ...base, belt: null, challenges: [], players: 0, me: playerId ? { solved: 0, tried: 0, points: 0, rank: null, notify } : null, ranked: [] };
  }
  const visible = visibleChallenges(pack);
  const rows = await db
    .select({ playerId: bestScores.playerId, challengeId: bestScores.challengeId, score: bestScores.score, points: bestScores.points, at: bestScores.updatedAt, handle: user.handle, name: user.name, hidden: players.hiddenAt })
    .from(bestScores)
    .innerJoin(players, eq(players.id, bestScores.playerId))
    .leftJoin(user, eq(user.id, players.userId))
    .where(and(eq(bestScores.board, "library"), inArray(bestScores.challengeId, visible)));
  const locks = playerId
    ? new Set((await db.select({ id: answerLocks.challengeId }).from(answerLocks).where(and(eq(answerLocks.playerId, playerId), inArray(answerLocks.challengeId, visible)))).map((r) => r.id))
    : new Set<string>();
  const tiles: PackChallengeTile[] = visible.map((id) => {
    const ch = getChallenge(id);
    const mine = rows.find((r) => r.playerId === playerId && r.challengeId === id);
    const top = rows
      .filter((r) => r.challengeId === id && r.name !== null && r.hidden === null)
      .sort((a, b) => b.score - a.score || a.at.getTime() - b.at.getTime())[0];
    return {
      id,
      number: ch?.meta.number ?? 0,
      title: ch?.meta.title ?? id,
      background: background(id),
      best: mine?.score ?? null,
      points: mine?.points ?? 0,
      locked: locks.has(id),
      top: top ? { handle: top.handle ?? top.name ?? "player", score: top.score } : null,
    };
  });
  const ranked = await packStandings(pack, playerId);
  const mine = rows.filter((r) => r.playerId === playerId);
  return {
    ...base,
    belt: pack.belt,
    challenges: tiles,
    players: new Set(rows.map((r) => r.playerId)).size,
    me: playerId
      ? {
          solved: mine.filter((r) => r.score >= SOLVED_AT).length,
          tried: mine.length,
          points: mine.reduce((n, r) => n + r.points, 0),
          rank: rankOf(ranked, playerId),
          notify,
        }
      : null,
    ranked,
  };
}

async function packBoard(pack: Pack, ranked: Standing[], playerId: string | null): Promise<PackBoardRow[]> {
  const page = ranked.slice(0, PAGE);
  const mine = playerId ? ranked.find((s) => s.playerId === playerId && !page.includes(s)) : undefined;
  const shown = mine ? [...page, mine] : page;
  const tags = await playerTags(db, shown.map((s) => s.playerId));
  const moved = await movedLastDay(db, `pack:${pack.number}`);
  return shown.map((s) => ({
    rank: ranked.indexOf(s) + 1,
    player: tags.get(s.playerId) ?? NO_TAG,
    solved: s.solved,
    points: s.points,
    moved: moved.get(s.playerId) ?? 0,
    me: s.playerId === playerId,
  }));
}

rankingRoutes.get("/packs", async (c) => {
  await tickPacks(db);
  const now = new Date();
  const out: PackSummary[] = [];
  for (const p of [...listPacks()].reverse()) {
    const summary: PackSummary & { ranked?: Standing[] } = await packSummary(p, c.get("playerId"), now);
    delete summary.ranked;
    out.push(summary);
  }
  return c.json(out);
});

function packFrom(param: string): Pack | undefined {
  const n = Number(param);
  return Number.isInteger(n) ? getPack(n) : undefined;
}

rankingRoutes.get("/packs/:number", async (c) => {
  const pack = packFrom(c.req.param("number"));
  if (!pack) return c.json({ error: "No such Battle Pack" }, 404);
  await tickPacks(db);
  const playerId = c.get("playerId");
  const { ranked, ...summary } = await packSummary(pack, playerId, new Date());
  const out: PackDetail = { ...summary, board: await packBoard(pack, ranked, playerId), moves: await eventViews(`pack:${pack.number}`) };
  return c.json(out);
});

rankingRoutes.post("/packs/:number/notify", zValidator("json", PackNotifySchema), async (c) => {
  const pack = packFrom(c.req.param("number"));
  const playerId = c.get("playerId");
  if (!pack || !playerId) return c.json({ error: "No such Battle Pack" }, 404);
  const { on } = c.req.valid("json");
  if (on) await db.insert(packFollows).values({ playerId, packNumber: pack.number }).onConflictDoNothing();
  else await db.delete(packFollows).where(and(eq(packFollows.playerId, playerId), eq(packFollows.packNumber, pack.number)));
  return c.json({ notify: on });
});

// ---------- Boards ----------

rankingRoutes.get("/boards/wall", async (c) => {
  const playerId = c.get("playerId");
  const page = Math.max(1, Math.min(1000, Number(c.req.query("page") ?? 1) || 1));
  const ranked = await standings(db, undefined, playerId);
  const slice = ranked.slice((page - 1) * PAGE, page * PAGE);
  const myIndex = playerId ? ranked.findIndex((s) => s.playerId === playerId) : -1;
  const extra = [myIndex, myIndex - 1].filter((i) => i >= 0).map((i) => ranked[i] as Standing);
  const tags = await playerTags(db, [...slice, ...extra].map((s) => s.playerId));
  const moved = await movedLastDay(db, "wall");
  const row = (s: Standing): WallRow => ({
    rank: ranked.indexOf(s) + 1,
    player: tags.get(s.playerId) ?? NO_TAG,
    points: s.points,
    solved: s.solved,
    moved: moved.get(s.playerId) ?? 0,
    me: s.playerId === playerId,
  });
  const me = myIndex >= 0 ? row(ranked[myIndex] as Standing) : null;
  const above = myIndex > 0 ? (ranked[myIndex - 1] as Standing) : null;
  const belts = Object.fromEntries(BELTS.map((b) => [b, 0])) as Record<Belt, number>;
  for (const b of (await topBelts(db, ranked.map((s) => s.playerId))).values()) belts[b]++;
  const out: WallView = {
    players: ranked.length,
    rows: slice.map(row),
    me,
    next: me && above ? { row: row(above), gap: above.points - me.points + 1 } : null,
    belts,
    moves: await eventViews("wall"),
  };
  return c.json(out);
});

rankingRoutes.get("/boards/pack/:number", async (c) => {
  const pack = packFrom(c.req.param("number"));
  if (!pack || stateOf(pack) === "upcoming") return c.json({ error: "No such Battle Pack" }, 404);
  return c.json(await packBoard(pack, await packStandings(pack, c.get("playerId")), c.get("playerId")));
});

rankingRoutes.get("/boards/challenge/:id", async (c) => {
  const id = c.req.param("id");
  if (!getChallenge(id) || isHidden(id)) return c.json({ error: "Challenge not found" }, 404);
  const playerId = c.get("playerId");
  const ranked = await challengeStandings(db, id, playerId);
  const page = ranked.slice(0, PAGE);
  const mine = playerId ? ranked.find((s) => s.playerId === playerId && !page.includes(s)) : undefined;
  const shown = mine ? [...page, mine] : page;
  const ids = shown.map((s) => s.playerId);
  const best = ids.length
    ? await db
        .select({ playerId: bestScores.playerId, score: bestScores.score, chars: sql<number>`length(${submissions.code})::int` })
        .from(bestScores)
        .innerJoin(submissions, eq(submissions.id, bestScores.submissionId))
        .where(and(eq(bestScores.challengeId, id), eq(bestScores.board, "library"), inArray(bestScores.playerId, ids)))
    : [];
  const byPlayer = new Map(best.map((b) => [b.playerId, b]));
  const tags = await playerTags(db, ids);
  const moved = await movedLastDay(db, `challenge:${id}`);
  const out: ChallengeBoardRow[] = shown.map((s) => ({
    rank: ranked.indexOf(s) + 1,
    player: tags.get(s.playerId) ?? NO_TAG,
    score: byPlayer.get(s.playerId)?.score ?? 0,
    points: s.points,
    chars: byPlayer.get(s.playerId)?.chars ?? 0,
    moved: moved.get(s.playerId) ?? 0,
    me: s.playerId === playerId,
  }));
  return c.json(out);
});

/** Current streak first, then longest, then whoever started their current run first. */
rankingRoutes.get("/boards/streaks", async (c) => {
  const playerId = c.get("playerId");
  const rows = await db
    .select({ playerId: kataDays.playerId, date: kataDays.date })
    .from(kataDays)
    .innerJoin(players, eq(players.id, kataDays.playerId))
    .where(onBoards(playerId));
  const byPlayer = new Map<string, string[]>();
  for (const r of rows) byPlayer.set(r.playerId, [...(byPlayer.get(r.playerId) ?? []), r.date]);
  const today = utcDate();
  const all = [...byPlayer].map(([id, dates]) => {
    const current = streakFrom(dates, today);
    return { id, current, longest: longestRun(dates), since: current > 0 ? currentStart(dates, today, current) : "9999-12-31" };
  });
  all.sort((a, b) => b.current - a.current || b.longest - a.longest || a.since.localeCompare(b.since));
  const page = all.slice(0, PAGE);
  const mine = playerId ? all.find((s) => s.id === playerId && !page.includes(s)) : undefined;
  const shown = mine ? [...page, mine] : page;
  const tags = await playerTags(db, shown.map((s) => s.id));
  const out: StreakRow[] = shown.map((s) => ({ rank: all.indexOf(s) + 1, player: tags.get(s.id) ?? NO_TAG, current: s.current, longest: s.longest, me: s.id === playerId }));
  return c.json(out);
});

/** First day of the current run: today or yesterday, minus the run length. */
function currentStart(dates: string[], today: string, current: number): string {
  const end = dates.includes(today) ? today : utcDate(new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000));
  return utcDate(new Date(Date.parse(`${end}T00:00:00Z`) - (current - 1) * 86_400_000));
}

// ---------- Live moves ----------

async function eventViews(board: string | null, limit = 20): Promise<EventView[]> {
  const rows = await db
    .select(getTableColumns(events))
    .from(events)
    // Moves by a player an admin hid are not shown to anyone.
    .leftJoin(players, eq(players.id, events.playerId))
    .where(and(board ? eq(events.board, board) : inArray(events.kind, [...ANNOUNCER_KINDS]), or(isNull(events.playerId), isNull(players.hiddenAt))))
    .orderBy(desc(events.createdAt))
    .limit(limit);
  const tags = await playerTags(db, rows.map((r) => r.playerId).filter((id): id is string => !!id));
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    player: r.playerId ? (tags.get(r.playerId) ?? null) : null,
    text: r.text,
    delta: r.delta,
    rank: r.rank,
    href: r.href,
    at: r.createdAt.toISOString(),
  }));
}

rankingRoutes.get("/events", async (c) => {
  await tickPacks(db);
  const board = c.req.query("board");
  if (board !== undefined && !/^(wall|pack:\d{1,4}|challenge:[a-z0-9-]{1,80})$/.test(board)) return c.json({ error: "Bad board" }, 400);
  return c.json(await eventViews(board ?? null));
});

// ---------- Bell ----------

export async function unreadCount(playerId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(notifications).where(and(eq(notifications.playerId, playerId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

rankingRoutes.get("/notifications", async (c) => {
  const playerId = c.get("playerId");
  if (!playerId) return c.json({ unread: 0, items: [] } satisfies NotificationsView);
  const rows = await db.select().from(notifications).where(eq(notifications.playerId, playerId)).orderBy(desc(notifications.createdAt)).limit(30);
  const items: NotificationView[] = rows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, href: r.href, createdAt: r.createdAt.toISOString(), read: !!r.readAt }));
  return c.json({ unread: await unreadCount(playerId), items } satisfies NotificationsView);
});

rankingRoutes.post("/notifications/read", zValidator("json", ReadNotificationsSchema), async (c) => {
  const playerId = c.get("playerId");
  if (!playerId) return c.json({ unread: 0 });
  const { ids } = c.req.valid("json");
  const mine = and(eq(notifications.playerId, playerId), isNull(notifications.readAt));
  if (!ids) await db.update(notifications).set({ readAt: sql`now()` }).where(mine);
  else if (ids.length) await db.update(notifications).set({ readAt: sql`now()` }).where(and(mine, inArray(notifications.id, ids)));
  return c.json({ unread: await unreadCount(playerId) });
});

// ---------- Kata calendar ----------

rankingRoutes.get("/kata/days", async (c) => {
  const month = c.req.query("month") ?? utcDate().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return c.json({ error: "Use month=YYYY-MM" }, 400);
  const schedule = await db.select().from(kataSchedule).orderBy(kataSchedule.day);
  const today = utcDate();
  const [y, m] = month.split("-").map(Number) as [number, number];
  const dates: string[] = [];
  for (let d = 1; d <= 31; d++) {
    const date = utcDate(new Date(Date.UTC(y, m - 1, d)));
    if (!date.startsWith(month) || date > today || date < KATA_EPOCH) continue;
    dates.push(date);
  }
  const playerId = c.get("playerId");
  const boards = dates.map((d) => `kata:${d}`);
  const mine =
    playerId && boards.length
      ? await db
          .select({ board: submissions.board, best: sql<number | null>`max(${submissions.score})` })
          .from(submissions)
          .where(and(eq(submissions.playerId, playerId), inArray(submissions.board, boards)))
          .groupBy(submissions.board)
      : [];
  const byBoard = new Map(mine.map((r) => [r.board, r.best]));
  const out: KataMonth = {
    month,
    days: dates.flatMap((date) => {
      const entry = schedule[kataDayFor(date, schedule.length) - 1];
      const ch = entry ? getChallenge(entry.challengeId) : undefined;
      if (!entry || !ch) return [];
      const board = `kata:${date}`;
      return [{ date, challengeId: entry.challengeId, number: ch.meta.number, title: ch.meta.title, myScore: byBoard.get(board) ?? null, attempted: byBoard.has(board) }];
    }),
    yesterdayClosedAt: `${today}T00:00:00.000Z`,
    tomorrowOpensAt: nextResetAt().toISOString(),
  };
  return c.json(out);
});

// ---------- Settings ----------

async function settingsView(playerId: string, u: { id: string; email: string; handle: string | null }): Promise<SettingsView> {
  const [s] = await db.select().from(playerSettings).where(eq(playerSettings.playerId, playerId));
  const accounts = await db.select({ provider: account.providerId }).from(account).where(eq(account.userId, u.id));
  const provider = accounts.map((a) => a.provider).find((p): p is "github" | "google" => p === "github" || p === "google") ?? null;
  const changeable = s?.handleChangedAt ? new Date(s.handleChangedAt.getTime() + HANDLE_CHANGE_DAYS * 86_400_000) : null;
  return {
    provider,
    providerAccount: provider ? u.email : null,
    handle: u.handle,
    handleChangeableAt: changeable && changeable > new Date() ? changeable.toISOString() : null,
    notify: { passed: s?.notifyPassed ?? true, packOpen: s?.notifyPackOpen ?? true, badge: s?.notifyBadge ?? true, live: s?.showLive ?? true },
  };
}

rankingRoutes.get("/settings", async (c) => {
  const u = c.get("user");
  const playerId = c.get("playerId");
  if (!u || !playerId) return c.json({ error: "Sign in to change settings" }, 401);
  return c.json(await settingsView(playerId, u));
});

rankingRoutes.patch("/settings", zValidator("json", SettingsPatchSchema), async (c) => {
  const u = c.get("user");
  const playerId = c.get("playerId");
  if (!u || !playerId) return c.json({ error: "Sign in to change settings" }, 401);
  const body = c.req.valid("json");
  const current = await settingsView(playerId, u);
  let handle = u.handle;
  let handleChangedAt: Date | undefined;
  if (body.handle && body.handle !== u.handle) {
    if (current.handleChangeableAt) return c.json({ error: `You can change your handle again on ${current.handleChangeableAt.slice(0, 10)}` }, 409);
    const [taken] = await db.select({ id: user.id }).from(user).where(eq(user.handle, body.handle));
    if (taken) return c.json({ error: "That handle is taken" }, 409);
    try {
      await db.update(user).set({ handle: body.handle, updatedAt: sql`now()` }).where(eq(user.id, u.id));
    } catch {
      return c.json({ error: "That handle is taken" }, 409);
    }
    handle = body.handle;
    handleChangedAt = new Date();
  }
  const n = body.notify ?? {};
  const set = {
    notifyPassed: n.passed ?? current.notify.passed,
    notifyPackOpen: n.packOpen ?? current.notify.packOpen,
    notifyBadge: n.badge ?? current.notify.badge,
    showLive: n.live ?? current.notify.live,
    ...(handleChangedAt ? { handleChangedAt } : {}),
  };
  await db.insert(playerSettings).values({ playerId, ...set }).onConflictDoUpdate({ target: playerSettings.playerId, set });
  return c.json(await settingsView(playerId, { ...u, handle }));
});
