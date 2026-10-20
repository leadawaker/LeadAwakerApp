import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { SectionCard } from "@/components/crm/primitives";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useIsMobile } from "@/hooks/useIsMobile";
import { SERVICE_ORDER, findEntry, type AutomationService } from "@shared/automationCatalogue";
import type { ClientLine } from "@shared/automationTypes";
import { useClientAutomations } from "../api";
import { goToChangeTarget } from "../changeLinks";
import { SERVICE_ICON } from "../status";
import { DiaryPanel } from "./DiaryPanel";
import { AutomationRail, railPanelId, type RailKey } from "./AutomationRail";
import { ClearFailuresButton } from "./ClearFailuresButton";
import { ClientLineRow } from "./ClientLineRow";
import "../automation.css";

export function ClientAutomationsTab({ accountId, onOpenTab }: { accountId: number; onOpenTab?: (tab: "integrations" | "communication" | "voice") => void }) {
  const { t } = useTranslation("automation");
  const [, setLocation] = useLocation();
  const { currentAccountId } = useWorkspace();
  const isMobile = useIsMobile();
  const q = useClientAutomations(accountId);
  const [diaryFor, setDiaryFor] = useState<string | null>(null);
  const [picked, setPicked] = useState<RailKey | null>(null);

  const groups = useMemo(() => {
    const map = new Map<AutomationService, ClientLine[]>();
    for (const l of q.data?.lines ?? []) {
      const svc = findEntry(l.automationId)?.service;
      if (!svc) continue;
      map.set(svc, [...(map.get(svc) ?? []), l]);
    }
    return SERVICE_ORDER.filter((s) => map.has(s)).map((s) => ({
      service: s,
      lines: map.get(s)!,
      failures: map.get(s)!.reduce((n, l) => n + l.counts7d.failed, 0),
    }));
  }, [q.data]);

  // The picked category, else the first one with open failures, else the first.
  const active = groups.find((g) => g.service === picked) ?? groups.find((g) => g.failures > 0) ?? groups[0];

  const change = (l: ClientLine) => {
    if (!l.change) return;
    if (l.change.kind === "account_tab" && onOpenTab) return onOpenTab(l.change.tab);
    goToChangeTarget(l.change, accountId, setLocation, currentAccountId);
  };

  if (q.isLoading) return <div className="h-[200px] bg-primary/10 rounded-xl animate-pulse" />;
  if (q.error || !q.data) return <div style={{ color: "var(--mute)" }}>{String((q.error as Error)?.message ?? "")}</div>;
  if (q.data.lines.length === 0 || !active) return <div style={{ color: "var(--mute)" }}>{t("client.empty")}</div>;

  const totals = q.data.totals;
  const stats = [
    { n: `${totals.on}/${totals.total}`, label: t("client.stat.on"), color: "var(--ink)" },
    { n: totals.actions7d, label: t("client.stat.actions"), color: "var(--ink)" },
    { n: totals.failed7d, label: t("client.stat.failed"), color: totals.failed7d ? "hsl(var(--destructive))" : "var(--ink)" },
  ];

  const railItems = groups.map((g) => ({
    key: g.service,
    detail: t("client.onOf", { on: g.lines.filter((l) => l.state !== "off").length, total: g.lines.length }),
    failures: g.failures,
  }));

  const selectCategory = (key: RailKey) => { setPicked(key); setDiaryFor(null); };

  const Icon = SERVICE_ICON[active.service];
  const onCount = active.lines.filter((l) => l.state !== "off").length;
  const section = (
    <SectionCard key={active.service} padded={false} className="overflow-hidden" id={railPanelId(active.service)} role="tabpanel">
      <div className="am-section-head" style={{ flexWrap: "wrap" }}>
        <span className="am-icon-tile"><Icon className="h-4 w-4" /></span>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div className="am-section-title">{t(`services.${active.service}`)}</div>
          <div style={{ fontSize: 12.5, color: "var(--mute)", marginTop: 1 }}>{t(`serviceBlurb.${active.service}`)}</div>
        </div>
        <ClearFailuresButton count={active.failures} scope={{ automationIds: active.lines.map((l) => l.automationId), accountId }} />
        <span className="am-mono">{t("client.onOf", { on: onCount, total: active.lines.length })}</span>
      </div>
      {active.lines.map((l) => (
        <ClientLineRow
          key={`${l.automationId}-${l.campaignId ?? "acct"}`}
          line={l}
          selected={diaryFor === l.automationId}
          linkable={!!l.change && !(l.change.kind === "settings_account" && currentAccountId !== accountId)}
          onOpen={() => setDiaryFor(l.automationId)}
          onChange={() => change(l)}
        />
      ))}
    </SectionCard>
  );

  const statsRow = (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 28, flexWrap: "wrap", padding: "2px 2px 0" }}>
      {stats.map((s) => (
        <div key={s.label} className="am-stat">
          <b style={{ color: s.color, fontSize: 28 }}>{s.n}</b>
          <span className="am-mono" style={{ fontSize: 10.5 }}>{s.label}</span>
        </div>
      ))}
      <span className="am-mono" style={{ marginLeft: "auto", color: "var(--mute-2)" }}>{t("client.lastDays")}</span>
    </div>
  );

  if (isMobile) {
    if (diaryFor) return <div style={{ height: "70vh" }}><DiaryPanel automationId={diaryFor} accountId={accountId} onClose={() => setDiaryFor(null)} /></div>;
    return (
      <div className="am-list" style={{ display: "flex", flexDirection: "column", gap: 16 }} data-testid="client-automations">
        {statsRow}
        <AutomationRail items={railItems} active={active.service} onSelect={selectCategory} layout="grid" />
        {section}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }} data-testid="client-automations">
      {statsRow}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ width: 232, flexShrink: 0 }}>
          <AutomationRail items={railItems} active={active.service} onSelect={selectCategory} layout="rail" />
        </div>
        <div className="am-list" style={{ flex: 1, minWidth: 0 }}>{section}</div>
        {diaryFor && (
          <div style={{ width: 380, flexShrink: 0, maxHeight: "75vh", position: "sticky", top: 0, borderRadius: "var(--panel-radius)", overflow: "hidden" }}>
            <DiaryPanel key={diaryFor} automationId={diaryFor} accountId={accountId} onClose={() => setDiaryFor(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
