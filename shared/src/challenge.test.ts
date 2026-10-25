import { describe, expect, it } from "vitest";
import { ChallengeMetaSchema } from "./challenge";

const valid = {
  id: "w-001-primary-button",
  number: 1,
  title: "Primary button",
  belt: "white",
  kind: "challenge",
  brief: "A call-to-action button with a darker hover.",
  frames: ["rest", "hover"],
  hooks: { button: ".btn" },
  states: { hover: "button" },
  checks: ["hooks-present", "hover-changes"],
  colors: ["#5F4AE6"],
  inspiration: [{ source: "Example", url: "https://example.com", note: "Took the weight, changed colour." }],
};

describe("ChallengeMetaSchema", () => {
  it("accepts a valid challenge", () => {
    expect(ChallengeMetaSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects a hover frame without a hover hook", () => {
    expect(ChallengeMetaSchema.safeParse({ ...valid, states: {} }).success).toBe(false);
  });
  it("requires hooks-present", () => {
    expect(ChallengeMetaSchema.safeParse({ ...valid, checks: ["hover-changes"] }).success).toBe(false);
  });
  it("requires kataDay for kata", () => {
    expect(ChallengeMetaSchema.safeParse({ ...valid, kind: "kata" }).success).toBe(false);
  });
});
