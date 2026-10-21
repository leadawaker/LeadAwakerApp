// A small in-memory sliding-window limiter for the AI buttons (caption writer, script draft), keyed by
// user. One process on the Pi, so memory is enough; a restart only forgets recent clicks.

export interface RateLimiter {
  /** true and counted when allowed, false when the key is over its limit in the window. */
  take(key: string, now?: number): boolean;
  /** Seconds until the oldest hit leaves the window (0 when allowed now). */
  retryAfterS(key: string, now?: number): number;
}

export function createRateLimiter(opts: { max: number; windowMs: number }): RateLimiter {
  const hits = new Map<string, number[]>();
  const recent = (key: string, now: number) => {
    const list = (hits.get(key) ?? []).filter((t) => now - t < opts.windowMs);
    if (list.length) hits.set(key, list);
    else hits.delete(key);
    return list;
  };
  return {
    take(key, now = Date.now()) {
      const list = recent(key, now);
      if (list.length >= opts.max) return false;
      hits.set(key, [...list, now]);
      return true;
    },
    retryAfterS(key, now = Date.now()) {
      const list = recent(key, now);
      if (list.length < opts.max) return 0;
      return Math.max(1, Math.ceil((list[0] + opts.windowMs - now) / 1000));
    },
  };
}
