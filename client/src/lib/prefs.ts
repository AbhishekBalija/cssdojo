import { storage } from "./storage";

// Display choices kept in this browser only. Each one is a data attribute on
// <html> so CSS can follow it without a re-render.

export type Pref = "motion" | "ligatures" | "sound";

const KEYS: Record<Pref, string> = { motion: "dojo-reduce-motion", ligatures: "dojo-ligatures", sound: "dojo-sound" };
const ATTRS: Record<Pref, string> = { motion: "data-reduce-motion", ligatures: "data-ligatures", sound: "data-sound" };

export function getPref(p: Pref): boolean {
  return storage.get(KEYS[p]) === "on";
}

export function setPref(p: Pref, on: boolean): void {
  storage.set(KEYS[p], on ? "on" : "off");
  document.documentElement.toggleAttribute(ATTRS[p], on);
}

/** True when the player or the system asked for less motion. */
export function reducedMotion(): boolean {
  return getPref("motion") || matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function initPrefs(): void {
  for (const p of Object.keys(KEYS) as Pref[]) document.documentElement.toggleAttribute(ATTRS[p], getPref(p));
}
