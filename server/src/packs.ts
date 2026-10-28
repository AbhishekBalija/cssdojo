import { readFileSync } from "node:fs";
import path from "node:path";
import { CHALLENGES_DIR } from "@cssdojo/scorer";
import { PackListSchema, packEndsAt, packState, type PackDef, type PackState } from "@cssdojo/shared";

// Battle Packs are defined in challenges/packs.json, next to the challenge folders,
// so adding a pack is a content change reviewed like any challenge.

export interface Pack extends PackDef {
  opens: Date;
  ends: Date;
}

function load(): Pack[] {
  const file = path.join(CHALLENGES_DIR, "packs.json");
  const defs = PackListSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  const seen = new Set<string>();
  for (const d of defs) {
    for (const id of d.challenges) {
      if (seen.has(id)) throw new Error(`packs.json: ${id} is in more than one pack`);
      seen.add(id);
    }
  }
  return defs.map((d) => ({ ...d, opens: new Date(d.opensAt), ends: packEndsAt(d) })).sort((a, b) => a.number - b.number);
}

const all = load();
const byChallenge = new Map(all.flatMap((p) => p.challenges.map((id) => [id, p] as const)));

// packs.json gives a new pack its first dates. After that the database owns them, so an
// admin can move a date without a deploy. `admin/overrides.ts` copies the stored dates
// and hidden challenges in here at start and after every admin change.
const adminHidden = new Set<string>();

/** Uses the stored dates for a pack. Unknown pack numbers are ignored. */
export function setPackDates(number: number, opens: Date, ends: Date): void {
  const p = all.find((x) => x.number === number);
  if (!p) return;
  p.opens = opens;
  p.ends = ends;
}

/** Replaces the set of challenges an admin has hidden. */
export function setAdminHidden(ids: Iterable<string>): void {
  adminHidden.clear();
  for (const id of ids) adminHidden.add(id);
}

export function isAdminHidden(challengeId: string): boolean {
  return adminHidden.has(challengeId);
}

/** A pack's challenges without the ones an admin has hidden. */
export function visibleChallenges(pack: Pack): string[] {
  return pack.challenges.filter((id) => !adminHidden.has(id));
}

export function listPacks(): Pack[] {
  return all;
}

export function getPack(number: number): Pack | undefined {
  return all.find((p) => p.number === number);
}

export function packOf(challengeId: string): Pack | undefined {
  return byChallenge.get(challengeId);
}

export function stateOf(pack: Pack, now: Date = new Date()): PackState {
  return packState(pack, now);
}

/** Hidden challenges cannot be played: pulled by an admin, or in a pack that has not opened yet. */
export function isHidden(challengeId: string, now: Date = new Date()): boolean {
  if (adminHidden.has(challengeId)) return true;
  const p = packOf(challengeId);
  return !!p && stateOf(p, now) === "upcoming";
}

/** "Battle Pack 03" */
export function packLabel(n: number): string {
  return `Battle Pack ${String(n).padStart(2, "0")}`;
}
