import { describe, expect, it } from "vitest";
import { kataDayFor, nextResetAt, streakFrom } from "./kata";

describe("kata", () => {
  it("starts the cycle on the epoch and loops", () => {
    expect(kataDayFor("2026-10-26", 14)).toBe(1);
    expect(kataDayFor("2026-11-08", 14)).toBe(14);
    expect(kataDayFor("2026-11-09", 14)).toBe(1);
    expect(kataDayFor("2026-10-25", 14)).toBe(14);
  });
  it("resets at the next 00:00 UTC", () => {
    expect(nextResetAt(new Date("2026-10-25T23:59:00Z")).toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });
  it("counts streaks ending today or yesterday", () => {
    expect(streakFrom(["2026-10-24", "2026-10-25"], "2026-10-25")).toBe(2);
    expect(streakFrom(["2026-10-23", "2026-10-24"], "2026-10-25")).toBe(2);
    expect(streakFrom(["2026-10-22"], "2026-10-25")).toBe(0);
  });
});
