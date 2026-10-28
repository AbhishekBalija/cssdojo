import { describe, expect, it } from "vitest";
import { BADGES, MAX_POINTS, PACK_LIVE_DAYS, packEndsAt, packState, pointsFor, type PackDef } from "./ranking";
import { longestRun, streakDetail } from "./kata";

describe("pointsFor", () => {
  it("gives nothing at or below 50 and the full max at 100", () => {
    expect(pointsFor(50, "black")).toBe(0);
    expect(pointsFor(12, "white")).toBe(0);
    expect(pointsFor(100, "white")).toBe(MAX_POINTS.white);
    expect(pointsFor(100, "black")).toBe(1000);
  });

  it("climbs steeply near a perfect score", () => {
    expect(pointsFor(90, "black")).toBe(640);
    expect(pointsFor(95, "black")).toBe(810);
    expect(pointsFor(75, "green")).toBe(150);
  });

  it("never goes past the max", () => {
    expect(pointsFor(140, "yellow")).toBe(MAX_POINTS.yellow);
  });
});

const pack: PackDef = {
  number: 1,
  title: "First moves",
  description: "Six white challenges",
  belt: "white",
  challenges: ["a", "b", "c", "d", "e", "f"],
  opensAt: "2026-11-01T00:00:00Z",
};

describe("packState", () => {
  it("is upcoming before it opens, live for 28 days, then finished", () => {
    expect(packState(pack, new Date("2026-10-31T23:59:59Z"))).toBe("upcoming");
    expect(packState(pack, new Date("2026-11-01T00:00:00Z"))).toBe("live");
    expect(packEndsAt(pack).toISOString()).toBe(new Date(Date.parse(pack.opensAt) + PACK_LIVE_DAYS * 86_400_000).toISOString());
    expect(packState(pack, packEndsAt(pack))).toBe("finished");
  });

  it("uses the pack's own end when it has one", () => {
    const short = { ...pack, endsAt: "2026-11-08T00:00:00Z" };
    expect(packState(short, new Date("2026-11-07T12:00:00Z"))).toBe("live");
    expect(packState(short, new Date("2026-11-08T00:00:00Z"))).toBe("finished");
  });
});

describe("badges", () => {
  it("has the 18 badges from the approved screens, with unique ids", () => {
    expect(BADGES).toHaveLength(18);
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(18);
    expect(BADGES.filter((b) => !b.enabled).map((b) => b.id)).toEqual(["sparring"]);
  });
});

describe("streaks", () => {
  it("finds the longest run of days", () => {
    expect(longestRun([])).toBe(0);
    expect(longestRun(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05", "2026-10-06"])).toBe(3);
    expect(longestRun(["2026-10-31", "2026-11-01", "2026-11-01"])).toBe(2);
  });

  it("marks the week Monday to Sunday", () => {
    // 2026-10-28 is a Wednesday.
    const d = streakDetail(["2026-10-26", "2026-10-27"], "2026-10-28");
    expect(d.week).toEqual(["done", "done", "today", "future", "future", "future", "future"]);
    expect(d).toMatchObject({ current: 2, best: 2, playedToday: false });
    const played = streakDetail(["2026-10-27", "2026-10-28"], "2026-10-28");
    expect(played.week.slice(0, 3)).toEqual(["missed", "done", "done"]);
    expect(played).toMatchObject({ current: 2, playedToday: true });
  });
});
