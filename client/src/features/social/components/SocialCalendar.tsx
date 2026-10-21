// Month / week calendar of the account's scheduled and published posts, in the account's zone.
// Phone first: a compact month grid with a dot per post, the picked day's posts listed below it.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import { cn } from "@/lib/utils";
import { fetchSocialPosts, socialPostsKey, type SocialPostView } from "../api/socialApi";
import { addDays, byDay, monthGrid, shiftMonth, weekDays } from "../lib/calendar";
import { toLocalDateTime } from "../lib/posts";

const DOT: Record<SocialPostView["section"], string> = {
  needs_approval: "var(--warn)",
  upcoming: "var(--wine)",
  held: "var(--mute)",
  failed: "hsl(var(--destructive))",
  published: "var(--good)",
};

function DayPosts({ posts, timeZone }: { posts: SocialPostView[]; timeZone: string }) {
  const { t } = useTranslation("social");
  const { t: ta } = useTranslation("accounts");
  if (posts.length === 0) return <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)" }}>{t("calendar.nothing")}</p>;
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      {posts.map((p) => (
        <li key={p.id} className="neu-inset row" style={{ gap: 10, borderRadius: "var(--r-surface)", padding: "8px 12px" }} data-testid={`calendar-post-${p.id}`}>
          <span style={{ width: 8, height: 8, borderRadius: "var(--r-pill)", background: DOT[p.section], flexShrink: 0 }} aria-hidden />
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mute-2)", flexShrink: 0 }}>{toLocalDateTime(p.scheduledAt, timeZone).time}</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.caption.split("\n").find((l) => l.trim()) || ta("social.posts.noCaption")}
          </span>
          <span style={{ fontSize: 11, color: DOT[p.section], flexShrink: 0 }}>{ta(`social.posts.badge.${p.section}`)}</span>
          {p.permalink && <a href={p.permalink} target="_blank" rel="noreferrer" aria-label={ta("social.posts.viewOnInstagram")} style={{ color: "var(--wine)" }}><ExternalLink size={12} /></a>}
        </li>
      ))}
    </ul>
  );
}

export function SocialCalendar({ accountId, timeZone }: { accountId: number; timeZone: string }) {
  const { t, i18n } = useTranslation("social");
  const today = toLocalDateTime(new Date().toISOString(), timeZone).date;
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(today);
  const [picked, setPicked] = useState(today);
  const { data: posts = [] } = useQuery({ queryKey: socialPostsKey(accountId), queryFn: () => fetchSocialPosts(accountId), staleTime: 15_000, refetchInterval: 60_000 });
  const days = useMemo(() => byDay(posts, timeZone), [posts, timeZone]);
  const [y, m] = cursor.split("-").map(Number);
  const fmt = (date: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(i18n.language, { ...opts, timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  const weekdayNames = weekDays("2026-10-19").map((d) => fmt(d, { weekday: "narrow" }));

  const move = (delta: number) => {
    if (view === "week") setCursor(addDays(cursor, delta * 7));
    else { const n = shiftMonth(y, m - 1, delta); setCursor(`${n.year}-${String(n.month0 + 1).padStart(2, "0")}-01`); }
  };
  const week = weekDays(cursor);
  const label = view === "month"
    ? fmt(cursor, { month: "long", year: "numeric" })
    : t("calendar.range", { from: fmt(week[0], { day: "numeric", month: "short" }), to: fmt(week[6], { day: "numeric", month: "short" }) });

  return (
    <section className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--bone)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }} data-testid="social-calendar">
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <IconBtn onClick={() => move(-1)} title={t("calendar.prev")} aria-label={t("calendar.prev")}><ChevronLeft className="w-4 h-4" /></IconBtn>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", minWidth: 120, textAlign: "center", textTransform: "capitalize" }} aria-live="polite">{label}</span>
        <IconBtn onClick={() => move(1)} title={t("calendar.next")} aria-label={t("calendar.next")}><ChevronRight className="w-4 h-4" /></IconBtn>
        <button type="button" className="la-btn la-btn--plain" onClick={() => { setCursor(today); setPicked(today); }}>{t("calendar.today")}</button>
        <div className="la-seg la-seg--pill" role="tablist" aria-label={t("calendar.view")} style={{ marginLeft: "auto" }}>
          {(["month", "week"] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} className={cn("la-seg-btn", view === v && "on")} onClick={() => setView(v)} data-testid={`calendar-view-${v}`}>{t(`calendar.${v}`)}</button>
          ))}
        </div>
      </div>

      {view === "month" ? (
        <>
          <div role="grid" aria-label={label} style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
            {weekdayNames.map((n, i) => <span key={i} role="columnheader" style={{ textAlign: "center", fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)" }}>{n}</span>)}
            {monthGrid(y, m - 1).flat().map((d) => {
              const list = days.get(d.date) ?? [];
              const on = d.date === picked;
              return (
                <button key={d.date} type="button" role="gridcell" aria-selected={on} onClick={() => setPicked(d.date)}
                  aria-label={`${fmt(d.date, { dateStyle: "full" })}: ${t("calendar.count", { count: list.length })}`}
                  style={{
                    minHeight: 44, borderRadius: "var(--r-flush)", border: "none", cursor: "pointer", padding: "4px 2px",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                    background: on ? "var(--wine-tint)" : "transparent",
                    color: d.inMonth ? "var(--ink)" : "var(--mute-2)",
                    outline: d.date === today ? "1.5px solid var(--wine)" : "none", outlineOffset: -1.5,
                  }} data-testid={`calendar-day-${d.date}`}>
                  <span style={{ fontSize: 12, fontWeight: on ? 700 : 500 }}>{Number(d.date.slice(8))}</span>
                  <span style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
                    {list.slice(0, 4).map((p) => <span key={p.id} style={{ width: 6, height: 6, borderRadius: "var(--r-pill)", background: DOT[p.section] }} />)}
                  </span>
                </button>
              );
            })}
          </div>
          <div>
            <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{fmt(picked, { weekday: "long", day: "numeric", month: "long" })}</h4>
            <DayPosts posts={days.get(picked) ?? []} timeZone={timeZone} />
          </div>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {week.map((d) => (
            <div key={d} data-testid={`calendar-week-${d}`}>
              <h4 style={{ margin: "0 0 6px", fontSize: 12.5, fontWeight: 700, color: d === today ? "var(--wine)" : "var(--ink)" }}>{fmt(d, { weekday: "long", day: "numeric", month: "short" })}</h4>
              <DayPosts posts={days.get(d) ?? []} timeZone={timeZone} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
