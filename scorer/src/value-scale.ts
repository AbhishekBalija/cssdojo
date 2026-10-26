// The value scale every target is built on, so a player can guess sizes the way
// they would in a real design system (8px, 12px, 16px...) instead of reading odd
// numbers like 27px off the pixels. It is Tailwind's default scale: a 4px grid
// with 2px half-steps up to 14px. Checked on every reference and starter by
// challenges.test.ts; golden near-misses are exempt (they are off on purpose).

/** Font sizes, in px. */
export const FONT_SIZES = [12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72, 96] as const;
/** Border, outline, ring and underline widths and offsets, in px. */
export const LINE_WIDTHS = [0, 1, 2, 4, 8] as const;
/** Corner radii, in px. 999 and above means "fully round". */
export const RADII = [0, 2, 4, 6, 8, 12, 16, 24, 32] as const;

type Kind = "font" | "line" | "radius" | "space";

const LINE_PROPS = /^(border(-(top|right|bottom|left))?(-width)?|outline(-width|-offset)?|text-decoration(-thickness)?|text-underline-offset|column-rule(-width)?)$/;

function kindOf(prop: string): Kind {
  if (prop === "font-size") return "font";
  if (prop.includes("radius")) return "radius";
  if (LINE_PROPS.test(prop)) return "line";
  return "space";
}

/** True when a px value fits the scale for its kind of property. */
export function onScale(kind: Kind, px: number): boolean {
  const v = Math.abs(px);
  switch (kind) {
    case "font":
      return (FONT_SIZES as readonly number[]).includes(v);
    case "line":
      return (LINE_WIDTHS as readonly number[]).includes(v);
    case "radius":
      return v >= 999 || (RADII as readonly number[]).includes(v);
    case "space":
      // Spacing, sizes, positions, shadows and line heights:
      // 0, 1, 2, then every 2px up to 14, then every 4px.
      if (!Number.isInteger(v)) return false;
      return v <= 2 || (v <= 14 && v % 2 === 0) || v % 4 === 0;
  }
}

export interface OffScale {
  prop: string;
  value: string;
  px: number;
}

const PX = /(-?\d*\.?\d+)px/g;

/** Every px value in the document's <style> blocks that is off the scale. */
export function offScaleValues(html: string): OffScale[] {
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1] ?? "").join("\n");
  const out: OffScale[] = [];
  for (const m of css.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)/gi)) {
    const prop = (m[1] ?? "").toLowerCase();
    const value = (m[2] ?? "").trim();
    if (prop === "font") {
      // font: <weight> <size>/<line-height> <family>
      const fm = /(\d*\.?\d+)px(?:\s*\/\s*(\d*\.?\d+)px)?/.exec(value);
      if (fm?.[1] && !onScale("font", Number(fm[1]))) out.push({ prop: "font-size", value, px: Number(fm[1]) });
      if (fm?.[2] && !onScale("space", Number(fm[2]))) out.push({ prop: "line-height", value, px: Number(fm[2]) });
      continue;
    }
    const kind = kindOf(prop);
    for (const n of value.matchAll(PX)) {
      const px = Number(n[1]);
      if (!onScale(kind, px)) out.push({ prop, value, px });
    }
  }
  return out;
}
