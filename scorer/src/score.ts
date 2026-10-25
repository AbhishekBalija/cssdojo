import { combineScore, round1, sanitizeCode, type ChallengeMeta, type FrameScore, type ScoreResult } from "@cssdojo/shared";
import { missingHooks, runChecks } from "./checks";
import { backgroundColor, compareFrames } from "./metric";
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

/** Scores one answer against a rendered target: 70% visual + 30% outcome checks. */
export async function scoreAnswer(renderer: Renderer, target: Target, rawCode: string): Promise<ScoreResult> {
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
  for (const f of target.meta.frames) {
    const t = target.output.frames[f];
    const a = answer.frames[f];
    if (!t || !a) continue;
    const m = compareFrames(t, a, backgroundColor(t));
    frames.push({ frame: f, score: round1(m.score), shape: m.shape, deltaE: m.deltaE });
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
