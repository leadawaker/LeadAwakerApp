// The two chart forms in Insights, both single series in the wine data token (--chart-wine, checked
// with the dataviz validator in light and dark): the follower count over time (2px line, a 10% wash,
// crosshair tooltip) and average views by weekday or hour (columns <= 24px, 4px rounded tops, the best
// one labelled). Each has a table view for screen readers and anyone who prefers numbers.
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import { TrendingUp } from "lucide-react";
import { BEST_SLOT_MIN_POSTS, compact, niceDomain } from "../../lib/insights";

const SERIES = "hsl(var(--chart-wine))";
const tick = { fontSize: 10, fill: "var(--mute-2)" };
const tooltipStyle = { borderRadius: "10px", border: "1px solid var(--line)", backgroundColor: "var(--card)", color: "var(--ink)", fontSize: "11px", padding: "6px 10px" };

function TableView({ caption, head, rows }: { caption: string; head: [string, string]; rows: [string, string][] }) {
  const { t } = useTranslation("social");
  return (
    <details style={{ marginTop: 6 }}>
      <summary style={{ cursor: "pointer", fontSize: 11.5, color: "var(--mute)" }}>{t("insights.asTable")}</summary>
      <table style={{ width: "100%", marginTop: 6, fontSize: 12, borderCollapse: "collapse" }}>
        <caption style={{ textAlign: "left", fontSize: 11, color: "var(--mute-2)", paddingBottom: 4 }}>{caption}</caption>
        <thead><tr>{head.map((h) => <th key={h} style={{ textAlign: "left", fontWeight: 600, color: "var(--mute)", padding: "4px 6px" }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map(([a, b]) => <tr key={a}><td style={{ padding: "3px 6px", color: "var(--ink-soft)" }}>{a}</td><td style={{ padding: "3px 6px", color: "var(--ink-soft)", fontVariantNumeric: "tabular-nums" }}>{b}</td></tr>)}</tbody>
      </table>
    </details>
  );
}

export function FollowerTrend({ points }: { points: { date: string; value: number }[] }) {
  const { t, i18n } = useTranslation("social");
  const day = (d: string) => new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
  if (points.length < 2) return (
    <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)", display: "flex", alignItems: "center", gap: 8 }} data-testid="followers-not-enough">
      <TrendingUp size={16} strokeWidth={1.75} aria-hidden style={{ flexShrink: 0, color: "var(--mute-2)" }} />
      {t("insights.followersNotEnough")}
    </p>
  );
  const values = points.map((p) => p.value);
  const y = niceDomain(Math.min(...values), Math.max(...values));
  return (
    <div>
      <div role="img" aria-label={t("insights.followersTitle")} style={{ width: "100%", height: 180 }} data-testid="followers-chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 10, right: 22, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" strokeWidth={1} />
            <XAxis dataKey="date" tickFormatter={day} tick={tick} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tick={tick} tickLine={false} axisLine={false} width={44} domain={y.domain} ticks={y.ticks} tickFormatter={(v: number) => compact(v, i18n.language)} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "var(--mute-2)", strokeWidth: 1 }} labelFormatter={(d: string) => day(d)} formatter={(v: number) => [compact(v, i18n.language), t("insights.followers")]} />
            <Area type="monotone" dataKey="value" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" fill={SERIES} fillOpacity={0.1}
              dot={false} activeDot={{ r: 4, stroke: "var(--bone)", strokeWidth: 2, fill: SERIES }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <TableView caption={t("insights.followersTitle")} head={[t("insights.date"), t("insights.followers")]} rows={points.map((p) => [day(p.date), compact(p.value, i18n.language)])} />
    </div>
  );
}

export function AvgViewsColumns({ rows, best, label, title, testId, tickEvery = 1 }: {
  rows: { key: number; posts: number; avgViews: number | null }[];
  best: number | null;
  label: (k: number) => string;
  title: string;
  testId: string;
  /** Label every n-th column (24 hours do not fit on a phone). */
  tickEvery?: number;
}) {
  const { t, i18n } = useTranslation("social");
  // A slot with fewer than BEST_SLOT_MIN_POSTS posts can never be "Best", so it is drawn hatched and faded.
  const data = rows.map((r) => ({ name: label(r.key), key: r.key, avg: r.avgViews ?? 0, posts: r.posts, best: r.key === best, thin: r.posts > 0 && r.posts < BEST_SLOT_MIN_POSTS }));
  const hatch = `hatch-${testId}`;
  const y = niceDomain(0, Math.max(1, ...data.map((d) => d.avg)), 4);
  return (
    <div>
      <h4 style={{ margin: "0 0 4px", fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)" }}>{title}</h4>
      <div role="img" aria-label={title} style={{ width: "100%", height: 160 }} data-testid={testId}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 30, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
            <defs>
              <pattern id={hatch} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="5" stroke={SERIES} strokeOpacity={0.5} strokeWidth={1.5} />
              </pattern>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--line)" strokeWidth={1} />
            <XAxis dataKey="name" tick={tick} tickLine={false} axisLine={false} interval={tickEvery - 1} />
            <YAxis tick={tick} tickLine={false} axisLine={false} width={40} domain={y.domain} ticks={y.ticks} tickFormatter={(v: number) => compact(v, i18n.language)} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--wine-tint)" }} separator=""
              formatter={(v: number, _n, item: any) => [`${t("insights.avgViewsTip", { views: compact(v, i18n.language), count: item?.payload?.posts ?? 0 })}${item?.payload?.thin ? `. ${t("insights.fewPostsTip")}` : ""}`, ""]} />
            <Bar dataKey="avg" fill={SERIES} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((d) => d.thin
                ? <Cell key={d.key} fill={`url(#${hatch})`} stroke={SERIES} strokeOpacity={0.5} strokeWidth={1} />
                : <Cell key={d.key} fill={SERIES} />)}
              <LabelList dataKey="posts" position="top" content={(p: any) => {
                const d = data[p.index];
                if (!d || d.posts === 0) return null;
                const cx = p.x + p.width / 2;
                return (
                  <g>
                    <text x={cx} y={p.y - 4} textAnchor="middle" fontSize={9} fill="var(--mute-2)" style={{ fontVariantNumeric: "tabular-nums" }}>{d.posts}</text>
                    {d.best && <text x={cx} y={p.y - 15} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--ink)">{t("insights.best")}</text>}
                  </g>
                );
              }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableView caption={title} head={[t("insights.slot"), t("insights.avgViews")]}
        rows={rows.filter((r) => r.posts > 0).map((r) => [label(r.key), `${compact(r.avgViews, i18n.language)} (${t("insights.posts", { count: r.posts })})`])} />
    </div>
  );
}
