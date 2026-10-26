import type { Db } from "../db/client";
import { addEvent, notify, ordinal } from "./notify";
import { rankOf, type Standing } from "./standings";

// After a new best, compare a board before and after it to find who moved and who
// got passed. Passed players get a bell item (throttled per board); big moments
// become public events for the LIVE line and Recent moves.

export interface BoardRef {
  /** Event and throttle key: "wall", "pack:3" or "challenge:<id>". */
  key: string;
  /** Shown in text: "the Wall", "Battle Pack 03", "Stat card". */
  name: string;
  href: string;
  /** Pack boards only: whether the pack is live, so top-3 entries are news. */
  live?: boolean;
}

export interface BoardMove {
  rankBefore: number | null;
  rankAfter: number | null;
  /** Player ids that were above you and are now below you. */
  passed: string[];
}

/** Pure part: ranks before and after, and who was passed. */
export function diffBoard(before: Standing[], after: Standing[], playerId: string): BoardMove {
  const rankBefore = rankOf(before, playerId);
  const rankAfter = rankOf(after, playerId);
  if (rankAfter === null) return { rankBefore, rankAfter, passed: [] };
  const oldLine = rankBefore ?? before.length + 1;
  const passed = before
    .filter((s, i) => s.playerId !== playerId && i + 1 < oldLine && (rankOf(after, s.playerId) ?? 0) > rankAfter)
    .map((s) => s.playerId);
  return { rankBefore, rankAfter, passed };
}

/** Sends the bell items and public events for one board move. */
export async function announceMove(db: Db, board: BoardRef, playerId: string, handle: string, move: BoardMove, after: Standing[]): Promise<void> {
  const { rankBefore, rankAfter } = move;
  if (rankAfter === null) return;
  for (const other of move.passed) {
    const theirs = rankOf(after, other);
    await notify(db, {
      playerId: other,
      kind: "passed",
      title: `${handle} passed you on ${board.name}`,
      body: theirs ? `You are now ${ordinal(theirs)}.` : "Play again to win your place back.",
      href: board.href,
      board: board.key,
    });
  }
  const up = rankBefore === null ? null : rankBefore - rankAfter;
  if (rankAfter === 1 && rankBefore !== 1 && !board.key.startsWith("challenge:")) {
    await addEvent(db, { kind: "number-one", playerId, board: board.key, text: `took 1st on ${board.name}`, delta: up, rank: 1, href: board.href });
  } else if (board.live && rankAfter <= 3 && (rankBefore === null || rankBefore > 3)) {
    await addEvent(db, { kind: "pack-top3", playerId, board: board.key, text: `moved into the top 3 on ${board.name}`, delta: up, rank: rankAfter, href: board.href });
  }
  if (up !== null && up > 0) {
    await addEvent(db, { kind: "moved", playerId, board: board.key, text: `moved up ${up} to ${ordinal(rankAfter)}`, delta: up, rank: rankAfter, href: board.href });
  }
}
