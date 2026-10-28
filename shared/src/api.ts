import { z } from "zod";
import { BELTS, type Belt } from "./belts";
import { FRAMES, MAX_CODE_BYTES } from "./challenge";
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
  /** Points, Wall moves, pack progress, badges and streak from this Submit. */
  ranking: z.custom<SubmitRanking>().optional(),
  /**
   * What the scorer counted as wrong, per frame: a 400x300 PNG data URL, red
   * where the shape differs and amber where only the colour does. Only sent
   * for a few minutes after scoring; it is not stored.
   */
  maps: z.partialRecord(z.enum(FRAMES), z.string()).optional(),
});
export type SubmissionView = z.infer<typeof SubmissionViewSchema>;

export interface ChallengeProgress {
  best: number | null;
  attempts: number;
  /** The note unlocks after 3 scored Submits. */
  note: string | null;
  solved: boolean;
  /** Points your best gives on this challenge (library board). */
  points: number;
  maxPoints: number;
  /** True once you opened solutions: later Submits no longer change your points. */
  locked: boolean;
}

/** The streak tag in the header. `week` runs Monday to Sunday (UTC). */
export interface StreakDetail {
  current: number;
  best: number;
  playedToday: boolean;
  week: ("done" | "today" | "missed" | "future")[];
}

/** GET /kata/days?month=YYYY-MM: the kata calendar. */
export interface KataMonth {
  month: string;
  days: { date: string; challengeId: string; number: number; title: string; myScore: number | null; attempted: boolean }[];
  /** When yesterday's board closed and tomorrow's kata opens. */
  yesterdayClosedAt: string;
  tomorrowOpensAt: string;
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
  /** All-time points, place on the Wall and unread bell items. Zero/null for guests who have not played. */
  points: number;
  wallRank: number | null;
  /** Signed-in players on the Wall, for "12 / 214". */
  wallPlayers: number;
  unread: number;
  streakDetail: StreakDetail;
  testLogin: boolean;
  providers: { github: boolean; google: boolean };
}

/** One row of the gallery review page: everything needed to review a challenge at a glance. */
export interface GalleryItem {
  id: string;
  number: number;
  title: string;
  belt: Belt;
  kind: "challenge" | "kata";
  kataDay: number | null;
  brief: string;
  background: string;
  frames: string[];
  checks: string[];
  golden: { name: string; min: number; max: number; reason: string }[];
  inspiration: { source: string; url: string; note: string }[];
}

/** Overall ranking: belts first, then challenges solved, then total best score. */
export interface RankingRow {
  rank: number;
  handle: string;
  image: string | null;
  topBelt: Belt | null;
  solved: number;
  total: number;
  me: boolean;
}

export interface ProfileView {
  handle: string;
  name: string;
  image: string | null;
  joined: string;
  streak: number;
  belts: Belt[];
  solvedPerBelt: Record<Belt, number>;
  bests: { challengeId: string; number: number; title: string; belt: Belt; board: string; score: number; solveMs: number; updatedAt: string }[];
  /** All-time points and place on the Wall. */
  points: number;
  wallRank: number | null;
  solved: number;
  longestStreak: number;
  badges: BadgeView[];
  /** Your kata score per day, last 12 days, null when not played. */
  kata: { date: string; score: number | null }[];
  /** Share of your scored Submits that passed each check (0 to 1). */
  checks: { id: string; label: string; passRate: number }[];
  /** Battle Packs played (opened ones only), newest first, with your place on each. */
  packs: { number: number; title: string; rank: number; players: number; live: boolean }[];
}

// ---------- Ranking: points, Battle Packs, the Wall, badges, notifications, live moves ----------
// Times are ISO strings so the client can tick countdowns itself.

/** A player as shown on any board. */
export interface PlayerTag {
  handle: string;
  image: string | null;
  /** Highest belt earned, for the belt-tinted banner. */
  belt: Belt | null;
}

/** GET /packs: every Battle Pack, newest first. */
export interface PackSummary {
  number: number;
  title: string;
  description: string;
  /** Null while upcoming: the belt is revealed when the pack opens. */
  belt: Belt | null;
  state: "upcoming" | "live" | "finished";
  opensAt: string;
  endsAt: string;
  /** Empty while upcoming. */
  challenges: PackChallengeTile[];
  /** How many players have a scored Submit on this pack. */
  players: number;
  /** The signed-in player's standing. Null for guests who have not played it. */
  me: { solved: number; tried: number; points: number; rank: number | null; notify: boolean } | null;
}

export interface PackChallengeTile {
  id: string;
  number: number;
  title: string;
  background: string;
  /** Your best score, null when not played. */
  best: number | null;
  points: number;
  /** True once you opened solutions: your points here are frozen. */
  locked: boolean;
  /** Best score on the board and who holds it. */
  top: { handle: string; score: number } | null;
}

