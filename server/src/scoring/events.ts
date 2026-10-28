import { EventEmitter } from "node:events";
import type { MismatchMaps } from "@cssdojo/scorer";

/** In-process "this submission is scored" events, used by the waiting API request. */
export const scoreEvents = new EventEmitter();
scoreEvents.setMaxListeners(1000);

/**
 * Mismatch maps from recent Submits, kept in memory for a few minutes so the
 * play screen can show them right after scoring. They are never stored: a
 * restart or a second API instance just means the live overlay is shown.
 */
const MAP_TTL_MS = 10 * 60_000;
const MAP_LIMIT = 300;
const recentMaps = new Map<string, { maps: MismatchMaps; at: number }>();

export function rememberMaps(submissionId: string, maps: MismatchMaps): void {
  recentMaps.set(submissionId, { maps, at: Date.now() });
  // Map keeps insertion order, so the first key is the oldest.
  while (recentMaps.size > MAP_LIMIT) {
    const oldest = recentMaps.keys().next().value;
    if (oldest === undefined) break;
    recentMaps.delete(oldest);
  }
}

export function mapsFor(submissionId: string): MismatchMaps | undefined {
  const hit = recentMaps.get(submissionId);
  if (!hit) return undefined;
  if (Date.now() - hit.at > MAP_TTL_MS) {
    recentMaps.delete(submissionId);
    return undefined;
  }
  return hit.maps;
}
