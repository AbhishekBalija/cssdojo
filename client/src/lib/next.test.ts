import { describe, expect, it } from "vitest";
import { safeNext } from "./next";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/c/b-021")).toBe("/c/b-021");
    expect(safeNext("/leaderboard?tab=kata")).toBe("/leaderboard?tab=kata");
  });
  it("falls back to home", () => {
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext("")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext("/signin")).toBe("/");
  });
});