/** GET /packs/:number: one pack plus its board (top 50) and recent moves. */
export interface PackDetail extends PackSummary {
  board: PackBoardRow[];
  moves: EventView[];
}

export interface PackBoardRow {
  rank: number;
  player: PlayerTag;
  solved: number;
  points: number;
  /** Rank change in the last 24 hours (positive = moved up). */
  moved: number;
  me: boolean;
}

/** GET /boards/wall: the all-time ranking by points. */
export interface WallView {
  players: number;
  rows: WallRow[];
  /** Your row, even when you are not on this page. */
  me: WallRow | null;
  /** The player just above you, and the points you need to pass them. */
  next: { row: WallRow; gap: number } | null;
  /** Players holding each belt as their highest. */
  belts: Record<Belt, number>;
  moves: EventView[];
}

export interface WallRow {
  rank: number;
  player: PlayerTag;
  points: number;
  solved: number;
  moved: number;
  me: boolean;
}

/** GET /boards/challenge/:id (library board): best score, ties to whoever got there first. */
export interface ChallengeBoardRow {
  rank: number;
  player: PlayerTag;
  score: number;
  points: number;
  /** Characters in the best Submit. Shown only, never ranked. */
  chars: number;
  moved: number;
  me: boolean;
}

/** GET /boards/streaks: days in a row with a kata Submit that changed the starter. */
export interface StreakRow {
  rank: number;
  player: PlayerTag;
  current: number;
  longest: number;
  me: boolean;
}

/** Badges a player holds, plus progress toward counted ones. */
export interface BadgeView {
  id: string;
  earnedAt: string | null;
  /** For counted badges, how far along you are (e.g. 5 of 7). */
  progress: number | null;
}

export interface NotificationView {
  id: string;
  kind: "passed" | "badge" | "belt" | "pack-open" | "pack-soon";
  title: string;
  body: string;
  /** Where clicking it goes, a client route like "/c/b-016-stat-card". */
  href: string | null;
  createdAt: string;
  read: boolean;
}

/** GET /notifications */
export interface NotificationsView {
  unread: number;
  items: NotificationView[];
}

/** One public event, for the header LIVE line and "Recent moves". */
export interface EventView {
  id: string;
  kind: "moved" | "number-one" | "pack-top3" | "belt" | "pack-open";
  player: PlayerTag | null;
  /** Plain sentence, e.g. "moved into the top 3 on Battle Pack 05". */
  text: string;
  /** For "moved": places gained and the new rank. */
  delta: number | null;
  rank: number | null;
  href: string | null;
  at: string;
}

/** Extra facts the result screen shows after a Submit (on SubmissionView as `ranking`). */
export interface SubmitRanking {
  /** Points this challenge now gives you, and the max for its belt. */
  points: number;
  maxPoints: number;
  /** Points gained by this Submit (0 when not a new best or locked). */
  gained: number;
  locked: boolean;
  /** Null on kata boards, which give no points. `passed` holds the handles you passed. */
  wall: { before: number; after: number; rankBefore: number | null; rankAfter: number | null; passed: string[] } | null;
  pack: { number: number; title: string; solved: number } | null;
  badgesEarned: string[];
  /** True when this Submit kept or started today's streak. */
  streakCounted: boolean;
}

/**
 * GET /challenges/:id/solutions: `top` stays empty until you open them.
 * POST /challenges/:id/solutions/open locks your points on that challenge and returns the top five answers.
 */
export interface SolutionsView {
  locked: boolean;
  /** Your best when you opened solutions, and the points frozen with it. */
  frozen: { score: number; points: number } | null;
  /** Our reference answer, null until you open solutions. */
  reference: string | null;
  top: { rank: number; player: PlayerTag; score: number; chars: number; code: string }[];
}

export interface SettingsView {
  /** How you signed in, and the email of that account, for "Signed in with". */
  provider: "github" | "google" | null;
  providerAccount: string | null;
  handle: string | null;
  /** When the handle can next be changed (once every 30 days). */
  handleChangeableAt: string | null;
  notify: { passed: boolean; packOpen: boolean; badge: boolean; live: boolean };
}

/** Lowercase letters, digits and single dashes, 2 to 20 long, like handles made at sign-up. */
export const HandleSchema = z
  .string()
  .min(2)
  .max(20)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, digits and dashes");

/** A handle can be changed once every 30 days. */
export const HANDLE_CHANGE_DAYS = 30;

export const SettingsPatchSchema = z.object({
  handle: HandleSchema.optional(),
  notify: z.object({ passed: z.boolean(), packOpen: z.boolean(), badge: z.boolean(), live: z.boolean() }).partial().optional(),
});
export type SettingsPatch = z.infer<typeof SettingsPatchSchema>;

export const PackNotifySchema = z.object({ on: z.boolean() });

/** No ids marks every notification read. */
export const ReadNotificationsSchema = z.object({ ids: z.array(z.string().uuid()).max(100).optional() });
