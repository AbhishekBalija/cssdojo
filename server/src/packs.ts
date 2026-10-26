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

/** Challenges in packs that have not opened yet are hidden and cannot be played. */
export function isHidden(challengeId: string, now: Date = new Date()): boolean {
  const p = packOf(challengeId);
  return !!p && stateOf(p, now) === "upcoming";
}

/** "Battle Pack 03" */
export function packLabel(n: number): string {
  return `Battle Pack ${String(n).padStart(2, "0")}`;
}
