import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowRight, ArrowUp, type LucideIcon } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { DayPoint } from "@shared/homeTypes";

export interface CardTrend { dir: "up" | "down" | "flat"; text: string }
export interface CardStat { key: string; label: string; value: ReactNode }

export interface ServiceCardProps {
  id: string;
  testId: string;
  /** The service's old banner picture, zoomed to its subject (`artPos` = CSS background-position). */
  art: string;
  artPos: string;
  title: string;
  /** Token colour for the icon and the sparkline. */
  color: string;
  icon: LucideIcon;
  mainLabel: string;
  mainValue: ReactNode;
  trend: CardTrend | null;
  /** Per-day series of the main number; left out when the service has none. */
  spark?: DayPoint[];
  stats: [CardStat, CardStat];
  /** "Open" goes to the service's own page; without it the button is left out. */
  onOpen?: () => void;
}

const TREND_COLOR: Record<CardTrend["dir"], string> = { up: "var(--good)", down: "var(--stage-lost)", flat: "var(--mute)" };
const mono = { fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.12em" } as const;

function Sparkline({ data, color }: { data: DayPoint[]; color: string }) {
  const gradId = useId();
  return (
    <div aria-hidden style={{ width: "100%", height: 52 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.75} fill={`url(#${gradId})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * One switched-on service on the Stats page: picture, title, the main number with
 * its trend and per-day line, two smaller numbers, and Open. Everything about the
 * service sits inside the card; the grid gives every card the same height.
 */
export function ServiceCard(p: ServiceCardProps) {
  const { t } = useTranslation("home");
  const Icon = p.icon;
  const TrendIcon = p.trend?.dir === "down" ? ArrowDown : ArrowUp;
  return (
    <article id={p.id} data-testid={p.testId} className="neu-raised flex min-w-0 flex-col"
      style={{ background: "var(--card)", borderRadius: "var(--r-card)", overflow: "hidden", scrollMarginTop: 12 }}>
      <div aria-hidden style={{
        height: 132, flexShrink: 0,
        background: `url(${p.art}) ${p.artPos} / 190% auto no-repeat, var(--home-banner-night)`,
      }} />
      <div className="flex flex-1 flex-col" style={{ padding: "18px 20px 20px", gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--ink)", lineHeight: 1.15 }}>{p.title}</h3>
        <div style={{ ...mono, fontSize: 10.5, color: "var(--mute)" }}>{p.mainLabel}</div>
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: "var(--mono)", fontSize: 40, lineHeight: 1, color: "var(--ink)", letterSpacing: "-0.02em" }}>{p.mainValue}</span>
          <Icon size={18} aria-hidden style={{ color: p.color }} />
        </div>
        <div className="flex items-center gap-1" style={{ fontFamily: "var(--mono)", fontSize: 11.5, minHeight: 16, color: p.trend ? TREND_COLOR[p.trend.dir] : "var(--mute)" }}>
          {p.trend ? (
            <>
              {p.trend.dir !== "flat" && <TrendIcon size={12} aria-hidden />}
              <span>{p.trend.text}</span>
            </>
          ) : <span>{t("cards.noTrend")}</span>}
        </div>
        {p.spark && p.spark.length > 1 && <Sparkline data={p.spark} color={p.color} />}
        <div className="grid grid-cols-2" style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 2 }}>
          {p.stats.map((s, i) => (
            <div key={s.key} className="min-w-0" style={{ paddingLeft: i ? 14 : 0, paddingRight: i ? 0 : 14, borderLeft: i ? "1px solid var(--line)" : undefined }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 20, color: "var(--ink)", lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ ...mono, fontSize: 9.5, color: "var(--mute)", marginTop: 4, letterSpacing: "0.1em" }}>{s.label}</div>
            </div>
          ))}
        </div>
        {p.onOpen && (
          <button type="button" onClick={p.onOpen} className="la-btn la-btn--soft mt-auto w-full justify-center" data-testid={`${p.testId}-open`}
            style={{ marginTop: "auto", minHeight: 36 }}>
            {t("cards.open")}
            <ArrowRight size={14} aria-hidden />
          </button>
        )}
      </div>
    </article>
  );
}
