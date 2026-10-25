import { storage } from "./storage";

// All API calls go through `api()`. Guests are identified by a random id that the
// server hands out and the browser keeps; it is how guest progress is merged on sign-in.

const GUEST_KEY = "dojo-guest-id";
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function guestId(): string | null {
  return storage.get(GUEST_KEY);
}

export function clearGuestId(): void {
  storage.remove(GUEST_KEY);
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const gid = guestId();
  if (gid) headers.set("x-guest-id", gid);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${API_BASE}/api${path}`, { ...init, headers, body, credentials: "include" });
  const newGuest = res.headers.get("x-guest-id");
  if (newGuest) storage.set(GUEST_KEY, newGuest);
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = typeof data === "object" && data && "error" in data ? String((data as { error: unknown }).error) : res.statusText;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export function staticUrl(path: string): string {
  return `${API_BASE}/static${path}`;
}
