import { PNG } from "pngjs";
import { combineScore, round1, sanitizeCode, type ChallengeMeta, type FrameName, type FrameScore, type ScoreResult } from "@cssdojo/shared";
import { missingHooks, runChecks } from "./checks";
import { backgroundColor, compareFrames, maskToPng, type Rgb } from "./metric";
import type { Renderer, RenderOutput } from "./render";

export interface Target {
  meta: ChallengeMeta;
  output: RenderOutput;
}

function spec(meta: ChallengeMeta) {
  return { frames: meta.frames, hooks: meta.hooks, states: meta.states };
}

/** Renders the reference solution once; the result is what answers are compared with. */
export async function renderTarget(renderer: Renderer, meta: ChallengeMeta, reference: string): Promise<Target> {
  const { code } = sanitizeCode(reference);
  return { meta, output: await renderer.render(code, spec(meta)) };
}

/** Mismatch maps per frame, as PNG data URLs (see maskToPng). */
export type MismatchMaps = Partial<Record<FrameName, string>>;

/** RGB distance above which the stage background counts as a different colour (same as the metric's background tolerance). */
const BG_HINT_TOLERANCE = 6;

function rgbDistance(a: Rgb, b: Rgb): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

/**
 * Scores one answer against a rendered target: 70% visual + 30% outcome checks.
 * Pass `onMaps` to also get the per-frame mismatch maps the play screen shows.
 */
export async function scoreAnswer(renderer: Renderer, target: Target, rawCode: string, onMaps?: (maps: MismatchMaps) => void): Promise<ScoreResult> {
  const started = performance.now();
  const { code, removed } = sanitizeCode(rawCode);
  const warnings = removed.map((r) => `Removed ${r}. They are not allowed in CSS Dojo.`);
  const answer = await renderer.render(code, spec(target.meta));

  const missing = missingHooks(answer.snapshot);
  if (missing.length > 0) {
    const sel = missing.map((m) => `${m} (${target.meta.hooks[m] ?? "?"})`).join(", ");
    return {
      status: "missing-hook",
      missingHooks: missing,
      message: `Keep the required parts from the starter: ${sel}.`,
      warnings,
      durationMs: Math.round(performance.now() - started),
    };
  }

  const frames: FrameScore[] = [];
  const maps: MismatchMaps = {};
  for (const f of target.meta.frames) {
    const t = target.output.frames[f];
    const a = answer.frames[f];
    if (!t || !a) continue;
    const m = compareFrames(t, a, backgroundColor(t));
    frames.push({ frame: f, score: round1(m.score), shape: m.shape, deltaE: m.deltaE });
    if (onMaps) maps[f] = `data:image/png;base64,${PNG.sync.write(maskToPng(m.mask, t.width, t.height)).toString("base64")}`;
  }
  onMaps?.(maps);

  // A wrong stage colour is easy to miss by eye but costs every frame, so say so.
  // It names what is wrong, never the fix.
  const tRest = target.output.frames.rest;
  const aRest = answer.frames.rest;
  if (tRest && aRest && rgbDistance(backgroundColor(tRest), backgroundColor(aRest)) > BG_HINT_TOLERANCE) {
    warnings.push("The stage background colour doesn't match the target.");
  }
  const visual = frames.length ? frames.reduce((s, f) => s + f.score, 0) / frames.length : 0;
  const checks = runChecks(target.meta.checks, { answer, target: target.output, hooks: target.meta.hooks, states: target.meta.states });
  const passed = checks.filter((c) => c.pass).length;
  return {
    status: "scored",
    score: combineScore(visual, passed, checks.length),
    visual: round1(visual),
    checksPassed: passed,
    checksRun: checks.length,
    frames,
    checks,
    warnings,
    durationMs: Math.round(performance.now() - started),
  };
}
