import type { PNG } from "pngjs";
import type { CheckId, CheckResult } from "@cssdojo/shared";
import { countChangedPixels, type Rgb } from "./metric";
import type { Box, DomSnapshot, RenderOutput } from "./render";

// Outcome checks. Each one looks at what the answer DOES (rendered pixels and the
// resulting DOM), never at which properties or selectors were used. Hints say
// what is wrong, never how to fix it.

export const CHECK_LABELS: Record<CheckId, string> = {
  "hooks-present": "Required parts are there",
  "hover-changes": "Responds to hover",
  "focus-visible": "Keyboard focus is visible",
  "text-contrast-aa": "Text is easy to read",
  "target-size": "Big enough to tap",
  "semantic-control": "Controls are real controls",
  "real-text": "Text is real text",
};

const DPR = 2;
const INTERACTIVE = new Set(["button", "link", "checkbox", "radio", "range", "textbox", "combobox", "switch", "tab", "menuitem"]);

export interface CheckContext {
  answer: RenderOutput;
  target: RenderOutput;
  hooks: Record<string, string>;
  states: { hover?: string | undefined; focus?: string | undefined };
}

function pass(id: CheckId): CheckResult {
  return { id, label: CHECK_LABELS[id], pass: true };
}
function fail(id: CheckId, hint: string): CheckResult {
  return { id, label: CHECK_LABELS[id], pass: false, hint };
}

export function missingHooks(snapshot: DomSnapshot): string[] {
  return snapshot.hooks.filter((h) => !h.found || !h.visible).map((h) => h.name);
}

// ---------- colour helpers ----------

function parseCssColor(c: string): { rgb: Rgb; alpha: number } {
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (!m?.[1]) return { rgb: [0, 0, 0], alpha: 1 };
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return { rgb: [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0], alpha: parts[3] ?? 1 };
}

function luminance([r, g, b]: Rgb): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function pixel(img: PNG, x: number, y: number): Rgb {
  const i = (y * img.width + x) * 4;
  return [img.data[i] ?? 0, img.data[i + 1] ?? 0, img.data[i + 2] ?? 0];
}

/** Most common colour inside a CSS-pixel box of a 2x frame. */
function dominantColor(img: PNG, box: Box): Rgb | null {
  const x0 = Math.max(0, Math.floor(box.x * DPR));
  const y0 = Math.max(0, Math.floor(box.y * DPR));
  const x1 = Math.min(img.width, Math.ceil((box.x + box.w) * DPR));
  const y1 = Math.min(img.height, Math.ceil((box.y + box.h) * DPR));
  if (x1 <= x0 || y1 <= y0) return null;
  const counts = new Map<number, number>();
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const [r, g, b] = pixel(img, x, y);
      const key = (r << 16) | (g << 8) | b;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  let best = 0;
  let n = -1;
  for (const [k, v] of counts) if (v > n) [best, n] = [k, v];
  return [(best >> 16) & 255, (best >> 8) & 255, best & 255];
}

function grow(box: Box, by: number): Box {
  return { x: box.x - by, y: box.y - by, w: box.w + by * 2, h: box.h + by * 2 };
}

// ---------- the checks ----------

function hoverChanges(ctx: CheckContext): CheckResult {
  const rest = ctx.answer.frames.rest;
  const hover = ctx.answer.frames.hover;
  if (!rest || !hover) return pass("hover-changes");
  const changed = countChangedPixels(rest, hover);
  // A visible change is at least a few dozen device pixels (well above noise).
  return changed >= 40 ? pass("hover-changes") : fail("hover-changes", "Nothing changes when you hover it.");
}

