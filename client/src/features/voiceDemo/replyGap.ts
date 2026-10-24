/**
 * How long she took to answer, as the page can see it: a transcript-based
 * approximation (the caller's last transcript delta to her first reply delta),
 * not end of speech to first audio. Staff tests send it as `reply_gap_ms`.
 */
export function createReplyGapTracker() {
  let callerAt: number | null = null;
  return {
    /** The caller's transcript grew (any delta, including a lagging one mid-reply). */
    caller(now: number): void {
      callerAt = now;
    },
    /**
     * Her turn began with its first delta. Returns the gap to the caller's last
     * transcript, or null when nobody had spoken (her opening line). Clears the
     * mark either way, so only a turn's first delta can ever record a gap.
     */
    agentTurnStart(now: number): number | null {
      const gap = callerAt === null ? null : now - callerAt;
      callerAt = null;
      return gap;
    },
    reset(): void {
      callerAt = null;
    },
  };
}
