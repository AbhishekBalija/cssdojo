import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./checks";
import { backgroundColor, compareFrames } from "./metric";

function img(draw: (x: number, y: number) => [number, number, number]): PNG {
  const png = new PNG({ width: 40, height: 30 });
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 40; x++) {
      const [r, g, b] = draw(x, y);
      const i = (y * 40 + x) * 4;
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = 255;
    }
  }
  return png;
}

const box = (x0: number, x1: number) => img((x, y) => (x >= x0 && x < x1 && y >= 10 && y < 20 ? [95, 74, 230] : [241, 242, 244]));

describe("compareFrames", () => {
  it("scores identical frames 100", () => {
    expect(compareFrames(box(10, 30), box(10, 30)).score).toBe(100);
  });
  it("finds the background colour", () => {
    expect(backgroundColor(box(10, 30))).toEqual([241, 242, 244]);
  });
  it("forgives a one-pixel drift but not a bigger one", () => {
    expect(compareFrames(box(10, 30), box(11, 31)).score).toBeGreaterThan(90);
    expect(compareFrames(box(10, 30), box(14, 34)).score).toBeLessThan(75);
  });
  it("scores a missing component low", () => {
    expect(compareFrames(box(10, 30), box(0, 0)).score).toBeLessThan(30);
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white", () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 0);
  });
});
