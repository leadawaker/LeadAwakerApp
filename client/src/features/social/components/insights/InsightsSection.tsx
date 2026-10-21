// Insights for one account: headline numbers for the last 7 or 30 days (stat tiles, not charts), the
// follower trend, the best weekday and hour to post (from the posts' views, "not enough data" under the
// threshold), and every post's numbers in a table sortable by views. Any user of the account.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchInsights, insightsKey, type InsightsView } from "../../api/insightsApi";
import { cell, compact, POST_COLUMNS, signed, sortPosts, type PostColumn } from "../../lib/insights";
import { AvgViewsColumns, FollowerTrend } from "./InsightCharts";

const card: React.CSSProperties = { borderRadius: "var(--r-card)", background: "var(--bone)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 };
const h3: React.CSSProperties = { margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)" };

function Tiles({ v }: { v: InsightsView }) {
  const { t, i18n } = useTranslation("social");
  const since = v.headline.followersDeltaSince
    ? new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${v.headline.followersDeltaSince}T12:00:00Z`))
    : null;
  const tiles: { key: string; value: number | null; delta?: string | null }[] = [
    { key: "views", value: v.headline.views },
    { key: "reach", value: v.headline.reach },
    { key: "interactions", value: v.headline.interactions },
    { key: "profileViews", value: v.headline.profileViews },
    { key: "followers", value: v.headline.followers, delta: since ? signed(v.headline.followersDelta, i18n.language) : null },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }} data-testid="insights-tiles">
      {tiles.map((x) => (
        <div key={x.key} className="neu-raised" style={{ ...card, padding: "12px 14px", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--mute)" }}>{t(`insights.tiles.${x.key}`)}</span>
          <span style={{ fontSize: 22, fontWeight: 650, color: "var(--ink)" }}>{compact(x.value, i18n.language)}</span>
          {x.delta && <span style={{ fontSize: 11.5, color: "var(--mute)" }}>{t("insights.sinceDate", { delta: x.delta, date: since })}</span>}
        </div>
      ))}
    </div>
  );
}

function PostsTable({ v }: { v: InsightsView }) {
  const { t, i18n } = useTranslation("social");
  const [by, setBy] = useState<PostColumn | "postedAt">("views");
  const [dir, setDir] = useState<"desc" | "asc">("desc");
  const rows = useMemo(() => sortPosts(v.posts, by, dir), [v.posts, by, dir]);
  const sortOn = (c: PostColumn | "postedAt") => { if (c === by) setDir(dir === "desc" ? "asc" : "desc"); else { setBy(c); setDir("desc"); } };
  const date = (iso: string | null) => (iso ? new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeZone: v.timeZone }).format(new Date(iso)) : "–");
  const th = (c: PostColumn | "postedAt", label: string) => (
    <th key={c} aria-sort={by === c ? (dir === "desc" ? "descending" : "ascending") : "none"} style={{ padding: "6px 8px", textAlign: c === "postedAt" ? "left" : "right", whiteSpace: "nowrap" }}>
      <button type="button" onClick={() => sortOn(c)} style={{ all: "unset", cursor: "pointer", fontSize: 11, fontWeight: 600, color: by === c ? "var(--ink)" : "var(--mute)" }} data-testid={`insights-sort-${c}`}>
        {label}{by === c && (dir === "desc" ? <ArrowDown size={10} style={{ display: "inline", marginLeft: 2 }} /> : <ArrowUp size={10} style={{ display: "inline", marginLeft: 2 }} />)}
      </button>
    </th>
  );
  if (v.posts.length === 0) return <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)" }}>{t("insights.noPosts")}</p>;
  return (
    <div style={{ overflowX: "auto", maxWidth: "100%" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 720 }} data-testid="insights-posts">
        <thead style={{ borderBottom: "1px solid var(--line)" }}>
          <tr>
            <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--mute)" }}>{t("insights.post")}</th>
            {th("postedAt", t("insights.date"))}
            {POST_COLUMNS.map((c) => th(c, t(`insights.columns.${c}`)))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.igMediaId} style={{ borderBottom: "1px solid var(--line)", height: 52 }}>
              <td style={{ padding: "6px 8px", maxWidth: 260 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink-soft)" }}>{p.caption || t("insights.noCaption")}</span>
                  {p.permalink && <a href={p.permalink} target="_blank" rel="noreferrer" aria-label={t("insights.open")} style={{ color: "var(--wine)", flexShrink: 0 }}><ExternalLink size={12} /></a>}
                </span>
              </td>
              <td style={{ padding: "6px 8px", whiteSpace: "nowrap", color: "var(--mute)" }}>{date(p.postedAt)}</td>
              {POST_COLUMNS.map((c) => <td key={c} style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--ink-soft)" }}>{cell(c, p.metrics[c], i18n.language)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
          <Tiles v={q.data} />
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
                <p style={{ margin: 0, fontSize: 11.5, color: "var(--mute)" }}>{t("insights.bestHelp", { zone: q.data.timeZone })}</p>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)" }} data-testid="insights-not-enough">{t("insights.notEnough", { count: q.data.bestTimes.postsWithViews, min: q.data.bestTimes.minPosts })}</p>
            )}
          </section>
          <section className="neu-raised" style={card}>
            <h3 style={h3}>{t("insights.postsTitle")}</h3>
            <PostsTable v={q.data} />
            {q.data.skipped.length > 0 && <p style={{ margin: 0, fontSize: 11.5, color: "var(--mute)" }}>{t("insights.skipped", { metrics: q.data.skipped.join(", ") })}</p>}
          </section>
        </>
      )}
    </div>
  );
}
