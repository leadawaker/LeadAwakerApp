import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { IconBtn } from "@/components/ui/icon-btn";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";
import { TRAFFIC_PERIODS, type TrafficDays } from "@shared/trafficTypes";
import { refreshTraffic, useIndexStatus, useSearch, useVisits } from "../api";
import { StatStrip } from "../components/StatStrip";
import { VisitorsCard } from "../components/VisitorsCard";
import { SearchCard } from "../components/SearchCard";
import { IndexCard } from "../components/IndexCard";
import "../traffic.css";

/**
 * Owner-only: who finds the public site, and how. Two sources side by side:
 * the site's own visit counter (every source, AI assistants included) and
 * Google Search Console (searches, positions, what is in Google's index).
 */
export function TrafficPage() {
  const { t } = useTranslation("traffic");
  const isMobile = useIsMobile(768);
  const queryClient = useQueryClient();
  const [days, setDays] = useState<TrafficDays>(28);
  const [refreshing, setRefreshing] = useState(false);

  const visits = useVisits(days);
  const search = useSearch(days);
  const index = useIndexStatus();

  const refresh = async () => {
    setRefreshing(true);
    try {
      await refreshTraffic(queryClient, days);
    } catch {
      // Each card shows its own error state.
    } finally {
      setRefreshing(false);
    }
  };

  const error = (visits.error || search.error) as Error | null;
  const loading = visits.isLoading || search.isLoading;

  return (
    <CrmShell>
      <div className="la-page" style={{ background: "var(--bg)" }} data-testid="page-traffic">
        <div className="la-page-header">
          <span className="la-page-title">{t("page.title")}</span>
          <span style={{ fontSize: 13.5, color: "var(--mute)" }} className="max-md:hidden">{t("page.subtitle")}</span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <div className="la-seg la-seg--pill" role="tablist" aria-label={t("page.period")}>
              {TRAFFIC_PERIODS.map((d) => (
                <button key={d} type="button" role="tab" aria-selected={days === d} className={cn("la-seg-btn", days === d && "on")} onClick={() => setDays(d)} data-testid={`traffic-days-${d}`}>
                  {t("page.days", { count: d })}
                </button>
              ))}
            </div>
            <IconBtn onClick={refresh} title={t("page.refresh")} aria-label={t("page.refresh")}>
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            </IconBtn>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto" style={{ flex: 1 }}>
          <div className="tf-wrap" style={{ maxWidth: 1386, padding: isMobile ? "14px 12px 32px" : "20px 24px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
            {error ? (
              <ApiErrorFallback error={error} onRetry={refresh} />
            ) : loading ? (
              <>
                <div className="h-[128px] bg-primary/10 rounded-xl animate-pulse" />
                <div className="tf-grid">
                  <div className="h-[420px] bg-primary/10 rounded-xl animate-pulse" />
                  <div className="h-[420px] bg-primary/10 rounded-xl animate-pulse" />
                </div>
              </>
            ) : (
              <>
                <StatStrip days={days} visits={visits.data} search={search.data} />
                <div className="tf-grid">
                  <div className="tf-col">
                    {visits.data && <VisitorsCard data={visits.data} />}
                    <IndexCard
                      data={index.data}
                      isLoading={index.isLoading}
                      failed={!!index.error}
                      otherHosts={search.data?.connected ? search.data.otherHosts : []}
                    />
                  </div>
                  <div className="tf-col">
                    {search.data && <SearchCard data={search.data} />}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </CrmShell>
  );
}
