import { describe, expect, it } from "vitest";
import { APP_VERSION } from "./index";

describe("shared", () => {
  it("starts at 1.0.0", () => {
    expect(APP_VERSION).toBe("1.0.0");
  });
});
