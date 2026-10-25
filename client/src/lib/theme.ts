import { storage } from "./storage";

export type Theme = "dark" | "light";

export function currentTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function applyTheme(t: Theme): void {
  document.documentElement.setAttribute("data-theme", t);
  storage.set("dojo-theme", t);
}

export function initTheme(): void {
  applyTheme(storage.get("dojo-theme") === "light" ? "light" : "dark");
}
