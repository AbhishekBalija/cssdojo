import type { Context } from "hono";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  handle: string | null;
}

/** Replaced by the auth module: returns the signed-in user, if any. */
export type SessionResolver = (c: Context) => Promise<SessionUser | null>;

let resolver: SessionResolver = async () => null;

export function setSessionResolver(r: SessionResolver): void {
  resolver = r;
}

export function getSessionUser(c: Context): Promise<SessionUser | null> {
  return resolver(c);
}
