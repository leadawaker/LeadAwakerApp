import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { PageTopbar, TopbarIconButton, ExpandingSearch } from "@/components/crm/primitives";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";
import { SERVICE_ORDER, type AutomationService } from "@shared/automationCatalogue";
import type { OverviewRow } from "@shared/automationTypes";
import { useAutomationsOverview } from "@/features/automation/api";
import { OverviewHero } from "@/features/automation/components/OverviewHero";
import { ServiceSection } from "@/features/automation/components/ServiceSection";
import { DiaryPanel } from "@/features/automation/components/DiaryPanel";
import { AutomationRail, railPanelId } from "@/features/automation/components/AutomationRail";
import { SectionLayout } from "@/features/accounts/components/workspace/SectionRail";
import { ClearFailuresButton } from "@/features/automation/components/ClearFailuresButton";
import { automationName, automationDescription } from "@/features/automation/labels";
import { bucketOf, rowActions24h } from "@/features/automation/status";
import "@/features/automation/automation.css";

type GroupKey = AutomationService | "unlisted";
type Filter = "all" | "attention" | "active";

export default function AutomationLogsPage() {
  const { t } = useTranslation("automation");
  const isMobile = useIsMobile(768);
  const q = useAutomationsOverview();
  const [selected, setSelected] = useState<string | null>(null);
  const [picked, setPicked] = useState<GroupKey | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const rows = q.data?.rows ?? [];
  const filterCounts = useMemo(() => ({
    all: rows.length,
    attention: rows.filter((r) => ["attention", "broken"].includes(bucketOf(r.health))).length,
    active: rows.filter((r) => rowActions24h(r) > 0).length,
  }), [rows]);

  const groups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const keep = (r: OverviewRow) => {
      if (filter === "attention" && !["attention", "broken"].includes(bucketOf(r.health))) return false;
      if (filter === "active" && rowActions24h(r) === 0) return false;
      if (!needle) return true;
      return `${automationName(t, r.id)} ${automationDescription(t, r.id)} ${r.id}`.toLowerCase().includes(needle);
    };
    const map = new Map<GroupKey, OverviewRow[]>();
    for (const r of rows) {
      if (!keep(r)) continue;
      const key: GroupKey = r.entry ? r.entry.service : "unlisted";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return ([...SERVICE_ORDER, "unlisted"] as GroupKey[]).filter((k) => map.has(k)).map((k) => ({
      key: k,
      rows: map.get(k)!,
      failures: map.get(k)!.reduce((n, r) => n + r.counts24h.failed, 0),
    }));
  }, [rows, filter, search, t]);

  // The picked category, else the first one with open failures, else the first. A filter can hide the picked one.
  const active = groups.find((g) => g.key === picked) ?? groups.find((g) => g.failures > 0) ?? groups[0];
  const railItems = groups.map((g) => ({ key: g.key, detail: t("rail.automations", { count: g.rows.length }), failures: g.failures }));

  const panelOnly = isMobile && !!selected;

  const filterTabs = (
    <div className="la-seg la-seg--pill shrink-0" role="tablist" aria-label={t("filter.label")}>
      {(["all", "attention", "active"] as Filter[]).map((f) => (
        <button key={f} type="button" role="tab" aria-selected={filter === f} className={cn("la-seg-btn", filter === f && "on")} onClick={() => setFilter(f)} data-testid={`automation-filter-${f}`}>
          {t(`filter.${f}`)} <span style={{ opacity: 0.7 }}>{filterCounts[f]}</span>
        </button>
      ))}
    </div>
  );
  const searchField = <ExpandingSearch value={search} onChange={setSearch} placeholder={t("filter.search")} />;

  return (
    <CrmShell>
      <div className="la-page" style={{ background: "var(--bg)" }} data-testid="page-automation-logs">
        {!panelOnly && (
          <PageTopbar
            title={t("page.title")}
            left={!isMobile && filterTabs}
            right={<>
              {!isMobile && searchField}
              <TopbarIconButton label={t("page.refresh")} onClick={() => q.refetch()}>
                <RefreshCw className={cn("w-4 h-4", q.isFetching && "animate-spin")} />
              </TopbarIconButton>
            </>}
          >
            <span className="max-lg:hidden" style={{ fontSize: 12.5, color: "var(--mute)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t("page.subtitle")}</span>
          </PageTopbar>
        )}

        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex" }}>
          {!panelOnly && (
            // The category menu sticks 20px under the top of this scroller, level with its padding (SectionLayout adds 32px).
            <div className="min-h-0 overflow-y-auto" style={{ flex: 1, minWidth: 0, ["--ws-sticky-top" as string]: "-12px" }}>
              <div style={{ width: "100%", maxWidth: 1386, margin: "0 auto", padding: isMobile ? "14px 12px 32px" : "20px 24px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
                {q.error ? (
                  <ApiErrorFallback error={q.error as Error} onRetry={() => q.refetch()} />
                ) : q.isLoading ? (
                  <>
                    <div className="h-[168px] bg-primary/10 rounded-xl animate-pulse" />
                    {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[220px] bg-primary/10 rounded-xl animate-pulse" />)}
                  </>
                ) : q.data ? (
                  <>
                    <OverviewHero data={q.data} />

                    {/* Phones keep the filter and search above the list; desktop has them in the topbar. */}
                    {isMobile && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        {filterTabs}
                        <div style={{ marginLeft: "auto" }}>{searchField}</div>
                      </div>
                    )}

                    {groups.length === 0 ? (
                      <div style={{ padding: "40px 0", textAlign: "center", color: "var(--mute)", fontSize: 14 }}>
                        {filter === "attention" && !search ? t("filter.noneAttention") : t("filter.none")}
                      </div>
                    ) : active && (
                      <SectionLayout
                        stacked={isMobile}
                        testId="automation-sections"
                        rail={(layout) => <AutomationRail items={railItems} active={active.key} onSelect={(k) => setPicked(k)} layout={layout} />}
                      >
                        <div className="am-list" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                          <div className="am-captions" aria-hidden>
                            <span /><span>{t("captions.automation")}</span><span>{t("captions.runs")}</span><span>{t("captions.pulse")}</span>
                            <span style={{ textAlign: "right" }}>{t("captions.actions")}</span><span style={{ textAlign: "right" }}>{t("captions.clients")}</span>
                            <span style={{ textAlign: "right" }}>{t("captions.last")}</span><span />
                          </div>
                          <ServiceSection
                            key={active.key}
                            id={railPanelId(active.key)}
                            service={active.key}
                            rows={active.rows}
                            selected={selected}
                            onSelect={setSelected}
                            action={<ClearFailuresButton count={active.failures} scope={{ automationIds: active.rows.map((r) => r.id) }} />}
                          />
                        </div>
                      </SectionLayout>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          )}
          {selected && (
            <div className="min-h-0" style={{ width: isMobile ? "100%" : 440, maxWidth: "100%", flexShrink: 0 }}>
              <DiaryPanel key={selected} automationId={selected} row={rows.find((r) => r.id === selected)} onClose={() => setSelected(null)} />
            </div>
          )}
        </div>
      </div>
    </CrmShell>
  );
}
