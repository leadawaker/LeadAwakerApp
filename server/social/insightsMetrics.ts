// Every Instagram insights metric the collector asks for, in one place (Phase D). Names change between
// API versions and Reels differ from feed posts, so a metric Meta refuses is stored as a skip with
// Meta's reason, never a crash (insightsApi.ts asks one by one when a batch is refused).
//
// Checked 2026-10-20 against Meta's Instagram Media Insights reference and changelog summaries (the
// developers.facebook.com host does not resolve from the build sandbox; secondary sources were used,
// so the skip mechanism is the safety net). Removed by Meta on 2025-04-21 and NOT requested: plays,
// impressions, clips_replays_count, ig_reels_aggregated_all_plays_count, video_views. "views" replaces them.

/** Per Reel (media_product_type REELS), lifetime values. */
export const REEL_METRICS = [
  "views",
  "reach",
  "likes",
  "comments",
  "shares",
  "saved",
  "total_interactions",
  "ig_reels_avg_watch_time",        // milliseconds
  "ig_reels_video_view_total_time", // milliseconds, Meta marks it "in development"
  "reels_skip_rate",                // percent, newest, may not be available yet
] as const;

/** Per feed post (image, carousel): what a non-Reel answers. */
export const FEED_METRICS = ["views", "reach", "likes", "comments", "shares", "saved", "total_interactions"] as const;

/** Per account and day, asked with metric_type=total_value for one day at a time. */
export const ACCOUNT_DAY_METRICS = ["views", "reach", "accounts_engaged", "total_interactions", "profile_views"] as const;

/** Read from the profile on every run (a field, not an insight): the follower trend is built from these snapshots. */
export const PROFILE_FIELDS = "followers_count,media_count";

export const MEDIA_FIELDS = "id,media_type,media_product_type,permalink,caption,timestamp,like_count,comments_count";

/** How often, from the collector's hourly tick. */
export const POLL = {
  tickMs: 60 * 60_000,
  /** A media item in its first 3 days is read every hour, later every 6 hours. */
  freshForMs: 3 * 86_400_000,
  freshEveryMs: 60 * 60_000,
  matureEveryMs: 6 * 60 * 60_000,
  /** The account's media list, day totals and followers: every 6 hours. */
  accountEveryMs: 6 * 60 * 60_000,
  /** The newest media read per run (the first run backfills them). */
  recentMedia: 50,
  /** Days of account totals the first run backfills, and how many recent days a later run re-reads (late data). */
  backfillDays: 30,
  refreshDays: 2,
} as const;

export type MetricScope = "account" | "media";
