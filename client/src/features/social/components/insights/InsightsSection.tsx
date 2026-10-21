// Insights for one account: headline numbers for the last 7 or 30 days (stat tiles, not charts), the
// follower trend, the best weekday and hour to post (from the posts' views, "not enough data" under the
// threshold), and every post's numbers in a table sortable by views. Any user of the account.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchInsights, insightsKey } from "../../api/insightsApi";
import { BEST_SLOT_MIN_POSTS } from "../../lib/insights";
import { InsightPostsTable } from "./InsightPostsTable";
import { InsightTiles } from "./InsightTiles";
import { AvgViewsColumns, FollowerTrend } from "./InsightCharts";

const card: React.CSSProperties = { borderRadius: "var(--r-card)", background: "var(--bone)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 };
const h3: React.CSSProperties = { margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)" };

export function InsightsSection({ accountId }: { accountId: number }) {
  const { t, i18n } = useTranslation("social");
  const [days, setDays] = useState<7 | 30>(7);
  const q = useQuery({ queryKey: insightsKey(accountId, days), queryFn: () => fetchInsights(accountId, days), staleTime: 5 * 60_000 });
  const weekday = (i: number) => new Intl.DateTimeFormat(i18n.language, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 9, 19 + i, 12)));
  const hour = (h: number) => `${String(h).padStart(2, "0")}h`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }} data-testid="insights-section">
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <div className="la-seg la-seg--pill" role="tablist" aria-label={t("insights.period")}>
          {([7, 30] as const).map((d) => (
            <button key={d} type="button" role="tab" aria-selected={days === d} className={cn("la-seg-btn", days === d && "on")} onClick={() => setDays(d)} data-testid={`insights-days-${d}`}>
              {t("insights.days", { count: d })}
            </button>
          ))}
        </div>
        {q.data?.lastRunAt && <span style={{ fontSize: 11.5, color: "var(--mute-2)" }}>{t("insights.updated", { when: new Intl.DateTimeFormat(i18n.language, { dateStyle: "short", timeStyle: "short" }).format(new Date(q.data.lastRunAt)) })}</span>}
      </div>

      {q.isLoading ? (
        <Loader2 size={14} className="animate-spin" style={{ color: "var(--mute-2)" }} />
      ) : q.isError || !q.data ? (
        <p role="alert" style={{ margin: 0, fontSize: 12.5, color: "hsl(var(--destructive))" }}>{t("errors.failed")}</p>
      ) : !q.data.lastRunAt && q.data.posts.length === 0 ? (
        <div className="neu-inset" style={{ borderRadius: "var(--r-card)", padding: "28px 20px", textAlign: "center" }} data-testid="insights-empty">
          <p style={{ margin: 0, fontSize: 13, color: "var(--mute)" }}>{t("insights.empty")}</p>
        </div>
      ) : (
        <>
          <InsightTiles v={q.data} />
          <section className="neu-raised" style={card}>
            <h3 style={h3}>{t("insights.followersTitle")}</h3>
            <FollowerTrend points={q.data.followerTrend} />
          </section>
          <section className="neu-raised" style={card} data-testid="insights-best">
            <h3 style={h3}>{t("insights.bestTitle")}</h3>
            {q.data.bestTimes.enough ? (
              <>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>
                  {q.data.bestTimes.bestWeekday !== null && q.data.bestTimes.bestHour !== null
                    ? t("insights.bestSummary", { day: new Intl.DateTimeFormat(i18n.language, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 9, 19 + q.data.bestTimes.bestWeekday, 12))), hour: hour(q.data.bestTimes.bestHour) })
                    : t("insights.bestUnclear")}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                  <AvgViewsColumns testId="insights-weekday" title={t("insights.byWeekday")} best={q.data.bestTimes.bestWeekday} label={weekday}
                    rows={q.data.bestTimes.byWeekday.map((r) => ({ key: r.weekday, posts: r.posts, avgViews: r.avgViews }))} />
                  <AvgViewsColumns testId="insights-hour" title={t("insights.byHour")} best={q.data.bestTimes.bestHour} label={hour} tickEvery={3}
                    rows={q.data.bestTimes.byHour.map((r) => ({ key: r.hour, posts: r.posts, avgViews: r.avgViews }))} />
                </div>
                <p style={{ margin: 0, fontSize: 11.5, color: "var(--mute)", display: "flex", alignItems: "center", gap: 6 }} data-testid="insights-best-legend">
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden style={{ flexShrink: 0 }}>
                    <rect x="0.5" y="0.5" width="13" height="13" rx="3" fill="none" stroke="hsl(var(--chart-wine))" strokeOpacity="0.55" />
                    <path d="M-2 14 L14 -2 M2 18 L18 2 M-6 10 L10 -6" stroke="hsl(var(--chart-wine))" strokeOpacity="0.55" strokeWidth="1" />
                  </svg>
                  <span>{t("insights.bestLegend", { min: BEST_SLOT_MIN_POSTS })}</span>
                </p>
                <p style={{ margin: 0, fontSize: 11.5, color: "var(--mute)" }}>{t("insights.bestHelp", { zone: q.data.timeZone })}</p>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)" }} data-testid="insights-not-enough">{t("insights.notEnough", { count: q.data.bestTimes.postsWithViews, min: q.data.bestTimes.minPosts })}</p>
            )}
          </section>
          <section className="neu-raised" style={card}>
            <h3 style={h3}>{t("insights.postsTitle")}</h3>
            <InsightPostsTable v={q.data} />
            {q.data.skipped.length > 0 && <p style={{ margin: 0, fontSize: 11.5, color: "var(--mute)" }}>{t("insights.skipped", { metrics: q.data.skipped.join(", ") })}</p>}
          </section>
        </>
      )}
    </div>
  );
}
