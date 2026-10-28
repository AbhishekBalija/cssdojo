// Belts are both a challenge's difficulty and a player's earned rank.
export const BELTS = ["white", "yellow", "green", "brown", "black"] as const;
export type Belt = (typeof BELTS)[number];

/** Solves (score 90+) of one belt needed to earn it. */
export const SOLVES_PER_BELT = 5;
/** A Submit at or above this score counts as solved. */
export const SOLVED_AT = 90;

export function beltIndex(belt: Belt): number {
  return BELTS.indexOf(belt);
}
