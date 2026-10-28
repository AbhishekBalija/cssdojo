import { describe, expect, it } from "vitest";
import { isPlaced, misplacedHooks, overlap } from "./checks";
import type { DomSnapshot, HookInfo } from "./render";

function hook(name: string, x: number, y: number, w: number, h: number): HookInfo {
  return { name, selector: `.${name}`, found: true, visible: true, box: { x, y, w, h }, role: "button", labelled: false };
}
function snap(...hooks: HookInfo[]): DomSnapshot {
  return { hooks, texts: [], text: "" };
}

describe("placement gate", () => {
  const target = { x: 120, y: 125, w: 160, h: 50 }; // a centred button in the 400x300 stage

  it("measures overlap as intersection over union", () => {
    expect(overlap(target, target)).toBe(1);
    expect(overlap(target, { x: 0, y: 0, w: 10, h: 10 })).toBe(0);
  });

  it("does not count an unstyled starter button in the top-left corner", () => {
    expect(isPlaced({ x: 0, y: 0, w: 76, h: 21 }, target)).toBe(false);
  });

  it("does not count a right-placed element that is far too small", () => {
    expect(isPlaced({ x: 170, y: 140, w: 60, h: 20 }, target)).toBe(false);
  });

  it("forgives near misses in size and position", () => {
    expect(isPlaced({ x: 124, y: 127, w: 152, h: 46 }, target)).toBe(true);
    expect(isPlaced({ x: 98, y: 98, w: 12, h: 12 }, { x: 100, y: 100, w: 8, h: 8 })).toBe(true);
  });

  it("lists every hook that is missing or misplaced", () => {
    const ref = snap(hook("btn", 120, 125, 160, 50), hook("icon", 130, 140, 20, 20));
    const answer = snap(hook("btn", 0, 0, 76, 21), hook("icon", 131, 140, 20, 20));
    expect(misplacedHooks(answer, ref)).toEqual(["btn"]);
    expect(misplacedHooks(snap(), ref)).toEqual(["btn", "icon"]);
  });
});
