import { isNotNull } from "drizzle-orm";
import type { Db } from "../db/client";
import { challenges, packs } from "../db/schema";
import { setAdminHidden, setPackDates } from "../packs";

// Pack dates and hidden challenges are read on almost every request, so they live in
// memory (see packs.ts). This copies them from Postgres. The API calls it at start and
// right after each admin change; the timer keeps a separate worker process in step too.

export async function loadOverrides(db: Db): Promise<void> {
  const rows = await db.select({ number: packs.number, opensAt: packs.opensAt, endsAt: packs.endsAt }).from(packs);
  for (const r of rows) setPackDates(r.number, r.opensAt, r.endsAt);
  const hidden = await db.select({ id: challenges.id }).from(challenges).where(isNotNull(challenges.hiddenAt));
  setAdminHidden(hidden.map((h) => h.id));
}

const REFRESH_MS = 60_000;

/** Loads now, then again every minute. A failed refresh keeps the last good copy. */
export async function keepOverridesFresh(db: Db): Promise<void> {
  await loadOverrides(db);
  setInterval(() => {
    loadOverrides(db).catch((err: unknown) => console.error("could not refresh admin overrides", err));
  }, REFRESH_MS).unref();
}
