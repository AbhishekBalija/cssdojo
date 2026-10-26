import { and, eq, gte } from "drizzle-orm";
import { PASSED_THROTTLE_MS, type EventKind, type NotificationKind } from "@cssdojo/shared";
import type { Db } from "../db/client";
import { events, notifications, playerSettings } from "../db/schema";

// Notifications go to one player's bell; events are public (LIVE line, Recent moves).

const SETTING_FOR: Record<NotificationKind, "notifyPassed" | "notifyPackOpen" | "notifyBadge" | null> = {
  passed: "notifyPassed",
  "pack-open": "notifyPackOpen",
  "pack-soon": "notifyPackOpen",
  badge: "notifyBadge",
  belt: "notifyBadge",
};

async function wants(db: Db, playerId: string, kind: NotificationKind): Promise<boolean> {
  const key = SETTING_FOR[kind];
  if (!key) return true;
  const [row] = await db.select().from(playerSettings).where(eq(playerSettings.playerId, playerId));
  return row ? row[key] : true;
}

export interface NewNotification {
  playerId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string | null;
  /** Board key, used to throttle "passed" to one per board per hour. */
  board?: string | null;
}

/** Saves a notification unless the player turned that kind off or it is throttled. Returns true when saved. */
export async function notify(db: Db, n: NewNotification): Promise<boolean> {
  if (!(await wants(db, n.playerId, n.kind))) return false;
  if (n.kind === "passed" && n.board) {
    const since = new Date(Date.now() - PASSED_THROTTLE_MS);
    const [recent] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.playerId, n.playerId), eq(notifications.kind, "passed"), eq(notifications.board, n.board), gte(notifications.createdAt, since)))
      .limit(1);
    if (recent) return false;
  }
  await db.insert(notifications).values({ playerId: n.playerId, kind: n.kind, title: n.title, body: n.body, href: n.href ?? null, board: n.board ?? null });
  return true;
}

export interface NewEvent {
  kind: EventKind;
  playerId: string | null;
  board: string;
  text: string;
  delta?: number | null;
  rank?: number | null;
  href?: string | null;
}

export async function addEvent(db: Db, e: NewEvent): Promise<void> {
  await db.insert(events).values({ kind: e.kind, playerId: e.playerId, board: e.board, text: e.text, delta: e.delta ?? null, rank: e.rank ?? null, href: e.href ?? null });
}

/** "1st", "2nd", "3rd", "4th" ... */
export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
}
