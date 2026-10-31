import { useId, type KeyboardEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
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
  /** A second number in the top right corner of the card's body. */
  corner?: { label: string; value: ReactNode };
  trend: CardTrend | null;
  /** False for "All time": there is no earlier period, so the trend line is left out. */
  showTrend?: boolean;
  /** Per-bucket series of the main number; left out when the service has none. */
  spark?: DayPoint[];
  stats: [CardStat, CardStat];
  /** Opens the service's own page; without it the card is not a link. */
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
 * One switched-on service on the Home page: picture with the title on its top
 * right, the main number with its trend and per-bucket line, two smaller numbers.
 * The whole card opens the service's page (Enter or Space from the keyboard).
 */
export function ServiceCard(p: ServiceCardProps) {
  const { t } = useTranslation("home");
  const Icon = p.icon;
  const TrendIcon = p.trend?.dir === "down" ? ArrowDown : ArrowUp;
  const showTrend = p.showTrend !== false;
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!p.onOpen || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    p.onOpen();
  };
  return (
    <article id={p.id} data-testid={p.testId}
      className={p.onOpen ? "home-card home-card--link neu-raised" : "home-card neu-raised"}
      role={p.onOpen ? "link" : undefined} tabIndex={p.onOpen ? 0 : undefined} aria-label={p.onOpen ? p.title : undefined}
      onClick={p.onOpen} onKeyDown={p.onOpen ? onKeyDown : undefined}>
      <div className="home-card-art" style={{
        background: `url(${p.art}) ${p.artPos} / 190% auto no-repeat, var(--home-banner-night)`,
      }}>
        <h3 className="home-card-title">{p.title}</h3>
      </div>
      <div className="relative flex flex-1 flex-col" style={{ padding: "16px 20px 20px", gap: 10 }}>
        <div style={{ ...mono, fontSize: 10.5, color: "var(--mute)" }}>{p.mainLabel}</div>
        {p.corner && (
          <div style={{ position: "absolute", top: 16, right: 20, textAlign: "right" }} data-testid={`${p.testId}-corner`}>
            <div style={{ ...mono, fontSize: 10.5, color: "var(--mute)" }}>{p.corner.label}</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 20, lineHeight: 1, color: "var(--ink)", marginTop: 12 }}>{p.corner.value}</div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: "var(--mono)", fontSize: 40, lineHeight: 1, color: "var(--ink)", letterSpacing: "-0.02em" }}>{p.mainValue}</span>
          <Icon size={18} aria-hidden style={{ color: p.color }} />
        </div>
        {showTrend && (
          <div className="flex items-center gap-1" style={{ fontFamily: "var(--mono)", fontSize: 11.5, minHeight: 16, color: p.trend ? TREND_COLOR[p.trend.dir] : "var(--mute)" }}>
            {p.trend ? (
              <>
                {p.trend.dir !== "flat" && <TrendIcon size={12} aria-hidden />}
                <span>{p.trend.text}</span>
              </>
            ) : <span>{t("cards.noTrend")}</span>}
          </div>
        )}
        {p.spark && p.spark.length > 1 && <Sparkline data={p.spark} color={p.color} />}
        <div className="mt-auto grid grid-cols-2" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          {p.stats.map((s, i) => (
            <div key={s.key} className="min-w-0" style={{ paddingLeft: i ? 14 : 0, paddingRight: i ? 0 : 14, borderLeft: i ? "1px solid var(--line)" : undefined }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 20, color: "var(--ink)", lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ ...mono, fontSize: 9.5, color: "var(--mute)", marginTop: 4, letterSpacing: "0.1em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
