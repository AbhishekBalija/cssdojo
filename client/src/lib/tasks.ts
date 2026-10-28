import { storage } from "./storage";

// The four "Get started" steps, kept in this browser. Shown in the sidebar and on the play screen.

export const TASKS = [
  ["slide", "Compare with the target", "Hover your output to slide over the target."],
  ["check", "Pass a technique check", "Make the hover or focus behaviour match."],
  ["submit", "Submit your first kata", "Press Submit or Ctrl+Enter."],
  ["signin", "Sign in to save your streak", "Guests can play. Signing in keeps your progress."],
] as const;
export type TaskKey = (typeof TASKS)[number][0];
export type Tasks = Partial<Record<TaskKey, boolean>>;

const listeners = new Set<(t: Tasks) => void>();

export function loadTasks(): Tasks {
  try {
    return JSON.parse(storage.get("dojo-tasks") ?? "{}") as Tasks;
  } catch {
    return {};
  }
}

export function markTask(k: TaskKey): Tasks {
  const cur = loadTasks();
  if (cur[k]) return cur;
  const next = { ...cur, [k]: true };
  storage.set("dojo-tasks", JSON.stringify(next));
  for (const l of listeners) l(next);
  return next;
}

/** Starts the list over, for the next person on this browser after a sign-out. */
export function resetTasks(): void {
  storage.remove("dojo-tasks");
  for (const l of listeners) l({});
}

export function onTasks(l: (t: Tasks) => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
