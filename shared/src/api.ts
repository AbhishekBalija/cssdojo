import { z } from "zod";
import { BELTS } from "./belts";
import { MAX_CODE_BYTES } from "./challenge";
import { ScoreResultSchema } from "./score";

// Request and response shapes shared by the API and the client.

export const BoardSchema = z.union([z.literal("library"), z.string().regex(/^kata:\d{4}-\d{2}-\d{2}$/)]);

export const SubmitRequestSchema = z.object({
  challengeId: z.string().min(1).max(80),
  code: z.string().refine((s) => new TextEncoder().encode(s).length <= MAX_CODE_BYTES, `Code must be under ${MAX_CODE_BYTES / 1024} KB`),
  board: BoardSchema.default("library"),
});
export type SubmitRequest = z.infer<typeof SubmitRequestSchema>;

export const OpenRequestSchema = z.object({ board: BoardSchema.default("library") });

export const ChallengeSummarySchema = z.object({
  id: z.string(),
  number: z.number(),
  title: z.string(),
  belt: z.enum(BELTS),
  kind: z.enum(["challenge", "kata"]),
  background: z.string(),
  best: z.number().nullable(),
});
export type ChallengeSummary = z.infer<typeof ChallengeSummarySchema>;

export const SubmissionViewSchema = z.object({
  id: z.string(),
  challengeId: z.string(),
  board: z.string(),
  status: z.enum(["queued", "running", "done", "failed"]),
  result: ScoreResultSchema.nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
  newBest: z.boolean().optional(),
  beltsEarned: z.array(z.enum(BELTS)).optional(),
});
export type SubmissionView = z.infer<typeof SubmissionViewSchema>;

export interface ChallengeProgress {
  best: number | null;
  attempts: number;
  /** The note unlocks after 3 scored Submits. */
  note: string | null;
  solved: boolean;
}

export interface KataToday {
  date: string;
  day: number;
  cycleLength: number;
  challengeId: string;
  resetsAt: string;
}

export interface LeaderboardRow {
  rank: number;
  handle: string;
  image: string | null;
  score: number;
  solveMs: number;
  me: boolean;
}

export interface MeView {
  player: { id: string; guest: boolean };
  user: { id: string; name: string; handle: string | null; image: string | null } | null;
  streak: number;
  belts: (typeof BELTS)[number][];
  solvedPerBelt: Record<(typeof BELTS)[number], number>;
  testLogin: boolean;
  providers: { github: boolean; google: boolean };
}
