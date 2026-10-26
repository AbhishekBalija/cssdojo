import { describe, expect, it } from "vitest";
import { diffBoard } from "./moves";
import { byPointsThenTime, type Standing } from "./standings";

const at = (m: number) => new Date(Date.UTC(2026, 9, 26, 0, m));
const s = (playerId: string, points: number, minute: number): Standing => ({ playerId, points, solved: 0, reachedAt: at(minute) });

describe("byPointsThenTime", () => {
  it("breaks ties by whoever reached the total first", () => {
    const sorted = [s("late", 500, 9), s("top", 900, 5), s("early", 500, 1)].sort(byPointsThenTime);
    expect(sorted.map((x) => x.playerId)).toEqual(["top", "early", "late"]);
  });
});

describe("diffBoard", () => {
  const before = [s("a", 900, 1), s("b", 600, 2), s("c", 400, 3), s("me", 300, 4)];

  it("lists the players you passed", () => {
    const after = [s("a", 900, 1), s("me", 700, 10), s("b", 600, 2), s("c", 400, 3)];
    expect(diffBoard(before, after, "me")).toEqual({ rankBefore: 4, rankAfter: 2, passed: ["b", "c"] });
  });

  it("does not count a tie you reached later as a pass", () => {
    const after = [s("a", 900, 1), s("b", 600, 2), s("me", 600, 10), s("c", 400, 3)];
    expect(diffBoard(before, after, "me")).toEqual({ rankBefore: 4, rankAfter: 3, passed: ["c"] });
  });

  it("treats a first entry on the board as passing everyone below", () => {
    const after = [s("a", 900, 1), s("new", 650, 10), s("b", 600, 2), s("c", 400, 3), s("me", 300, 4)];
    expect(diffBoard(before, after, "new")).toEqual({ rankBefore: null, rankAfter: 2, passed: ["b", "c", "me"] });
  });

  it("reports no move for a player who is not on the board", () => {
    expect(diffBoard(before, before, "ghost")).toEqual({ rankBefore: null, rankAfter: null, passed: [] });
  });
});
