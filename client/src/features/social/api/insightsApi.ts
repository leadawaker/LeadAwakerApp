// Insights (server/social/insightsRoutes.ts): any user of the account.
import { apiFetch } from "@/lib/apiUtils";
import { throwUnlessOk } from "./socialApi";

export interface PostInsight {
  igMediaId: string;
  postId: number | null;
  caption: string;
  permalink: string | null;
  postedAt: string | null;
  productType: string | null;
  /** Meta's names: views, reach, likes, comments, shares, saved, ig_reels_avg_watch_time (ms), reels_skip_rate (%)... */
  metrics: Record<string, number>;
}

export interface InsightsView {
  days: 7 | 30;
  headline: { views: number | null; reach: number | null; interactions: number | null; accountsEngaged: number | null; profileViews: number | null; followers: number | null; followersDelta: number | null; followersDeltaSince: string | null };
  followerTrend: { date: string; value: number }[];
  posts: PostInsight[];
  bestTimes: {
    enough: boolean;
    postsWithViews: number;
    minPosts: number;
    byWeekday: { weekday: number; posts: number; avgViews: number | null }[];
    byHour: { hour: number; posts: number; avgViews: number | null }[];
    bestWeekday: number | null;
    bestHour: number | null;
  };
  skipped: string[];
  lastRunAt: string | null;
  timeZone: string;
}

export const insightsKey = (accountId: number, days: 7 | 30) => ["social-insights", accountId, days] as const;

export async function fetchInsights(accountId: number, days: 7 | 30): Promise<InsightsView> {
  return (await throwUnlessOk(await apiFetch(`/api/social/accounts/${accountId}/insights?days=${days}`))).json();
}
