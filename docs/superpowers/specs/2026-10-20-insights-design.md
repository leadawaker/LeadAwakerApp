# Insights (Phase D, roadmap Project 4)

Date: 2026-10-20
Status: built on `feat/social-studio`, awaiting Gabriel's review

## What

Per account, with the `instagram_business_manage_insights` scope already granted at connect time:
account numbers (views, reach, accounts engaged, interactions, profile visits, followers over time) and
per-post numbers for every media item (Reels: views, reach, likes, comments, shares, saves, average watch
time, total watch time, skip rate when Meta offers it). Snapshots over time, so growth is visible.

## Metric names (`server/social/insightsMetrics.ts`, the only list)

Names change between API versions and Reels differ from feed posts. Checked 2026-10-20 against
secondary summaries of Meta's Media Insights reference and changelog (the docs host does not resolve
from the build sandbox):

- Reels: `views, reach, likes, comments, shares, saved, total_interactions, ig_reels_avg_watch_time,
  ig_reels_video_view_total_time, reels_skip_rate` (the last two are marked "in development").
- Feed posts: `views, reach, likes, comments, shares, saved, total_interactions`.
- Account, per day, `metric_type=total_value`: `views, reach, accounts_engaged, total_interactions, profile_views`.
- Followers: the profile field `followers_count`, read every run (the follower trend is our own snapshots).
- Not requested, removed by Meta on 2025-04-21: `plays, impressions, clips_replays_count,
  ig_reels_aggregated_all_plays_count, video_views`.

**An unsupported metric is a recorded skip, never a crash** (`fetchMetrics` in `insightsApi.ts`): the
metrics are asked in one request; when Meta refuses it (an unknown metric fails the whole request) each
one is asked alone, the good ones are kept and each refused one is stored with Meta's reason. A refused
metric is not asked again for that product type until a restart. Network and server errors are thrown
and the next run tries again. The UI lists metrics that were not available.

## Storage (`script/create-social-studio-tables.mjs`, additive and idempotent)

| Table | What |
|---|---|
| `Social_Insight_Media` | the account's media as Instagram lists them (CRM posts and posts made in the app), linked to the CRM post by media id |
| `Social_Insight_Snapshots` | `(account, scope, media, metric, bucket)` unique: `value`, or null with `skipped_reason`. Buckets: `YYYY-MM-DDTHH` for a media item's lifetime value at that hour, `YYYY-MM-DD` for a day's account total or the day's follower count. Writing a bucket again replaces it, so re-runs never duplicate. |
| `Social_Insight_State` | per account: when the backfill and the last account run happened, the last error |

## Collector (`insightsCollector.ts`, same job shape as `tokenRefresher.ts`)

Hourly tick, first run 2 to 7 minutes after start (spread from the other jobs), skipped with
`DISABLE_BACKGROUND_JOBS=1`, errors logged per account and never thrown, a clear single warning while
the tables do not exist yet. Per connected account:

- Every 6 h: the newest 50 media (the first run is the backfill of posts published before this existed),
  today's follower count, and day totals: the 30 days before today on the first run, then the last 2 days
  (Meta fills them in late).
- Each media item: every hour in its first 3 days, every 6 hours after.

GET requests only, token in the Authorization header (never in a URL), Meta's `paging.next` (it carries
the token) is never kept or printed.

## UI (Socials page, section Insights; agency, Managers and Viewers)

- 7 or 30 days. Headline numbers as stat tiles (views, accounts reached, interactions, profile visits,
  followers with the change over the period).
- Followers: a single-series area line (2px, 10% wash, crosshair tooltip, round axis ticks).
- Best time to post: average views by weekday and by hour in the account's zone, computed from the
  posts' views (`insightsView.ts`), the best one labelled; under 8 posts with views it says "not enough
  data" (a weekday or hour needs 2 posts to be called best).
- Every post in a table sortable by any column (views by default), with the permalink.
- Each chart has a "show as a table" view. Chart colour: `--chart-wine` (new token, light and dark),
  checked with the dataviz validator; the brand wine itself is too dark to read as a data mark.

## My calls

- One hourly job instead of a 6-hourly one, so "polled more often in its first 3 days" can mean hourly.
- The follower trend comes from our daily snapshots of `followers_count`, not from the `follower_count`
  insight (that one needs 100+ followers and only gives 30 days).
- Collects for every connected account, not only those with Social switched on for the client: the
  agency may want the numbers before showing them.
