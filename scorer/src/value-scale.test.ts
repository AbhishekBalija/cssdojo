import { describe, expect, it } from "vitest";
import { offScaleValues, onScale } from "./value-scale";

const doc = (css: string) => `<style>${css}</style><div></div>`;

describe("value scale", () => {
  it("accepts spacing on the grid and rejects odd values", () => {
    for (const v of [0, 1, 2, 6, 10, 14, 16, 20, 48, -8]) expect(onScale("space", v)).toBe(true);
    for (const v of [3, 15, 18, 27, 5.5]) expect(onScale("space", v)).toBe(false);
  });

  it("uses the type scale for font sizes", () => {
    expect(onScale("font", 14)).toBe(true);
    expect(onScale("font", 15)).toBe(false);
  });

  it("treats 999px and up as a full round radius", () => {
    expect(onScale("radius", 999)).toBe(true);
    expect(onScale("radius", 10)).toBe(false);
  });

  it("finds off-scale values by property kind", () => {
    const off = offScaleValues(doc(".a { padding: 10px 27px; border: 3px solid red; border-radius: 8px; font: 600 15px/20px Onest; }"));
    expect(off.map((o) => [o.prop, o.px])).toEqual([
      ["padding", 27],
      ["border", 3],
      ["font-size", 15],
    ]);
  });

  it("ignores values outside style blocks", () => {
    expect(offScaleValues('<div style="width: 27px"></div>')).toEqual([]);
  });
});
