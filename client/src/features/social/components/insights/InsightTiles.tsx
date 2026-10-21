// The five headline numbers as outline tiles (1px line, no raised shadow): an icon, a small label,
// the 22px value and, for followers, the change since a named day. Two columns on a phone.
import { Eye, Heart, UserPlus, UserRound, Users, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { compact, signed } from "../../lib/insights";
import type { InsightsView } from "../../api/insightsApi";

const ICONS: Record<string, LucideIcon> = { views: Eye, reach: Users, interactions: Heart, profileViews: UserRound, followers: UserPlus };

export function InsightTiles({ v }: { v: InsightsView }) {
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
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5" data-testid="insights-tiles">
      {tiles.map((x, i) => {
        const Icon = ICONS[x.key];
        return (
          <div key={x.key} className={i === tiles.length - 1 ? "col-span-2 sm:col-span-1" : undefined}
            style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", background: "transparent", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--mute)" }}>
              <Icon size={14} strokeWidth={1.75} aria-hidden style={{ flexShrink: 0 }} />
              {t(`insights.tiles.${x.key}`)}
            </span>
            <span style={{ fontSize: 22, fontWeight: 650, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{compact(x.value, i18n.language)}</span>
            {x.delta && <span style={{ fontSize: 11.5, color: "var(--mute)" }}>{t("insights.sinceDate", { delta: x.delta, date: since })}</span>}
          </div>
        );
      })}
    </div>
  );
}
