import { z } from "zod";
import { CHECK_IDS, FRAMES } from "./challenge";

export const VISUAL_WEIGHT = 0.7;
export const CHECKS_WEIGHT = 0.3;

export const FrameScoreSchema = z.object({
  frame: z.enum(FRAMES),
  /** 0 to 100 for this frame. */
  score: z.number(),
  /** Shape accuracy: share of region pixels that match (0 to 1). */
  shape: z.number(),
  /** Mean colour error over the region (CIE76, capped at 20 per pixel). */
  deltaE: z.number(),
});
export type FrameScore = z.infer<typeof FrameScoreSchema>;

export const CheckResultSchema = z.object({
  id: z.enum(CHECK_IDS),
  label: z.string(),
  pass: z.boolean(),
  /** What is wrong, never how to fix it. Only set when pass is false. */
  hint: z.string().optional(),
});
export type CheckResult = z.infer<typeof CheckResultSchema>;

export const ScoreResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("scored"),
    score: z.number(),
    visual: z.number(),
    checksPassed: z.number().int(),
    checksRun: z.number().int(),
    frames: z.array(FrameScoreSchema),
    checks: z.array(CheckResultSchema),
    warnings: z.array(z.string()),
    durationMs: z.number(),
  }),
  z.object({
    status: z.literal("missing-hook"),
    missingHooks: z.array(z.string()),
    message: z.string(),
    warnings: z.array(z.string()),
    durationMs: z.number(),
  }),
]);
export type ScoreResult = z.infer<typeof ScoreResultSchema>;

/** Rounds to one decimal, the way scores are shown. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Total = 70% visual + 30% outcome checks. */
export function combineScore(visual: number, checksPassed: number, checksRun: number): number {
  const checks = checksRun === 0 ? 100 : (100 * checksPassed) / checksRun;
  return round1(VISUAL_WEIGHT * visual + CHECKS_WEIGHT * checks);
}
