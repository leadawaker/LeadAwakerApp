import { useTranslation } from "react-i18next";
import { TrendingDown, TrendingUp } from "lucide-react";
import { SectionCard } from "@/components/crm/primitives";
import type { SearchResponse, TrafficDays, VisitsResponse } from "@shared/trafficTypes";
import { num } from "../format";

interface Stat {
  key: "visits" | "ai" | "clicks" | "impressions";
  /** null = this number cannot be shown (counter not live, Google not connected). */
  value: number | null;
  previous: number;
  missing: string;
}

/** The four numbers the page exists for, each next to the same period before it. */
export function StatStrip({ days, visits, search }: { days: TrafficDays; visits?: VisitsResponse; search?: SearchResponse }) {
  const { t, i18n } = useTranslation("traffic");
  const counting = !!visits?.since;
  const google = search?.connected ? search : null;

  const stats: Stat[] = [
    { key: "visits", value: counting ? visits!.totals.visits : null, previous: visits?.previous.visits ?? 0, missing: t("stats.notCounting") },
    { key: "ai", value: counting ? visits!.totals.ai : null, previous: visits?.previous.ai ?? 0, missing: t("stats.notCounting") },
    { key: "clicks", value: google ? google.totals.clicks : null, previous: google?.previous.clicks ?? 0, missing: t("stats.noGoogle") },
    { key: "impressions", value: google ? google.totals.impressions : null, previous: google?.previous.impressions ?? 0, missing: t("stats.noGoogle") },
  ];

  return (
    <SectionCard padded={false} className="tf-stats" data-testid="traffic-stats">
      {stats.map((s) => (
        <div key={s.key} className={`tf-stat${s.key === "ai" ? " tf-stat--accent" : ""}`}>
          <span className="tf-stat-label">{t(`stats.${s.key}`)}</span>
          <span className={`tf-stat-value${s.value === null ? " is-empty" : ""}`}>{num(i18n.language, s.value ?? 0)}</span>
          <span className="tf-mono tf-stat-note">
            {s.value === null ? s.missing : (
              <>
                {s.value > s.previous && <TrendingUp className="w-3.5 h-3.5 up" />}
                {s.value < s.previous && <TrendingDown className="w-3.5 h-3.5 down" />}
                {t("stats.before", { value: num(i18n.language, s.previous), days })}
              </>
            )}
          </span>
        </div>
      ))}
    </SectionCard>
  );
}
