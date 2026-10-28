import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { BELTS } from "@cssdojo/shared";

// Learning note: Drizzle describes tables in TypeScript. The same objects give us
// typed queries and are diffed by drizzle-kit to write SQL migration files.

// ---------- Better Auth tables (names and columns follow its core schema) ----------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  /** Public name on leaderboards, unique, chosen from the OAuth profile. */
  handle: text("handle").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------- CSS Dojo tables ----------

export const beltEnum = pgEnum("belt", BELTS);
export const challengeKindEnum = pgEnum("challenge_kind", ["challenge", "kata"]);
export const jobStatusEnum = pgEnum("job_status", ["queued", "running", "done", "failed"]);

/**
 * A player is whoever plays: a guest (no user yet) or a signed-in user.
 * Guests get a random id kept in their browser. On sign-in the guest's rows are
 * moved to the user's player, which is how guest progress carries over.
 */
export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Mirror of the challenge folders, seeded from disk, so rows can reference them. */
export const challenges = pgTable("challenges", {
  id: text("id").primaryKey(),
  number: integer("number").notNull().unique(),
  title: text("title").notNull(),
  belt: beltEnum("belt").notNull(),
  kind: challengeKindEnum("kind").notNull(),
  /** The Battle Pack this challenge belongs to (from challenges/packs.json). Null for kata. */
  packNumber: integer("pack_number"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Day N of the kata cycle shows this challenge. The cycle repeats after the last day. */
export const kataSchedule = pgTable("kata_schedule", {
  day: integer("day").primaryKey(),
  challengeId: text("challenge_id")
    .notNull()
    .references(() => challenges.id),
});

/**
 * A board is where a score counts: "library" for normal play, or "kata:YYYY-MM-DD"
 * for that day's kata board (closes at 00:00 UTC).
 */
export const challengeOpens = pgTable(
  "challenge_opens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    challengeId: text("challenge_id")
      .notNull()
      .references(() => challenges.id),
    board: text("board").notNull(),
    openedAt: timestamp("opened_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("challenge_opens_unique").on(t.playerId, t.challengeId, t.board)],
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    challengeId: text("challenge_id")
      .notNull()
      .references(() => challenges.id),
    board: text("board").notNull(),
    code: text("code").notNull(),
    status: jobStatusEnum("status").notNull().default("queued"),
    score: real("score"),
    visual: real("visual"),
    checksPassed: integer("checks_passed"),
    checksRun: integer("checks_run"),
    /** Full scorer result: per-frame scores, check results with hints. */
    result: jsonb("result"),
    error: text("error"),
    /** Points, Wall moves and badges this Submit caused, for the result screen. */
    ranking: jsonb("ranking"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    finishedAt: timestamp("finished_at"),
  },
  (t) => [index("submissions_player_challenge").on(t.playerId, t.challengeId, t.createdAt)],
);

/**
 * Postgres job queue for the scorer. Workers claim rows with
 * SELECT ... FOR UPDATE SKIP LOCKED, so two workers never take the same job.
 */
export const scoreJobs = pgTable(
  "score_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .unique()
      .references(() => submissions.id, { onDelete: "cascade" }),
    status: jobStatusEnum("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    lockedAt: timestamp("locked_at"),
    error: text("error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("score_jobs_queued").on(t.status, t.createdAt).where(sql`${t.status} = 'queued'`)],
);

/** Best score per player, challenge and board. A lower later Submit never replaces it. */
export const bestScores = pgTable(
  "best_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    challengeId: text("challenge_id")
      .notNull()
      .references(() => challenges.id),
    board: text("board").notNull(),
    score: real("score").notNull(),
    /** Points this best gives (library board only, 0 elsewhere). */
    points: integer("points").notNull().default(0),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    /** First open to the Submit that set this best, in milliseconds. */
    solveMs: integer("solve_ms").notNull(),
    kataDate: date("kata_date"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("best_scores_unique").on(t.playerId, t.challengeId, t.board),
    index("best_scores_board").on(t.challengeId, t.board, t.score),
  ],
);

/** Belts a player has earned, recorded when the fifth solve of a belt lands. */
export const playerBelts = pgTable(
  "player_belts",
  {
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    belt: beltEnum("belt").notNull(),
    earnedAt: timestamp("earned_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("player_belts_unique").on(t.playerId, t.belt)],
);

// ---------- Ranking: Battle Packs, locks, streaks, badges, notifications, events ----------

/** Mirror of challenges/packs.json, plus flags for the one-off jobs a pack triggers. */
export const packs = pgTable("packs", {
  number: integer("number").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  belt: beltEnum("belt").notNull(),
  opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  /** Set once followers were told it opens within 2 days. */
  soonSentAt: timestamp("soon_sent_at", { withTimezone: true }),
  /** Set once the "pack opened" event and notifications went out. */
  openedSentAt: timestamp("opened_sent_at", { withTimezone: true }),
  /** Set once the final standings were frozen into pack_results. */
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
});

/** Players who asked to be told when a pack opens. */
export const packFollows = pgTable(
  "pack_follows",
  {
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    packNumber: integer("pack_number")
      .notNull()
      .references(() => packs.number, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("pack_follows_unique").on(t.playerId, t.packNumber)],
);

/** Final standings of a finished pack, frozen when it ends. */
export const packResults = pgTable(
  "pack_results",
  {
    packNumber: integer("pack_number")
      .notNull()
      .references(() => packs.number, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    points: integer("points").notNull(),
    solved: integer("solved").notNull(),
  },
  (t) => [uniqueIndex("pack_results_unique").on(t.packNumber, t.playerId)],
);

/** Opening solutions freezes your points on that challenge at the best you had then. */
export const answerLocks = pgTable(
  "answer_locks",
  {
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    challengeId: text("challenge_id")
      .notNull()
      .references(() => challenges.id),
    lockedAt: timestamp("locked_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("answer_locks_unique").on(t.playerId, t.challengeId)],
);

/** One row per UTC day a player submitted that day's kata with changed starter code. */
export const kataDays = pgTable(
  "kata_days",
  {
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
  },
  (t) => [uniqueIndex("kata_days_unique").on(t.playerId, t.date)],
);

export const playerBadges = pgTable(
  "player_badges",
  {
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    badgeId: text("badge_id").notNull(),
    earnedAt: timestamp("earned_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("player_badges_unique").on(t.playerId, t.badgeId)],
);

export const notificationKindEnum = pgEnum("notification_kind", ["passed", "badge", "belt", "pack-open", "pack-soon"]);

/** The bell: personal notifications. `board` lets "passed you" be throttled per board. */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    kind: notificationKindEnum("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href"),
    board: text("board"),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_player").on(t.playerId, t.createdAt)],
);

export const eventKindEnum = pgEnum("event_kind", ["moved", "number-one", "pack-top3", "belt", "pack-open"]);

/** Public events: the header LIVE line and "Recent moves" on each board. */
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: eventKindEnum("kind").notNull(),
    playerId: uuid("player_id").references(() => players.id, { onDelete: "cascade" }),
    /** "wall", "pack:3" or "challenge:<id>". */
    board: text("board").notNull(),
    text: text("text").notNull(),
    delta: integer("delta"),
    rank: integer("rank"),
    href: text("href"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("events_board").on(t.board, t.createdAt), index("events_created").on(t.createdAt)],
);

/** Per-player notification choices. A missing row means all on. */
export const playerSettings = pgTable("player_settings", {
  playerId: uuid("player_id")
    .primaryKey()
    .references(() => players.id, { onDelete: "cascade" }),
  notifyPassed: boolean("notify_passed").notNull().default(true),
  notifyPackOpen: boolean("notify_pack_open").notNull().default(true),
  notifyBadge: boolean("notify_badge").notNull().default(true),
  showLive: boolean("show_live").notNull().default(true),
  handleChangedAt: timestamp("handle_changed_at"),
});
