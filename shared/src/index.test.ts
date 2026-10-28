import { describe, expect, it } from "vitest";
import { APP_VERSION } from "./index";

describe("shared", () => {
  it("starts at 0.1.0", () => {
    expect(APP_VERSION).toBe("0.1.0");
  });
});
