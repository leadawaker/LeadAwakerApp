// Demos > Settings: the demo campaigns' own settings. Each demo runs on a
// campaign row (is_demo, on the demo account) that the engine reads, and with
// the Campaigns page hidden this is where those rows are edited. It is the one
// campaign settings screen (CampaignStageEditor on useCampaignDetail's draft
// and 1.5s autosave), loaded by id through useCampaignById, the same host
// Accounts > Reactivation uses.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { Campaign } from "@/types/models";
import { fetchCampaigns } from "@/features/campaigns/api/campaignsApi";
import { CampaignStageEditor } from "@/features/campaigns/components/CampaignStageEditor";
import { useCampaignDetail } from "@/features/campaigns/components/useCampaignDetail";
import { campaignQueryKey, useCampaignById } from "@/features/campaigns/hooks/useCampaignById";

// The account the demo campaigns live on. Mirrors DEMO_ACCOUNT_ID in
// server/demo-session.ts.
const DEMO_ACCOUNT_ID = 1;

export interface DemoCampaignRow { id: number; name: string; status: string }

/** Every campaign flagged is_demo on the demo account, read from the list rather than a constant. */
export function useDemoCampaigns() {
  return useQuery<DemoCampaignRow[]>({
    queryKey: ["/api/campaigns", "demo-campaigns", DEMO_ACCOUNT_ID],
    queryFn: async () => {
      const rows: Array<Record<string, any>> = await fetchCampaigns(DEMO_ACCOUNT_ID);
      return rows
        .filter((r) => r.is_demo === true)
        .map((r) => ({ id: Number(r.id ?? r.Id), name: String(r.name ?? ""), status: String(r.status ?? "") }))
        .filter((r) => Number.isSafeInteger(r.id) && r.id > 0)
        .sort((a, b) => a.id - b.id);
    },
    staleTime: 60_000,
  });
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2" style={{ padding: "24px 4px", fontSize: 13, color: "var(--mute)" }}>{children}</div>;
}

/** One demo campaign's full settings, loaded by id. */
export function DemoCampaignSettings({ campaignId }: { campaignId: number }) {
  const { t } = useTranslation("demos");
  const { campaign, loading, error, onSave } = useCampaignById(campaignId);

  if (loading) return <Note><Loader2 className="h-4 w-4 animate-spin" /></Note>;
  if (error || !campaign) return <Note>{t("settings.campaign.loadFailed", { id: campaignId })}</Note>;
  // A different campaign is a different draft.
  return <CampaignBody key={campaign.id} campaign={campaign} onSave={onSave} />;
}

function CampaignBody({ campaign: row, onSave }: {
  campaign: Campaign; onSave: (id: number, patch: Record<string, unknown>) => Promise<void>;
}) {
  const { t } = useTranslation("demos");
  const qc = useQueryClient();
  // Below this width two side menus (services, then the campaign's own) leave
  // the fields too narrow, so the campaign's menu moves above its section.
  const compact = useIsMobile(1440);
  // The row comes with db keys; the settings read account_id (Behavior > Account, Contract).
  const campaign = useMemo(
    () => ({ ...row, account_id: (row as any).account_id ?? (row as any).Accounts_id }) as Campaign,
    [row],
  );
  const detail = useCampaignDetail(campaign, onSave);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }} data-testid={`demo-campaign-${campaign.id}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12.5, color: "var(--mute)" }}>
        <span style={{ fontWeight: 600, color: "var(--ink)" }}>{campaign.name}</span>
        <span>{t("settings.campaign.meta", { id: campaign.id, status: campaign.status ?? "" })}</span>
        <span role="status" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }} data-testid="demo-campaign-save-state">
          {detail.saving ? <Loader2 size={12} className="animate-spin" /> : detail.hasChanges ? null : <Check size={12} />}
          {t(detail.saving ? "settings.campaign.saving" : detail.hasChanges ? "settings.campaign.pending" : "settings.campaign.saved")}
        </span>
      </div>
      <CampaignStageEditor
        campaign={campaign}
        isEditing={detail.isEditing}
        draft={detail.draft}
        setDraft={detail.setDraft}
        applyGeneratedFields={detail.applyGeneratedFields}
        linkedPrompt={detail.linkedPrompt}
        conversationPrompts={detail.conversationPrompts}
        linkedContract={detail.linkedContract}
        compact={compact}
        focusField={detail.focusField}
        onStartEditField={detail.startEditForField}
        onGenerated={() => { void qc.invalidateQueries({ queryKey: campaignQueryKey(campaign.id) }); }}
      />
    </div>
  );
}

/** The demo campaigns no service tile claims, with a picker when there is more than one. */
export function OtherDemoCampaigns({ campaigns, value, onChange }: {
  campaigns: DemoCampaignRow[]; value: number | undefined; onChange: (id: number) => void;
}) {
  const { t } = useTranslation("demos");
  if (campaigns.length === 0) return <Note>{t("settings.campaigns.none")}</Note>;
  const current = campaigns.find((c) => c.id === value) ?? campaigns[0]!;
  return (
    <>
      {campaigns.length > 1 && (
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--ink)" }}>
          <span style={{ fontWeight: 600 }}>{t("settings.campaigns.pick")}</span>
          <select className="la-input" style={{ maxWidth: 320 }} value={current.id} onChange={(e) => onChange(Number(e.target.value))} data-testid="demo-campaign-picker">
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name || `#${c.id}`}</option>)}
          </select>
        </label>
      )}
      <DemoCampaignSettings campaignId={current.id} />
    </>
  );
}
