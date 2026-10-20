// What the Insights section shows, computed from the stored snapshots. Pure.
// Headline numbers sum the account's day totals over the last 7 or 30 days; the follower trend is the
// day's follower count; the post table holds each media item's newest values; the best weekday and
// hour to post come from the posts' views in the account's zone, with "not enough data" below a threshold.

export const BEST_TIME_MIN_POSTS = 8;
/** A weekday or an hour needs this many posts before it can be called the best. */
export const BEST_SLOT_MIN_POSTS = 2;

export interface MediaRow { igMediaId: string; postId: number | null; caption: string; permalink: string | null; postedAt: Date | null; productType: string | null }

export interface PostInsight {
  igMediaId: string;
  postId: number | null;
  caption: string;
  permalink: string | null;
  postedAt: string | null;
  productType: string | null;
  metrics: Record<string, number>;
}

export interface BestTimes {
  enough: boolean;
  postsWithViews: number;
  /** Posts with views needed before a best time is shown. */
  minPosts: number;
  /** 0 = Monday ... 6 = Sunday, in the account's zone. */
  byWeekday: { weekday: number; posts: number; avgViews: number | null }[];
  byHour: { hour: number; posts: number; avgViews: number | null }[];
  bestWeekday: number | null;
  bestHour: number | null;
}

export interface InsightsView {
  days: 7 | 30;
  headline: { views: number | null; reach: number | null; interactions: number | null; accountsEngaged: number | null; profileViews: number | null; followers: number | null; followersDelta: number | null };
  followerTrend: { date: string; value: number }[];
  posts: PostInsight[];
  bestTimes: BestTimes;
  skipped: string[];
}

const dayOf = (d: Date) => d.toISOString().slice(0, 10);

function localParts(d: Date, timeZone: string): { weekday: number; hour: number } {
  let wd = "Mon";
  let hr = "0";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(d);
    wd = parts.find((p) => p.type === "weekday")?.value ?? wd;
    hr = parts.find((p) => p.type === "hour")?.value ?? hr;
  } catch {
    wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
    hr = String(d.getUTCHours());
  }
  return { weekday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(wd), hour: Number(hr) % 24 };
}

export function computeBestTimes(posts: PostInsight[], timeZone: string): BestTimes {
  const withViews = posts.filter((p) => p.postedAt && typeof p.metrics.views === "number");
  const wd = Array.from({ length: 7 }, () => ({ n: 0, sum: 0 }));
  const hr = Array.from({ length: 24 }, () => ({ n: 0, sum: 0 }));
  for (const p of withViews) {
    const { weekday, hour } = localParts(new Date(p.postedAt!), timeZone);
    if (weekday >= 0) { wd[weekday].n++; wd[weekday].sum += p.metrics.views; }
    hr[hour].n++;
    hr[hour].sum += p.metrics.views;
  }
  const enough = withViews.length >= BEST_TIME_MIN_POSTS;
  const best = (rows: { n: number; sum: number }[]) => {
    let at: number | null = null;
    let top = -1;
    rows.forEach((r, i) => {
      if (r.n < BEST_SLOT_MIN_POSTS) return;
      const avg = r.sum / r.n;
      if (avg > top) { top = avg; at = i; }
    });
    return at;
  };
  return {
    enough,
    postsWithViews: withViews.length,
    minPosts: BEST_TIME_MIN_POSTS,
    byWeekday: wd.map((r, weekday) => ({ weekday, posts: r.n, avgViews: r.n ? Math.round(r.sum / r.n) : null })),
    byHour: hr.map((r, hour) => ({ hour, posts: r.n, avgViews: r.n ? Math.round(r.sum / r.n) : null })),
    bestWeekday: enough ? best(wd) : null,
    bestHour: enough ? best(hr) : null,
  };
}

export function buildInsightsView(p: {
  days: 7 | 30;
  now: Date;
  timeZone: string;
  media: MediaRow[];
  latest: { igMediaId: string; metric: string; value: number }[];
  account: { metric: string; bucket: string; value: number }[];
  skipped: string[];
}): InsightsView {
  const today = dayOf(p.now);
  const start = dayOf(new Date(p.now.getTime() - p.days * 86_400_000));
  const inPeriod = (b: string) => b >= start && b < today;
  const sum = (metric: string) => {
    const rows = p.account.filter((r) => r.metric === metric && inPeriod(r.bucket));
    return rows.length ? rows.reduce((a, r) => a + r.value, 0) : null;
  };
  const followers = p.account.filter((r) => r.metric === "followers_count").sort((a, b) => a.bucket.localeCompare(b.bucket));
  const latestFollowers = followers.at(-1)?.value ?? null;
  const before = [...followers].reverse().find((r) => r.bucket <= start) ?? followers.find((r) => r.bucket >= start);
  const followersDelta = latestFollowers !== null && before && before !== followers.at(-1) ? latestFollowers - before.value : null;

  const byMedia = new Map<string, Record<string, number>>();
  for (const v of p.latest) byMedia.set(v.igMediaId, { ...byMedia.get(v.igMediaId), [v.metric]: v.value });
  const posts: PostInsight[] = p.media.map((m) => ({
    igMediaId: m.igMediaId,
    postId: m.postId,
    caption: m.caption.split("\n").map((l) => l.trim()).find(Boolean)?.slice(0, 120) ?? "",
    permalink: m.permalink,
    postedAt: m.postedAt ? m.postedAt.toISOString() : null,
    productType: m.productType,
    metrics: byMedia.get(m.igMediaId) ?? {},
  }));

  return {
    days: p.days,
    headline: {
      views: sum("views"),
      reach: sum("reach"),
      interactions: sum("total_interactions"),
      accountsEngaged: sum("accounts_engaged"),
      profileViews: sum("profile_views"),
      followers: latestFollowers,
      followersDelta,
    },
    followerTrend: followers.filter((r) => r.bucket >= dayOf(new Date(p.now.getTime() - 30 * 86_400_000))).map((r) => ({ date: r.bucket, value: r.value })),
    posts,
    bestTimes: computeBestTimes(posts, p.timeZone),
    skipped: p.skipped,
  };
}
