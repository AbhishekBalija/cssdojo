// Sliding-window rate limiter kept in memory. One container today; when the API
// runs on several instances, swap in a Redis-backed RateLimiter with the same interface.

export interface RateLimiter {
  /** Records a hit and returns false when the key is over its limit. */
  hit(key: string, limit: number, windowMs: number): boolean;
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, number[]>();

  hit(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 50_000) this.prune(now, windowMs);
    return true;
  }

  private prune(now: number, windowMs: number): void {
    for (const [k, v] of this.hits) if (v.every((t) => now - t >= windowMs)) this.hits.delete(k);
  }
}

export const HOUR = 60 * 60 * 1000;
export const LIMITS = { guest: 30, user: 120, ip: 240 } as const;
