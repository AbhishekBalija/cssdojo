import { z } from "zod";
import { BELTS, type Belt } from "./belts";

// Ranking rules, approved 2026-10-26 (docs/requirements/ranking.md):
// - Points per challenge grow with belt and climb steeply near a perfect score.
// - All-time points = sum of your best points over every Battle Pack challenge.
// - Opening the solutions locks your points on that challenge.
// - Ties go to whoever reached the score first.

/** Most points one challenge can give, by belt. */
export const MAX_POINTS: Record<Belt, number> = { white: 200, yellow: 400, green: 600, brown: 800, black: 1000 };

/** Scores at or below this give no points. */
export const POINTS_FLOOR = 50;

/**
 * Points for a score on a challenge of this belt: max * ((score - 50) / 50)^2.
 * 100 gives the full max, 90 gives 64% of it, 50 or less gives nothing.
 */
export function pointsFor(score: number, belt: Belt): number {
  const t = Math.min(1, Math.max(0, (score - POINTS_FLOOR) / (100 - POINTS_FLOOR)));
  return Math.round(MAX_POINTS[belt] * t * t);
}

// ---------- Battle Packs ----------

/** A pack is live for this long after it opens, unless its own `endsAt` says otherwise. */
export const PACK_LIVE_DAYS = 28;

export const PackDefSchema = z.object({
  /** Pack number, shown as "Battle Pack 03". */
  number: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().min(1),
  belt: z.enum(BELTS),
  /** Exactly 6 challenge ids, in play order. */
  challenges: z.array(z.string()).length(6),
  /** ISO timestamp. Before it the pack is upcoming and its challenges are hidden. */
  opensAt: z.string().datetime(),
  /** ISO timestamp. Defaults to opensAt + PACK_LIVE_DAYS. */
  endsAt: z.string().datetime().optional(),
});
export type PackDef = z.infer<typeof PackDefSchema>;
export const PackListSchema = z.array(PackDefSchema);

export type PackState = "upcoming" | "live" | "finished";

export function packEndsAt(def: PackDef): Date {
  return def.endsAt ? new Date(def.endsAt) : new Date(Date.parse(def.opensAt) + PACK_LIVE_DAYS * 86_400_000);
}

export function packState(def: PackDef, now: Date = new Date()): PackState {
  if (now.getTime() < Date.parse(def.opensAt)) return "upcoming";
  return now.getTime() < packEndsAt(def).getTime() ? "live" : "finished";
}

// ---------- Badges ----------

export const BADGE_GROUPS = ["belts", "packs", "challenges", "streaks", "practice", "dojo"] as const;
export type BadgeGroup = (typeof BADGE_GROUPS)[number];

export interface BadgeDef {
  id: string;
  group: BadgeGroup;
  name: string;
  /** One line on how it is earned. */
  description: string;
  /** For counted badges: the target, so the profile can show "5 of 7". */
  goal?: number;
  /** False for badges shown but not yet earnable (Sparring). */
  enabled: boolean;
}

/** The 18 badges on the profile, in display order. */
export const BADGES: readonly BadgeDef[] = [
  { id: "belt-white", group: "belts", name: "White belt", description: "Solve 5 white challenges", goal: 5, enabled: true },
  { id: "belt-yellow", group: "belts", name: "Yellow belt", description: "Solve 5 yellow challenges, after white", goal: 5, enabled: true },
  { id: "belt-green", group: "belts", name: "Green belt", description: "Solve 5 green challenges, after yellow", goal: 5, enabled: true },
  { id: "belt-brown", group: "belts", name: "Brown belt", description: "Solve 5 brown challenges, after green", goal: 5, enabled: true },
  { id: "belt-black", group: "belts", name: "Black belt", description: "Solve 5 black challenges, after brown", goal: 5, enabled: true },
  { id: "pack-cleared", group: "packs", name: "Pack cleared", description: "Solve all 6 challenges in a Battle Pack", goal: 6, enabled: true },
  { id: "two-packs", group: "packs", name: "Two packs", description: "Clear two Battle Packs", goal: 2, enabled: true },
  { id: "live-finisher", group: "packs", name: "Live finisher", description: "Clear a Battle Pack while it is live", enabled: true },
  { id: "perfect-100", group: "challenges", name: "Perfect 100", description: "Score 100 on a challenge", enabled: true },
  { id: "ten-solves", group: "challenges", name: "Ten solves", description: "Solve 10 challenges", goal: 10, enabled: true },
  { id: "thirty-solves", group: "challenges", name: "Thirty solves", description: "Solve 30 challenges", goal: 30, enabled: true },
  { id: "streak-3", group: "streaks", name: "3 days", description: "Submit the daily kata 3 days in a row", goal: 3, enabled: true },
  { id: "streak-7", group: "streaks", name: "7 days", description: "Submit the daily kata 7 days in a row", goal: 7, enabled: true },
  { id: "streak-30", group: "streaks", name: "30 days", description: "Submit the daily kata 30 days in a row", goal: 30, enabled: true },
  { id: "sharp-eye", group: "practice", name: "Sharp eye", description: "Solve a challenge on your first Submit", enabled: true },
  { id: "no-peeking", group: "practice", name: "No peeking", description: "Solve 10 challenges without opening solutions", goal: 10, enabled: true },
  { id: "on-the-mat", group: "dojo", name: "On the mat", description: "Sign in for the first time", enabled: true },
  { id: "sparring", group: "dojo", name: "Sparring", description: "Win a sparring match (coming soon)", enabled: false },
] as const;

export type BadgeId = (typeof BADGES)[number]["id"];

export function badgeById(id: string): BadgeDef | undefined {
  return BADGES.find((b) => b.id === id);
}

export function beltBadgeId(belt: Belt): string {
  return `belt-${belt}`;
}

// ---------- Notifications and events ----------

/** Personal notifications, shown in the bell. */
export const NOTIFICATION_KINDS = ["passed", "badge", "belt", "pack-open", "pack-soon"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Public events, shown in the header LIVE line and in "Recent moves". */
export const EVENT_KINDS = ["moved", "number-one", "pack-top3", "belt", "pack-open"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Event kinds big enough for the header LIVE line. "moved" only shows in Recent moves. */
export const ANNOUNCER_KINDS: readonly EventKind[] = ["number-one", "pack-top3", "belt", "pack-open"];

/** A board a rank lives on: the Wall, one pack, or one challenge. */
export type RankBoard = "wall" | `pack:${number}` | `challenge:${string}`;

/** At most one "passed you" notification per board per hour. */
export const PASSED_THROTTLE_MS = 60 * 60 * 1000;
