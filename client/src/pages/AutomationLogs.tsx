import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { IconBtn } from "@/components/ui/icon-btn";
import { SearchPill } from "@/components/ui/search-pill";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";
import { SERVICE_ORDER, type AutomationService } from "@shared/automationCatalogue";
import type { OverviewRow } from "@shared/automationTypes";
import { useAutomationsOverview } from "@/features/automation/api";
import { OverviewHero } from "@/features/automation/components/OverviewHero";
import { ServiceSection } from "@/features/automation/components/ServiceSection";
import { DiaryPanel } from "@/features/automation/components/DiaryPanel";
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
  const [internalOpen, setInternalOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

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
    return ([...SERVICE_ORDER, "unlisted"] as GroupKey[]).filter((k) => map.has(k)).map((k) => ({ key: k, rows: map.get(k)! }));
  }, [rows, filter, search, t]);

  const panelOnly = isMobile && !!selected;
  // A filter or search that hides "Behind the scenes" rows should still show the matches.
  const narrowed = filter !== "all" || search.trim() !== "";

  return (
    <CrmShell>
      <div className="la-page" style={{ background: "var(--bg)" }} data-testid="page-automation-logs">
        {!panelOnly && (
          <div className="la-page-header">
            <span className="serif" style={{ fontSize: 20, color: "var(--ink)" }}>{t("page.title")}</span>
            <span style={{ fontSize: 12.5, color: "var(--mute)" }} className="max-md:hidden">{t("page.subtitle")}</span>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <IconBtn onClick={() => q.refetch()} title={t("page.refresh")}>
                <RefreshCw className={cn("w-4 h-4", q.isFetching && "animate-spin")} />
              </IconBtn>
            </div>
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex" }}>
          {!panelOnly && (
            <div className="min-h-0 overflow-y-auto" style={{ flex: 1, minWidth: 0 }}>
              <div style={{ maxWidth: 1386, padding: isMobile ? "14px 12px 32px" : "20px 24px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
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

                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <div className="la-seg la-seg--pill" role="tablist" aria-label={t("filter.label")}>
                        {(["all", "attention", "active"] as Filter[]).map((f) => (
                          <button key={f} type="button" role="tab" aria-selected={filter === f} className={cn("la-seg-btn", filter === f && "on")} onClick={() => setFilter(f)} data-testid={`automation-filter-${f}`}>
                            {t(`filter.${f}`)} <span style={{ opacity: 0.7 }}>{filterCounts[f]}</span>
                          </button>
                        ))}
                      </div>
                      <div style={{ marginLeft: "auto" }}>
                        <SearchPill value={search} onChange={setSearch} open={searchOpen || !!search} onOpenChange={setSearchOpen} placeholder={t("filter.search")} />
                      </div>
                    </div>

                    <div className="am-list" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {groups.length > 0 && (
                        <div className="am-captions" aria-hidden>
                          <span /><span>{t("captions.automation")}</span><span>{t("captions.runs")}</span><span>{t("captions.pulse")}</span>
                          <span style={{ textAlign: "right" }}>{t("captions.actions")}</span><span style={{ textAlign: "right" }}>{t("captions.clients")}</span>
                          <span style={{ textAlign: "right" }}>{t("captions.last")}</span><span />
                        </div>
                      )}
                      {groups.length === 0 && (
                        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--mute)", fontSize: 14 }}>
                          {filter === "attention" && !search ? t("filter.noneAttention") : t("filter.none")}
                        </div>
                      )}
                      {groups.map(({ key, rows: groupRows }) => {
                        const collapsible = key === "internal" && !narrowed;
                        return (
                          <ServiceSection
                            key={key}
                            service={key}
                            rows={groupRows}
                            selected={selected}
                            onSelect={setSelected}
                            collapsible={collapsible}
                            open={!collapsible || internalOpen}
                            onToggle={() => setInternalOpen((o) => !o)}
                          />
                        );
                      })}
                    </div>
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
