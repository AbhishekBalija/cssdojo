export interface ToastAction {
  label: string;
  run: () => void;
}

type Listener = (msg: string | null, action?: ToastAction) => void;
const listeners = new Set<Listener>();

/** Shows a toast. With an action (like Undo) it gets a button and stays a little longer. */
export function toast(msg: string, action?: ToastAction): void {
  for (const l of listeners) l(msg, action);
}

/** Drops every toast, for example when the player moves to another challenge. */
export function clearToasts(): void {
  for (const l of listeners) l(null);
}

export function onToast(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
