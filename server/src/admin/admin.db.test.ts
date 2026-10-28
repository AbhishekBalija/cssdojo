import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";

// Runs against a real Postgres, like ranking.db.test.ts: only when TEST_DATABASE_URL
// points at a throwaway database (its name must contain "test"). It empties the player tables.
const url = process.env.TEST_DATABASE_URL;
const enabled = !!url && /test/.test(new URL(url).pathname);
if (enabled && url) process.env.DATABASE_URL = url;

const mod = enabled
  ? {
      client: await import("../db/client"),
      schema: await import("../db/schema"),
      progress: await import("../progress"),
      standings: await import("../ranking/standings"),
      packs: await import("../packs"),
      overrides: await import("./overrides"),
      void: await import("./void"),
      seed: await import("../db/seed"),
    }
  : null;

// Five white challenges: enough for a white belt.
const WHITE = ["w-001-primary-button", "w-002-outline-button", "w-003-status-pill", "w-004-text-link", "w-005-avatar-initials"];

describe.skipIf(!enabled)("admin actions against Postgres", () => {
  if (!mod) return;
  const m = mod;
  const { db, sqlClient } = m.client;
  const s = m.schema;
  const ids: Record<string, string> = {};

  async function player(name: string): Promise<string> {
    await db.insert(s.user).values({ id: `u-${name}`, name, email: `${name}@example.test`, handle: name, emailVerified: true });
    const [p] = await db.insert(s.players).values({ userId: `u-${name}` }).returning({ id: s.players.id });
    if (!p) throw new Error("no player");
    ids[name] = p.id;
    return p.id;
  }

  async function submit(name: string, challengeId: string, score: number): Promise<string> {
    const [sub] = await db
      .insert(s.submissions)
      .values({ playerId: ids[name] as string, challengeId, board: "library", code: `/* ${score} */`, status: "done", score })
      .returning({ id: s.submissions.id });
    if (!sub) throw new Error("no submission");
    await m.progress.recordScore(db, sub.id);
    return sub.id;
  }

  async function best(name: string, challengeId: string) {
    const [row] = await db
      .select()
      .from(s.bestScores)
      .where(and(eq(s.bestScores.playerId, ids[name] as string), eq(s.bestScores.challengeId, challengeId), eq(s.bestScores.board, "library")));
    return row;
  }

  beforeAll(async () => {
    await db.execute(sql`truncate players, "user", notifications, events, pack_results, pack_follows, kata_days, admin_actions cascade`);
    await db.execute(sql`update packs set soon_sent_at = null, opened_sent_at = null, finalized_at = null`);
    await db.execute(sql`update challenges set hidden_at = null`);
    await player("cara");
    await player("dev");
  });

  afterAll(async () => {
    await db.execute(sql`update challenges set hidden_at = null`);
    await m.overrides.loadOverrides(db);
    await sqlClient.end();
  });

  it("rebuilds the best score and takes back the belt when a Submit is voided", async () => {
    await submit("cara", WHITE[0] as string, 80);
    const copied = await submit("cara", WHITE[0] as string, 100);
    for (const id of WHITE.slice(1)) await submit("cara", id, 95);
    const belts = await db.select().from(s.playerBelts).where(eq(s.playerBelts.playerId, ids.cara as string));
    expect(belts.map((b) => b.belt)).toEqual(["white"]);

    const out = await m.void.voidSubmission(db, copied, "u-dev");
    expect(out).toMatchObject({ before: { score: 100, best: 100, belts: ["white"] }, after: { best: 80, belts: [] } });
    // 80 on a white challenge: 200 * ((80 - 50) / 50)^2 = 72 points.
    expect(await best("cara", WHITE[0] as string)).toMatchObject({ score: 80, points: 72 });
    // Voiding twice does nothing.
    expect(await m.void.voidSubmission(db, copied, "u-dev")).toBeNull();
  });

  it("removes the best score when no other Submit is left", async () => {
    const only = await submit("dev", WHITE[1] as string, 70);
    await m.void.voidSubmission(db, only, "u-cara");
    expect(await best("dev", WHITE[1] as string)).toBeUndefined();
  });

  it("leaves a hidden player off the Wall, except for themself", async () => {
    await submit("dev", WHITE[2] as string, 100);
    const wall = async (viewer?: string) => (await m.standings.standings(db, undefined, viewer)).map((r) => r.playerId);
    expect(await wall()).toContain(ids.dev);
    await db.update(s.players).set({ hiddenAt: new Date() }).where(eq(s.players.id, ids.dev as string));
    expect(await wall()).not.toContain(ids.dev);
    expect(await wall(ids.cara)).not.toContain(ids.dev);
    expect(await wall(ids.dev)).toContain(ids.dev);
    await db.update(s.players).set({ hiddenAt: null }).where(eq(s.players.id, ids.dev as string));
  });

  it("hides a challenge from play after the overrides load", async () => {
    const id = WHITE[3] as string;
    expect(m.packs.isHidden(id)).toBe(false);
    await db.update(s.challenges).set({ hiddenAt: new Date() }).where(eq(s.challenges.id, id));
    await m.overrides.loadOverrides(db);
    expect(m.packs.isHidden(id)).toBe(true);
    const pack = m.packs.packOf(id);
    if (!pack) throw new Error("no pack");
    expect(m.packs.visibleChallenges(pack)).not.toContain(id);
  });

  it("keeps a pack date set in the database when the seed runs again", async () => {
    const moved = new Date("2027-01-05T00:00:00Z");
    const ends = new Date("2027-02-02T00:00:00Z");
    const [before] = await db.select().from(s.packs).where(eq(s.packs.number, 5));
    if (!before) throw new Error("pack 5 missing");
    await db.update(s.packs).set({ opensAt: moved, endsAt: ends }).where(eq(s.packs.number, 5));
    await m.seed.seed();
    const [after] = await db.select().from(s.packs).where(eq(s.packs.number, 5));
    expect(after?.opensAt.toISOString()).toBe(moved.toISOString());
    await m.overrides.loadOverrides(db);
    expect(m.packs.getPack(5)?.opens.toISOString()).toBe(moved.toISOString());
    // Put it back for other tests.
    await db.update(s.packs).set({ opensAt: before.opensAt, endsAt: before.endsAt }).where(eq(s.packs.number, 5));
    await m.overrides.loadOverrides(db);
  });
});
