// Daily kata: one per UTC day. Day 1 of the cycle was the launch day; after the
// last kata the cycle loops back to day 1 until more are written.

export const KATA_EPOCH = "2026-10-26";

export function utcDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** 1-based position in the cycle for a UTC date. */
export function kataDayFor(date: string, cycleLength: number): number {
  if (cycleLength <= 0) return 0;
  const n = daysBetween(KATA_EPOCH, date);
  return (((n % cycleLength) + cycleLength) % cycleLength) + 1;
}

/** The next 00:00 UTC after `now`. */
export function nextResetAt(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

/** Consecutive days ending today (or yesterday, so a streak survives until you play today). */
export function streakFrom(dates: string[], today: string): number {
  const set = new Set(dates);
  let day = set.has(today) ? today : utcDate(new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000));
  let n = 0;
  while (set.has(day)) {
    n++;
    day = utcDate(new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000));
  }
  return n;
}
