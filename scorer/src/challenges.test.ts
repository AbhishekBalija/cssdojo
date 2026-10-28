import { describe, expect, it } from "vitest";
import { loadAllChallenges } from "./challenges";
import { offScaleValues } from "./value-scale";

describe("challenge folders", async () => {
  const all = await loadAllChallenges();

  it("all validate against the schema", () => {
    expect(all.length).toBeGreaterThan(0);
  });

  it.each(all.map((c) => [c.meta.id, c] as const))("%s ships at least three golden answers and an inspiration source", (_id, c) => {
    expect(c.golden.length).toBeGreaterThanOrEqual(3);
    expect(c.meta.inspiration.length).toBeGreaterThan(0);
  });

  it.each(all.map((c) => [c.meta.id, c] as const))("%s starter keeps every hook selector", (_id, c) => {
    for (const sel of Object.values(c.meta.hooks)) {
      const cls = /^\.([a-z0-9_-]+)$/i.exec(sel)?.[1];
      if (cls) expect(c.starter).toContain(cls);
    }
  });

  it.each(all.map((c) => [c.meta.id, c] as const))("%s reference and starter use only values on the scale", (_id, c) => {
    expect(offScaleValues(c.reference)).toEqual([]);
    expect(offScaleValues(c.starter)).toEqual([]);
  });

  // Icons and images are given, never drawn by the player: every <svg> and <img>
  // in the reference must already be in the starter, character for character.
  it.each(all.map((c) => [c.meta.id, c] as const))("%s starter ships every icon the reference uses", (_id, c) => {
    const assets = c.reference.match(/<svg[\s\S]*?<\/svg>|<img\b[^>]*>/g) ?? [];
    for (const a of assets) expect(c.starter).toContain(a);
  });

  it("kata days are 1..n without gaps", () => {
    const days = all.filter((c) => c.meta.kind === "kata").map((c) => c.meta.kataDay ?? 0).sort((a, b) => a - b);
    days.forEach((d, i) => expect(d).toBe(i + 1));
  });
});
