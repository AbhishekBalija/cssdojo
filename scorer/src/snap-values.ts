// One-off migration helper: snaps every off-scale px value in a challenge's
// reference and starter to the nearest value on the scale (value-scale.ts), and
// applies the same change to golden answers wherever they repeat the
// reference's declaration word for word (a golden's deliberate near miss is left
// alone). Run: bun run scorer/src/snap-values.ts [challenge-id-filter]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FONT_SIZES, LINE_WIDTHS, RADII, onScale } from "./value-scale";

const ROOT = path.resolve(import.meta.dirname, "../../challenges");

type Kind = "font" | "line" | "radius" | "space";

function nearest(list: readonly number[], v: number): number {
  let best = list[0] ?? 0;
  for (const x of list) if (Math.abs(x - v) < Math.abs(best - v)) best = x;
  return best;
}

function snap(kind: Kind, px: number): number {
  if (onScale(kind, px)) return px;
  const sign = px < 0 ? -1 : 1;
  const v = Math.abs(px);
  let out: number;
  if (kind === "font") out = nearest(FONT_SIZES, v);
  else if (kind === "line") out = nearest(LINE_WIDTHS, v);
  else if (kind === "radius") out = nearest(RADII, v);
  else if (v < 2) out = Math.round(v);
  else if (v <= 14) out = Math.round(v / 2) * 2;
  else out = Math.round(v / 4) * 4;
  return sign * out;
}

const LINE_PROPS = /^(border(-(top|right|bottom|left))?(-width)?|outline(-width|-offset)?|text-decoration(-thickness)?|text-underline-offset|column-rule(-width)?)$/;
function kindOf(prop: string): Kind {
  if (prop === "font-size") return "font";
  if (prop.includes("radius")) return "radius";
  if (LINE_PROPS.test(prop)) return "line";
  return "space";
}

function fmt(n: number): string {
  return `${n}px`;
}

/** Rewrites one declaration value. */
function snapValue(prop: string, value: string): string {
  if (prop === "font") {
    return value.replace(/(\d*\.?\d+)px(?:(\s*\/\s*)(\d*\.?\d+)px)?/, (_m, size: string, sep: string | undefined, lh: string | undefined) => {
      const s = fmt(snap("font", Number(size)));
      return lh ? `${s}${sep ?? "/"}${fmt(snap("space", Number(lh)))}` : s;
    });
  }
  const kind = kindOf(prop);
  return value.replace(/(-?\d*\.?\d+)px/g, (_m, n: string) => fmt(snap(kind, Number(n))));
}

const DECL = /([a-z-]+)(\s*:\s*)([^;{}]+)/gi;

/** Snaps every declaration inside <style> blocks; returns the new html and the changed declarations. */
function snapHtml(html: string, only?: Set<string>): { html: string; changed: Map<string, string> } {
  const changed = new Map<string, string>();
  const out = html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (_m, open: string, css: string, close: string) => {
    const next = css.replace(DECL, (whole, prop: string, colon: string, value: string) => {
      if (only && !only.has(whole.trim())) return whole;
      const v = snapValue(prop.toLowerCase(), value);
      if (v === value) return whole;
      const replaced = `${prop}${colon}${v}`;
      changed.set(whole.trim(), replaced.trim());
      return replaced;
    });
    return open + next + close;
  });
  return { html: out, changed };
}

const filter = process.argv[2];
let total = 0;
for (const id of readdirSync(ROOT).filter((d) => !d.startsWith(".") && (!filter || d.includes(filter)))) {
  const dir = path.join(ROOT, id);
  const refPath = path.join(dir, "reference.html");
  const ref = snapHtml(readFileSync(refPath, "utf8"));
  if (ref.changed.size === 0) continue;
  writeFileSync(refPath, ref.html);
  const starterPath = path.join(dir, "starter.html");
  writeFileSync(starterPath, snapHtml(readFileSync(starterPath, "utf8")).html);
  const keys = new Set(ref.changed.keys());
  for (const g of readdirSync(path.join(dir, "golden"))) {
    const gp = path.join(dir, "golden", g);
    writeFileSync(gp, snapHtml(readFileSync(gp, "utf8"), keys).html);
  }
  total += ref.changed.size;
  console.log(`${id}: ${[...ref.changed].map(([a, b]) => `${a} -> ${b}`).join(" | ")}`);
}
console.log(`snapped ${total} declarations`);
