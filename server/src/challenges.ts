import { loadAllChallenges, Renderer, renderTarget, type Challenge, type Target } from "@cssdojo/scorer";
import type { PublicChallenge } from "@cssdojo/shared";

// Challenges live as folders on disk and are loaded once at start.

let all: Challenge[] = [];
const byId = new Map<string, Challenge>();

export async function loadChallenges(): Promise<void> {
  all = await loadAllChallenges();
  byId.clear();
  for (const c of all) byId.set(c.meta.id, c);
}

export function listChallenges(): Challenge[] {
  return all;
}

export function getChallenge(id: string): Challenge | undefined {
  return byId.get(id);
}

export function toPublic(c: Challenge): PublicChallenge {
  const m = c.meta;
  return {
    id: m.id,
    number: m.number,
    title: m.title,
    belt: m.belt,
    kind: m.kind,
    brief: m.brief,
    frames: m.frames,
    hooks: m.hooks,
    states: m.states,
    checks: m.checks,
    colors: m.colors,
    fonts: m.allow.fonts,
    starter: c.starter,
    inspiration: m.inspiration,
  };
}

/** One shared browser for the whole process (512 MB host). */
export const renderer = new Renderer();

const targets = new Map<string, Promise<Target>>();

/** The rendered reference for a challenge, computed once and cached. */
export function targetFor(c: Challenge): Promise<Target> {
  let t = targets.get(c.meta.id);
  if (!t) {
    t = renderTarget(renderer, c.meta, c.reference);
    targets.set(c.meta.id, t);
    t.catch(() => targets.delete(c.meta.id));
  }
  return t;
}
