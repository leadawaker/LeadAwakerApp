import { useMemo, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { PauseCircle, ChevronRight } from "lucide-react";
import { SectionCard } from "@/components/crm/primitives";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useIsMobile } from "@/hooks/useIsMobile";
import { SERVICE_ORDER, findEntry, type AutomationService } from "@shared/automationCatalogue";
import type { ClientLine, ClientState } from "@shared/automationTypes";
import { useClientAutomations } from "../api";
import { automationName, reasonLabel, summaryText, timeAgo } from "../labels";
import { goToChangeTarget } from "../changeLinks";
import { SERVICE_ICON } from "../status";
import { DiaryPanel } from "./DiaryPanel";
import "../automation.css";

const STATE_COLOR: Record<ClientState, string> = { on: "var(--good)", off: "var(--mute-2)", always_on: "var(--wine)" };

export function ClientAutomationsTab({ accountId, onOpenTab }: { accountId: number; onOpenTab?: (tab: "integrations" | "communication" | "voice") => void }) {
  const { t } = useTranslation("automation");
  const [, setLocation] = useLocation();
  const { currentAccountId } = useWorkspace();
  const isMobile = useIsMobile();
  const q = useClientAutomations(accountId);
  const [diaryFor, setDiaryFor] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<AutomationService, ClientLine[]>();
    for (const l of q.data?.lines ?? []) {
      const svc = findEntry(l.automationId)?.service;
      if (!svc) continue;
      map.set(svc, [...(map.get(svc) ?? []), l]);
    }
    return SERVICE_ORDER.filter((s) => map.has(s)).map((s) => ({ service: s, lines: map.get(s)! }));
  }, [q.data]);

  const change = (l: ClientLine) => {
    if (!l.change) return;
    if (l.change.kind === "account_tab" && onOpenTab) return onOpenTab(l.change.tab);
    goToChangeTarget(l.change, accountId, setLocation, currentAccountId);
  };

  if (q.isLoading) return <div className="h-[200px] bg-primary/10 rounded-xl animate-pulse" />;
  if (q.error || !q.data) return <div style={{ color: "var(--mute)" }}>{String((q.error as Error)?.message ?? "")}</div>;
  if (q.data.lines.length === 0) return <div style={{ color: "var(--mute)" }}>{t("client.empty")}</div>;

  const totals = q.data.totals;
  const stats = [
    { n: `${totals.on}/${totals.total}`, label: t("client.stat.on"), color: "var(--ink)" },
    { n: totals.actions7d, label: t("client.stat.actions"), color: "var(--ink)" },
    { n: totals.failed7d, label: t("client.stat.failed"), color: totals.failed7d ? "hsl(var(--destructive))" : "var(--ink)" },
  ];

  const list = (
    <div className="am-list" style={{ display: "flex", flexDirection: "column", gap: 16 }} data-testid="client-automations">
      <div style={{ display: "flex", alignItems: "flex-end", gap: 28, flexWrap: "wrap", padding: "2px 2px 0" }}>
        {stats.map((s) => (
          <div key={s.label} className="am-stat">
            <b style={{ color: s.color, fontSize: 28 }}>{s.n}</b>
            <span className="am-mono" style={{ fontSize: 10.5 }}>{s.label}</span>
          </div>
        ))}
        <span className="am-mono" style={{ marginLeft: "auto", color: "var(--mute-2)" }}>{t("client.lastDays")}</span>
      </div>

      {groups.map(({ service, lines }) => {
        const Icon = SERVICE_ICON[service];
        const onCount = lines.filter((l) => l.state !== "off").length;
        return (
          <SectionCard key={service} padded={false} className="overflow-hidden">
            <div className="am-section-head">
              <span className="am-icon-tile"><Icon className="h-4 w-4" /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="am-section-title">{t(`services.${service}`)}</div>
                <div style={{ fontSize: 12.5, color: "var(--mute)", marginTop: 1 }}>{t(`serviceBlurb.${service}`)}</div>
              </div>
              <span className="am-mono">{t("client.onOf", { on: onCount, total: lines.length })}</span>
            </div>
            {lines.map((l) => {
              const c = l.counts7d;
              const total = c.success + c.failed + c.skipped;
              const summary = summaryText(t, l.summary);
              const linkable = !!l.change && !(l.change.kind === "settings_account" && currentAccountId !== accountId);
              const selected = diaryFor === l.automationId;
              return (
                <div
                  key={`${l.automationId}-${l.campaignId ?? "acct"}`}
                  role="button"
                  tabIndex={0}
                  className={`am-row am-crow${selected ? " is-selected" : ""}`}
                  onClick={() => setDiaryFor(l.automationId)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDiaryFor(l.automationId); } }}
                  aria-pressed={selected}
                >
                  <span className="am-state" style={{ "--am-dot": STATE_COLOR[l.state] } as CSSProperties}>
                    <span className={`am-dot${l.state === "off" ? " am-dot--hollow" : ""}`} />
                    {t(`client.state.${l.state}`)}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="am-name">{automationName(t, l.automationId)}</div>
                    {l.campaignName && <div className="am-desc" style={{ color: "var(--mute-2)" }}>{l.campaignName}</div>}
                    {summary && <div className="am-desc" style={{ whiteSpace: "normal" }}>{summary}</div>}
                    {c.failed > 0 && c.topFailureReason && (
                      <div className="am-error">{t("client.topReason", { reason: reasonLabel(t, c.topFailureReason) })}</div>
                    )}
                    {l.warning && (
                      <div style={{ fontSize: 12, color: "var(--mute)", marginTop: 4, display: "flex", gap: 6, alignItems: "center" }}>
                        <PauseCircle className="h-3.5 w-3.5 shrink-0" />{t(`client.warning.${l.warning.key}`, { count: l.warning.count })}
                      </div>
                    )}
                    {l.change?.kind === "settings_account" && !linkable && (
                      <div style={{ fontSize: 12, color: "var(--mute-2)", marginTop: 4 }}>{t("client.changeHintAccount")}</div>
                    )}
                  </div>
                  <div className={`am-num${total === 0 ? " zero" : ""}`} title={t("client.counts7d", { success: c.success, failed: c.failed, skipped: c.skipped })}>
                    {l.state === "off" && total === 0 ? "" : total}
                    {c.failed > 0 && <div className="bad" style={{ fontSize: 11 }}>{t("row.failedBadge", { count: c.failed })}</div>}
                  </div>
                  <div className="am-col-when am-mono" style={{ textAlign: "right" }}>
                    {c.lastActionAt ? timeAgo(t, c.lastActionAt) : ""}
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    {linkable ? (
                      <button type="button" className="la-btn la-btn--soft" onClick={(e) => { e.stopPropagation(); change(l); }}>
                        {t("client.change")}
                      </button>
                    ) : (
                      <ChevronRight className="am-chev h-4 w-4" />
                    )}
                  </div>
                </div>
              );
            })}
          </SectionCard>
        );
      })}
    </div>
  );

  if (!diaryFor) return list;
  if (isMobile) return <div style={{ height: "70vh" }}><DiaryPanel automationId={diaryFor} accountId={accountId} onClose={() => setDiaryFor(null)} /></div>;
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
      <div style={{ flex: 1, minWidth: 0 }}>{list}</div>
      <div style={{ width: 400, flexShrink: 0, maxHeight: "75vh", position: "sticky", top: 0, borderRadius: "var(--panel-radius)", overflow: "hidden" }}>
        <DiaryPanel key={diaryFor} automationId={diaryFor} accountId={accountId} onClose={() => setDiaryFor(null)} />
      </div>
    </div>
  );
}
