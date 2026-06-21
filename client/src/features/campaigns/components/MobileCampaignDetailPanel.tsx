import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Campaign, CampaignMetricsHistory } from "@/types/models";
import { MobileSheet } from "@/components/crm/mobile/MobileSheet";
import { useCampaignDetail } from "./useCampaignDetail";
import { CampaignMetricsPanel } from "./CampaignMetricsPanel";
import { CampaignStageEditor } from "./CampaignStageEditor";

/* ── Types ─────────────────────────────────────────────────────────────────── */
type TabId = "summary" | "configurations";

interface MobileCampaignDetailPanelProps {
  campaign: Campaign | null;
  metrics: CampaignMetricsHistory[];
  open: boolean;
  onBack: () => void;
  onSave: (id: number, patch: Record<string, unknown>) => Promise<void>;
}

/* ── Inner content ────────────────────────────────────────────────────────────
   Split out so the data hooks (useCampaignDetail) always receive a non-null
   campaign — the inner component only mounts while the sheet is open. */
function MobileCampaignDetailContent({
  campaign,
  metrics,
  onClose,
  onSave,
}: {
  campaign: Campaign;
  metrics: CampaignMetricsHistory[];
  onClose: () => void;
  onSave: (id: number, patch: Record<string, unknown>) => Promise<void>;
}) {
  const { t } = useTranslation("campaigns");
  const [activeTab, setActiveTab] = useState<TabId>("summary");

  // Same data + inline-edit logic the desktop CampaignDetailView uses.
  const detail = useCampaignDetail(campaign, onSave);

  // Metrics filtered to just this campaign (mirrors CampaignDetailView).
  const campaignMetrics = useMemo(() => {
    const cid = campaign.id || (campaign as any).Id;
    return metrics.filter((m) => Number(m.campaigns_id || (m as any).campaignsId || 0) === cid);
  }, [campaign, metrics]);

  // Re-trigger the summary entrance animation when the campaign changes.
  const [animTrigger, setAnimTrigger] = useState(0);
  useEffect(() => { setAnimTrigger((n) => n + 1); }, [campaign.id, (campaign as any).Id]);

  const tabs: { id: TabId; label: string }[] = [
    { id: "summary",        label: t("tabs.summary") },
    { id: "configurations", label: t("tabs.configurations") },
  ];

  return (
    <>
      {/* Header */}
      <div
        className="border-b border-[var(--line)] flex items-center gap-2 px-3 shrink-0"
        style={{ paddingTop: "0.5rem", paddingBottom: "0.75rem" }}
      >
        <h2 className="flex-1 min-w-0 text-[17px] font-semibold truncate text-foreground">
          {String(campaign.name || t("detail.unnamed"))}
        </h2>
      </div>

      {/* Tab switcher — mirrors the accounts mobile la-seg style. */}
      <div className="px-3 pt-3 pb-1 shrink-0">
        <div className="la-seg la-seg--fill">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`campaign-tab-${tab.id}`}
              className={`la-seg-btn${activeTab === tab.id ? " on" : ""}`}
              style={{ padding: "9px 0", fontSize: 11, letterSpacing: "0.08em" }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content — the real desktop panels, stacked. */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: "var(--bottombar-h)" }}
      >
        <div style={{ padding: activeTab === "configurations" ? "12px 12px 16px" : "4px 0 16px" }}>
          {activeTab === "summary" && (
            <CampaignMetricsPanel
              campaign={campaign}
              allMetrics={campaignMetrics}
              animTrigger={animTrigger}
              localAiSummary={detail.localAiSummary}
              localAiSummaryAt={detail.localAiSummaryAt}
              compact
              onRefreshSummary={detail.refreshAiSummary}
              isRefreshingSummary={detail.refreshingSummary}
            />
          )}
          {activeTab === "configurations" && (
            <CampaignStageEditor
              campaign={campaign}
              isEditing={detail.isEditing}
              draft={detail.draft}
              setDraft={detail.setDraft}
              linkedPrompt={detail.linkedPrompt}
              conversationPrompts={detail.conversationPrompts}
              linkedContract={detail.linkedContract}
              compact
              focusField={detail.focusField}
              onStartEditField={detail.startEditForField}
            />
          )}
        </div>
      </div>
    </>
  );
}

/* ── Main Panel Component ─────────────────────────────────────────────────── */
export function MobileCampaignDetailPanel({
  campaign,
  metrics,
  open,
  onBack,
  onSave,
}: MobileCampaignDetailPanelProps) {
  return (
    <MobileSheet
      open={open && !!campaign}
      onClose={onBack}
      data-testid="mobile-campaign-detail-panel"
    >
      {campaign && (
        <MobileCampaignDetailContent
          campaign={campaign}
          metrics={metrics}
          onClose={onBack}
          onSave={onSave}
        />
      )}
    </MobileSheet>
  );
}
