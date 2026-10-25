import { sql } from "drizzle-orm";
import type { Belt } from "@cssdojo/shared";
import type { Db } from "./db/client";
import { awardBelts } from "./progress";

/**
 * Moves a guest's progress onto a signed-in player, in one transaction.
 * Where both have a row for the same challenge and board, the better best score
 * wins (higher score, then faster solve) and the earlier first open is kept.
 */
export async function mergeGuest(db: Db, guestId: string, userPlayerId: string): Promise<{ moved: number; beltsEarned: Belt[] }> {
  if (guestId === userPlayerId) return { moved: 0, beltsEarned: [] };
  const moved = await db.transaction(async (tx) => {
    const guest = await tx.execute(sql`select id from players where id = ${guestId} and user_id is null for update`);
    if (guest.length === 0) return 0;

    await tx.execute(sql`
      update challenge_opens u set opened_at = least(u.opened_at, g.opened_at)
      from challenge_opens g
      where g.player_id = ${guestId} and u.player_id = ${userPlayerId}
        and u.challenge_id = g.challenge_id and u.board = g.board`);
    await tx.execute(sql`
      delete from challenge_opens g where g.player_id = ${guestId} and exists (
        select 1 from challenge_opens u where u.player_id = ${userPlayerId} and u.challenge_id = g.challenge_id and u.board = g.board)`);
    await tx.execute(sql`update challenge_opens set player_id = ${userPlayerId} where player_id = ${guestId}`);

    const subs = await tx.execute(sql`update submissions set player_id = ${userPlayerId} where player_id = ${guestId} returning id`);

    await tx.execute(sql`
      update best_scores u set score = g.score, submission_id = g.submission_id, solve_ms = g.solve_ms, kata_date = g.kata_date, updated_at = now()
      from best_scores g
      where g.player_id = ${guestId} and u.player_id = ${userPlayerId}
        and u.challenge_id = g.challenge_id and u.board = g.board
        and (g.score > u.score or (g.score = u.score and g.solve_ms < u.solve_ms))`);
    await tx.execute(sql`
      delete from best_scores g where g.player_id = ${guestId} and exists (
        select 1 from best_scores u where u.player_id = ${userPlayerId} and u.challenge_id = g.challenge_id and u.board = g.board)`);
    await tx.execute(sql`update best_scores set player_id = ${userPlayerId} where player_id = ${guestId}`);

    await tx.execute(sql`
      insert into player_belts (player_id, belt, earned_at)
      select ${userPlayerId}, belt, earned_at from player_belts where player_id = ${guestId}
      on conflict do nothing`);
    await tx.execute(sql`delete from players where id = ${guestId}`);
    return subs.length;
  });
  const beltsEarned = await awardBelts(db, userPlayerId);
  return { moved, beltsEarned };
}
