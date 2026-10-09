import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { AlertTriangle } from "lucide-react";
import { ListCard, Pill, GroupHeader } from "@/components/crm/primitives";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useIsMobile } from "@/hooks/useIsMobile";
import { SERVICE_ORDER, findEntry, type AutomationService } from "@shared/automationCatalogue";
import type { ClientLine, ClientState } from "@shared/automationTypes";
import { useClientAutomations } from "../api";
import { automationName, summaryText, timeAgo } from "../labels";
import { goToChangeTarget } from "../changeLinks";
import { DiaryPanel } from "./DiaryPanel";

const STATE_COLOR: Record<ClientState, string> = { on: "var(--good)", off: "var(--mute)", always_on: "var(--wine)" };

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
  const list = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }} data-testid="client-automations">
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 600, color: "var(--ink)" }}>{t("client.header", { on: totals.on, total: totals.total, actions: totals.actions7d, failed: totals.failed7d })}</span>
        <span style={{ fontSize: 12, color: "var(--mute-2)" }}>{t("client.lastDays")}</span>
      </div>
      {groups.map(({ service, lines }) => (
        <section key={service}>
          <GroupHeader label={t(`services.${service}`)} count={lines.length} sticky={false} />
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--list-card-gap)", marginTop: 6 }}>
            {lines.map((l) => {
              const c = l.counts7d;
              const summary = summaryText(t, l.summary);
              const linkable = !!l.change && !(l.change.kind === "settings_account" && currentAccountId !== accountId);
              return (
                <ListCard key={`${l.automationId}-${l.campaignId ?? "acct"}`} selected={diaryFor === l.automationId} onClick={() => setDiaryFor(l.automationId)} role="button" tabIndex={0}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <Pill color={STATE_COLOR[l.state]} tone={l.state === "off" ? "soft" : "solid"} style={{ minWidth: 72, justifyContent: "center" }}>{t(`client.state.${l.state}`)}</Pill>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                        <span style={{ fontWeight: 600, color: "var(--ink)" }}>{automationName(t, l.automationId)}</span>
                        {l.campaignName && <span style={{ fontSize: 12, color: "var(--mute)" }}>{l.campaignName}</span>}
                      </div>
                      {summary && <div style={{ fontSize: 13, color: "var(--mute)", marginTop: 2 }}>{summary}</div>}
                      {l.state !== "off" && (
                        <div style={{ fontSize: 12, color: "var(--mute-2)", marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <span>{t("client.counts7d", { success: c.success, failed: c.failed, skipped: c.skipped })}</span>
                          {c.lastActionAt && <span>{t("row.lastAction", { ago: timeAgo(t, c.lastActionAt) })}</span>}
                        </div>
                      )}
                      {c.failed > 0 && c.topFailureReason && (
                        <div style={{ fontSize: 12, color: "var(--destructive)", marginTop: 3 }}>{t("client.topReason", { reason: c.topFailureReason })}</div>
                      )}
                      {l.warning && (
                        <div style={{ fontSize: 12, color: "var(--warn)", marginTop: 3, display: "flex", gap: 6, alignItems: "center" }}>
                          <AlertTriangle className="h-3.5 w-3.5" />{t(`client.warning.${l.warning.key}`, { count: l.warning.count })}
                        </div>
                      )}
                      {l.change?.kind === "settings_account" && !linkable && (
                        <div style={{ fontSize: 12, color: "var(--mute-2)", marginTop: 3 }}>{t("client.changeHintAccount")}</div>
                      )}
                    </div>
                    {linkable && (
                      <button type="button" className="la-btn la-btn--soft" onClick={(e) => { e.stopPropagation(); change(l); }}>
                        {t("client.change")} →
                      </button>
                    )}
                  </div>
                </ListCard>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );

  if (!diaryFor) return list;
  if (isMobile) return <div style={{ height: "70vh" }}><DiaryPanel automationId={diaryFor} accountId={accountId} onClose={() => setDiaryFor(null)} /></div>;
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
      <div style={{ flex: 1, minWidth: 0 }}>{list}</div>
      <div style={{ width: 380, flexShrink: 0, maxHeight: "75vh", position: "sticky", top: 0 }}>
        <DiaryPanel key={diaryFor} automationId={diaryFor} accountId={accountId} onClose={() => setDiaryFor(null)} />
      </div>
    </div>
  );
}
