import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { IconBtn } from "@/components/ui/icon-btn";
import { GroupHeader } from "@/components/crm/primitives";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";
import { SERVICE_ORDER, type AutomationService } from "@shared/automationCatalogue";
import type { OverviewRow } from "@shared/automationTypes";
import { useAutomationsOverview } from "@/features/automation/api";
import { OverviewRowCard } from "@/features/automation/components/OverviewRowCard";
import { DiaryPanel } from "@/features/automation/components/DiaryPanel";
import { timeAgo } from "@/features/automation/labels";

type GroupKey = AutomationService | "unlisted";

export default function AutomationLogsPage() {
  const { t } = useTranslation("automation");
  const isMobile = useIsMobile(768);
  const q = useAutomationsOverview();
  const [selected, setSelected] = useState<string | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<GroupKey, OverviewRow[]>();
    for (const r of q.data?.rows ?? []) {
      const key: GroupKey = r.entry ? r.entry.service : "unlisted";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return ([...SERVICE_ORDER, "unlisted"] as GroupKey[]).filter((k) => map.has(k)).map((k) => ({ key: k, rows: map.get(k)! }));
  }, [q.data]);

  const totals = q.data?.totals;
  const panelOnly = isMobile && !!selected;

  return (
    <CrmShell>
      <div className="la-page" style={{ background: "var(--bg)" }} data-testid="page-automation-logs">
        {!panelOnly && (
          <div className="la-page-header">
            <span className="serif" style={{ fontSize: 20, color: "var(--ink)" }}>{t("page.title")}</span>
            {totals && (
              <span style={{ fontSize: 12, color: "var(--mute)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span>{t("summary.automations", { count: totals.automations })}</span>
                <span>{t("summary.healthy", { count: totals.healthy })}</span>
                {totals.late > 0 && <span style={{ color: "var(--warn)" }}>{t("summary.late", { count: totals.late })}</span>}
                {totals.failing > 0 && <span style={{ color: "var(--destructive)" }}>{t("summary.failing", { count: totals.failing })}</span>}
                <span>{t("summary.failures24h", { count: totals.failures24h })}</span>
              </span>
            )}
            <div style={{ marginLeft: "auto" }}>
              <IconBtn onClick={() => q.refetch()} title={t("page.refresh")}>
                <RefreshCw className={cn("w-4 h-4", q.isFetching && "animate-spin")} />
              </IconBtn>
            </div>
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex" }}>
          {!panelOnly && (
            <div className="min-h-0 overflow-y-auto" style={{ flex: 1, padding: "16px 20px 32px", maxWidth: 1386 }}>
              {q.error ? (
                <ApiErrorFallback error={q.error as Error} onRetry={() => q.refetch()} />
              ) : q.isLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[64px] bg-primary/10 rounded-xl animate-pulse" />)}
                </div>
              ) : q.data ? (
                <>
                  {!q.data.engineReachable && (
                    <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 10, background: "var(--warn-tint)", color: "var(--ink)", fontSize: 13 }}>{t("engine.down")}</div>
                  )}
                  {q.data.engineStartedAt && (
                    <div style={{ fontSize: 12, color: "var(--mute-2)", marginBottom: 8 }}>{t("engine.sinceRestart", { ago: timeAgo(t, q.data.engineStartedAt) })}</div>
                  )}
                  {groups.map(({ key, rows }) => {
                    const collapsible = key === "internal";
                    const open = !collapsible || internalOpen;
                    return (
                      <section key={key} style={{ marginBottom: 16 }}>
                        {collapsible ? (
                          <button type="button" onClick={() => setInternalOpen((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
                            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <GroupHeader label={t(`services.${key}`)} count={rows.length} sticky={false} />
                          </button>
                        ) : (
                          <GroupHeader label={t(`services.${key}`)} count={rows.length} sticky={false} />
                        )}
                        {open && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "var(--list-card-gap)", marginTop: 6 }}>
                            {rows.map((r) => (
                              <OverviewRowCard key={r.id} row={r} selected={selected === r.id} onClick={() => setSelected(r.id)} />
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </>
              ) : null}
            </div>
          )}
          {selected && (
            <div className="min-h-0" style={{ width: isMobile ? "100%" : 420, maxWidth: "100%", flexShrink: 0 }}>
              <DiaryPanel key={selected} automationId={selected} onClose={() => setSelected(null)} />
            </div>
          )}
        </div>
      </div>
    </CrmShell>
  );
}
