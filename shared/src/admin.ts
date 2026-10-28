import { z } from "zod";
import type { Belt } from "./belts";
import type { PackState } from "./ranking";

// Admin panel requests and responses (docs/requirements/admin.md).
// Every write needs a short reason, which goes into the audit log.

export const AdminReasonSchema = z.string().trim().min(3, "Add a short reason").max(300);

export const PackDatesSchema = z
  .object({ opensAt: z.iso.datetime(), endsAt: z.iso.datetime(), reason: AdminReasonSchema })
  .refine((v) => Date.parse(v.endsAt) > Date.parse(v.opensAt), { message: "The end must be after the open date", path: ["endsAt"] });
export type PackDatesRequest = z.infer<typeof PackDatesSchema>;

/** Hide or unhide a challenge or a player. */
export const AdminHideSchema = z.object({ hidden: z.boolean(), reason: AdminReasonSchema });
export type AdminHideRequest = z.infer<typeof AdminHideSchema>;

/** Reset a handle, or void a submission: only the reason is needed. */
export const AdminReasonOnlySchema = z.object({ reason: AdminReasonSchema });
export type AdminReasonOnlyRequest = z.infer<typeof AdminReasonOnlySchema>;

export const AdminPlayerSearchSchema = z.object({ q: z.string().trim().min(2).max(80) });

export interface AdminPackRow {
  number: number;
  title: string;
  belt: Belt;
  state: PackState;
  opensAt: string;
  endsAt: string;
  players: number;
}

export interface AdminChallengeRow {
  id: string;
  number: number;
  title: string;
  belt: Belt;
  kind: "challenge" | "kata";
  packNumber: number | null;
  hidden: boolean;
  /** Golden answers that prove it scores as intended (the golden set needs at least 3). */
  goldenAnswers: number;
  players: number;
  /** Share of players with a library best of 90 or more, 0 to 1. */
  passRate: number;
  avgBest: number | null;
}

export interface AdminPlayerRow {
  playerId: string;
  handle: string | null;
  name: string | null;
  email: string | null;
  points: number;
  solved: number;
  hidden: boolean;
  createdAt: string;
}

export interface AdminSubmissionRow {
  id: string;
  challengeId: string;
  board: string;
  score: number | null;
  status: "queued" | "running" | "done" | "failed";
  voided: boolean;
  code: string;
  createdAt: string;
}

export interface AdminPlayerDetail extends AdminPlayerRow {
  belts: Belt[];
  wallRank: number | null;
  submissions: AdminSubmissionRow[];
}

export interface AdminStats {
  today: { signups: number; activePlayers: number; submits: number; solves: number };
  /** Last 30 UTC days, oldest first. */
  days: { date: string; signups: number; activePlayers: number; submits: number }[];
  scorer: { queued: number; oldestQueuedSec: number | null; failedLastDay: number; avgScoreSec: number | null };
}

export interface AdminActionRow {
  id: string;
  admin: string;
  action: string;
  target: string;
  before: unknown;
  after: unknown;
  reason: string;
  at: string;
}

/** Whether the signed-in user may open the admin panel. */
export interface AdminMe {
  admin: boolean;
}
