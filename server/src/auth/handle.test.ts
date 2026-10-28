import { describe, expect, it } from "vitest";
import { baseHandle } from "./handle";

describe("baseHandle", () => {
  it("slugs the display name", () => {
    expect(baseHandle("Abhi Balija", "a@x.dev")).toBe("abhi-balija");
  });
  it("falls back to the email local part", () => {
    expect(baseHandle("  ", "ninja.coder@x.dev")).toBe("ninja-coder");
  });
  it("strips accents and caps the length", () => {
    expect(baseHandle("Zoë Ångström the very long name", "z@x.dev")).toBe("zoe-angstrom-the-ver");
  });
  it("never returns an empty handle", () => {
    expect(baseHandle("!!", "@x.dev")).toBe("player");
  });
});