function focusVisible(ctx: CheckContext): CheckResult {
  const rest = ctx.answer.frames.rest;
  const focus = ctx.answer.frames.focus;
  const hookName = ctx.states.focus;
  if (!rest || !focus || !hookName) return pass("focus-visible");
  if (!ctx.answer.focusReached) return fail("focus-visible", "Pressing Tab never reaches it, so keyboard users can't use it.");
  const hook = ctx.answer.snapshot.hooks.find((h) => h.name === hookName);
  if (!hook?.box) return fail("focus-visible", "Keyboard users can't see where focus is.");
  const area = grow(hook.box, 10);
  const x0 = Math.max(0, Math.floor(area.x * DPR));
  const y0 = Math.max(0, Math.floor(area.y * DPR));
  const x1 = Math.min(rest.width, Math.ceil((area.x + area.w) * DPR));
  const y1 = Math.min(rest.height, Math.ceil((area.y + area.h) * DPR));
  let strong = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const a = pixel(rest, x, y);
      const b = pixel(focus, x, y);
      if (a[0] === b[0] && a[1] === b[1] && a[2] === b[2]) continue;
      if (contrastRatio(a, b) >= 3) strong++;
    }
  }
  // Roughly a 1px ring all the way round (perimeter in device pixels).
  const perimeter = 2 * (hook.box.w + hook.box.h) * DPR;
  return strong >= perimeter ? pass("focus-visible") : fail("focus-visible", "Keyboard users can't see where focus is.");
}

function textContrast(ctx: CheckContext): CheckResult {
  const rest = ctx.answer.frames.rest;
  if (!rest) return pass("text-contrast-aa");
  for (const t of ctx.answer.snapshot.texts) {
    if (t.box.x >= 400 || t.box.y >= 300 || t.box.x + t.box.w <= 0 || t.box.y + t.box.h <= 0) continue;
    const bg = dominantColor(rest, t.box);
    if (!bg) continue;
    const { rgb, alpha } = parseCssColor(t.color);
    const fg: Rgb = [0, 1, 2].map((i) => Math.round((rgb[i] ?? 0) * alpha + (bg[i] ?? 0) * (1 - alpha))) as Rgb;
    const large = t.fontSize >= 24 || (t.fontSize >= 18.66 && t.fontWeight >= 700);
    if (contrastRatio(fg, bg) < (large ? 3 : 4.5)) return fail("text-contrast-aa", "Some text is hard to read against its background.");
  }
  return pass("text-contrast-aa");
}

function targetSize(ctx: CheckContext): CheckResult {
  for (const h of ctx.answer.snapshot.hooks) {
    if (!INTERACTIVE.has(h.role) || !h.box) continue;
    if (h.box.w < 24 || h.box.h < 24) return fail("target-size", "A control is smaller than a fingertip can hit.");
  }
  return pass("target-size");
}

function semanticControl(ctx: CheckContext): CheckResult {
  for (const ref of ctx.target.snapshot.hooks) {
    if (!INTERACTIVE.has(ref.role)) continue;
    const mine = ctx.answer.snapshot.hooks.find((h) => h.name === ref.name);
    if (!mine || mine.role !== ref.role) {
      return fail("semantic-control", `Screen readers can't tell "${ref.name}" is a ${ref.role}.`);
    }
    if (ref.role === "textbox" || ref.role === "checkbox" || ref.role === "radio" || ref.role === "range") {
      if (!mine.labelled) return fail("semantic-control", `Screen readers can't tell what "${ref.name}" is for.`);
    }
  }
  return pass("semantic-control");
}

function words(s: string): string[] {
  return s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function realText(ctx: CheckContext): CheckResult {
  const mine = new Set(words(ctx.answer.snapshot.text));
  const missing = words(ctx.target.snapshot.text).filter((w) => !mine.has(w));
  return missing.length === 0 ? pass("real-text") : fail("real-text", "Some of the target's words are missing or aren't real text.");
}

export function runChecks(ids: readonly CheckId[], ctx: CheckContext): CheckResult[] {
  return ids.map((id) => {
    switch (id) {
      case "hooks-present":
        return pass(id); // Missing hooks stop scoring before checks run.
      case "hover-changes":
        return hoverChanges(ctx);
      case "focus-visible":
        return focusVisible(ctx);
      case "text-contrast-aa":
        return textContrast(ctx);
      case "target-size":
        return targetSize(ctx);
      case "semantic-control":
        return semanticControl(ctx);
      case "real-text":
        return realText(ctx);
    }
  });
}
