import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";

// Runs against a real Postgres, so it only runs when TEST_DATABASE_URL points at a
// throwaway database (its name must contain "test"); it empties the player tables.
// Set it up with: DATABASE_URL=<that url> bun run db:migrate && bun run db:seed
const url = process.env.TEST_DATABASE_URL;
const enabled = !!url && /test/.test(new URL(url).pathname);
if (enabled && url) process.env.DATABASE_URL = url;

const mod = enabled
  ? {
      client: await import("../db/client"),
      schema: await import("../db/schema"),
      progress: await import("../progress"),
      tick: await import("./tick"),
      packs: await import("../packs"),
      merge: await import("../merge"),
    }
  : null;

const [W1, W2, W3, W4, W5, W6] = ["w-001-primary-button", "w-002-outline-button", "w-003-status-pill", "w-004-text-link", "w-005-avatar-initials", "w-006-key-cap"];

describe.skipIf(!enabled)("ranking against Postgres", () => {
  if (!mod) return;
  const m = mod;
  const { db, sqlClient } = m.client;
  const s = m.schema;
  const ids: Record<string, string> = {};

  async function player(name: string): Promise<string> {
    await db.insert(s.user).values({ id: `u-${name}`, name, email: `${name}@example.test`, handle: name });
    const [p] = await db.insert(s.players).values({ userId: `u-${name}` }).returning({ id: s.players.id });
    if (!p) throw new Error("no player");
    ids[name] = p.id;
    return p.id;
  }

  async function submit(name: string, challengeId: string, score: number, board = "library", createdAt?: Date) {
    const playerId = ids[name] ?? name;
    const [sub] = await db
      .insert(s.submissions)
      .values({ playerId, challengeId, board, code: `/* ${score} */ .a { color: red }`, status: "done", score, ...(createdAt ? { createdAt } : {}) })
      .returning({ id: s.submissions.id });
    if (!sub) throw new Error("no submission");
    return m.progress.recordScore(db, sub.id);
  }

  async function bell(name: string) {
    return db.select().from(s.notifications).where(eq(s.notifications.playerId, ids[name] as string));
  }

  beforeAll(async () => {
    await db.execute(sql`truncate players, "user", notifications, events, pack_results, pack_follows, kata_days cascade`);
    await db.execute(sql`update packs set soon_sent_at = null, opened_sent_at = null, finalized_at = null`);
    await player("ana");
    await player("ben");
  });

  afterAll(async () => {
    await sqlClient.end();
  });

  it("gives belt points on a pack challenge and puts you on the Wall", async () => {
    const out = await submit("ana", W1, 90);
    expect(out.newBest).toBe(true);
    expect(out.ranking).toMatchObject({ points: 128, maxPoints: 200, gained: 128, locked: false, pack: { number: 1, solved: 1 } });
    expect(out.ranking?.wall).toMatchObject({ before: 0, after: 128, rankBefore: null, rankAfter: 1 });
    expect(out.ranking?.badgesEarned).toContain("sharp-eye");
  });

  it("tells the player you passed, once per board", async () => {
    const out = await submit("ben", W1, 95);
    expect(out.ranking?.wall).toMatchObject({ rankBefore: null, rankAfter: 1, passed: ["ana"] });
    const passed = (await bell("ana")).filter((n) => n.kind === "passed");
    expect(passed.map((n) => n.board).sort()).toEqual([`challenge:${W1}`, "pack:1", "wall"]);
    const big = await db.select().from(s.events).where(and(eq(s.events.playerId, ids.ben as string), sql`${s.events.kind} <> 'moved'`));
    expect(big.map((e) => `${e.kind} ${e.board}`).sort()).toEqual([`number-one challenge:${W1}`, "pack-top3 pack:1"]);
  });

  it("throttles 'passed you' to one per board per hour", async () => {
    await submit("ana", W2, 100);
    await submit("ben", W2, 100);
    await submit("ben", W3, 80);
    const wall = (await bell("ana")).filter((n) => n.kind === "passed" && n.board === "wall");
    expect(wall).toHaveLength(1);
  });

  it("freezes points once solutions are opened", async () => {
    await db.insert(s.answerLocks).values({ playerId: ids.ana as string, challengeId: W1 });
    const out = await submit("ana", W1, 100);
    expect(out.newBest).toBe(false);
    expect(out.ranking).toMatchObject({ points: 128, gained: 0, locked: true });
  });

  it("gives no points on kata boards and counts the streak only when the starter changed", async () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(await m.progress.recordKataDay(db, ids.ana as string, `kata:${today}`, ".a {}\n", ".a {}")).toBe(false);
    expect(await m.progress.recordKataDay(db, ids.ana as string, `kata:${today}`, ".a {}", ".a { color: red }")).toBe(true);
    expect(await m.progress.recordKataDay(db, ids.ana as string, "kata:2020-01-01", ".a {}", ".a { color: red }")).toBe(false);
    const out = await submit("ana", W4, 70, `kata:${today}`);
    expect(out.ranking).toMatchObject({ points: 0, maxPoints: 0, wall: null, pack: null, streakCounted: true });
  });

  it("never counts a daily kata solve toward belts", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const before = await m.progress.solvedPerBelt(db, ids.ben as string);
    await submit("ben", "k-101-pill-button", 100, `kata:${today}`);
    expect(await m.progress.solvedPerBelt(db, ids.ben as string)).toEqual(before);
  });

  it("freezes final pack standings from Submits made before it ended", async () => {
    const pack = m.packs.getPack(1);
    if (!pack) throw new Error("pack 1 missing");
    const after = new Date(pack.ends.getTime() + 60_000);
    await submit("ana", W5, 100, "library", after);
    await m.tick.finalizePack(db, pack, after);
    const rows = await db.select().from(s.packResults).where(eq(s.packResults.packNumber, 1)).orderBy(s.packResults.rank);
    // ben: 95 + 100 + 80 = 162 + 200 + 72. ana: 90 + 100 = 128 + 200 (her later 100 on
    // w-001 came after opening solutions, and w-005 came after the pack ended).
    expect(rows.map((r) => [r.playerId === ids.ana ? "ana" : "ben", r.points, r.solved])).toEqual([
      ["ben", 434, 2],
      ["ana", 328, 2],
    ]);
  });

  it("moves a guest's locks, streak days and badges on sign-in", async () => {
    const [guest] = await db.insert(s.players).values({}).returning({ id: s.players.id });
    if (!guest) throw new Error("no guest");
    await db.insert(s.answerLocks).values({ playerId: guest.id, challengeId: W6 });
    await db.insert(s.kataDays).values({ playerId: guest.id, date: "2026-10-20" });
    await m.merge.mergeGuest(db, guest.id, ids.ben as string);
    const locks = await db.select().from(s.answerLocks).where(eq(s.answerLocks.playerId, ids.ben as string));
    const days = await db.select().from(s.kataDays).where(eq(s.kataDays.playerId, ids.ben as string));
    expect(locks.map((l) => l.challengeId)).toContain(W6);
    expect(days.map((d) => d.date)).toContain("2026-10-20");
  });
});
