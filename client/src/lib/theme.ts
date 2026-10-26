import { storage } from "./storage";

export type Theme = "dark" | "light";

export function currentTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function applyTheme(t: Theme): void {
  document.documentElement.setAttribute("data-theme", t);
  storage.set("dojo-theme-choice", t);
}

/** A saved choice wins; otherwise follow the system setting (without saving it). */
export function initTheme(): void {
  // New key: the old "dojo-theme" was saved on every visit, so it is not a real choice.
  const saved = storage.get("dojo-theme-choice");
  const system: Theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", saved === "light" || saved === "dark" ? saved : system);
}
