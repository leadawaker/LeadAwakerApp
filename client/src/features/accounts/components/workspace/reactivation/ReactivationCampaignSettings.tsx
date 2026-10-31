// One reactivation campaign (Accounts > Reactivation and Chats > Settings >
// Reactivation): a bar with the picker, its status, launch readiness and the
// Activate / Pause switch, then its settings in sections (ReactivationSections,
// laid out like Speed to Lead). Edits go through useCampaignDetail's draft and 1.5s autosave,
// like on the Campaigns page. The status switch writes the same draft field the
// Behavior section's Status select does, so the two never disagree.
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Pause, Play, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Campaign } from "@/types/models";
import { useCampaignDetail } from "@/features/campaigns/components/useCampaignDetail";
import { ReactivationSections } from "./ReactivationSections";
import { CampaignPreflight } from "@/features/campaigns/components/detailView/CampaignPreflight";
import { fetchCampaignPreflight } from "@/features/campaigns/api/campaignsApi";
import type { ReactivationSection } from "./reactivationLink";

const noSave = async () => {};

function statusClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "active") return "active-s";
  if (s === "paused" || s === "draft") return "paused";
  return "inactive";
}

export function ReactivationCampaignSettings({ campaign, onSave, readOnly, compact, initialSection, leading, trailing }: {
  campaign: Campaign;
  onSave: (id: number, patch: Record<string, unknown>) => Promise<void>;
  readOnly: boolean;
  compact: boolean;
  initialSection?: ReactivationSection;
  /** Left of the status (the campaign picker). */
  leading?: ReactNode;
  /** Right end of the bar (New campaign). */
  trailing?: ReactNode;
}) {
  const { t } = useTranslation("accounts");
  const { t: tc } = useTranslation("campaigns");
  const { toast } = useToast();
  const detail = useCampaignDetail(campaign, readOnly ? noSave : onSave);
  const campaignId = Number(campaign.id || (campaign as any).Id);
  const status = String(detail.draft.status || campaign.status || "Draft");
  const isActive = status.toLowerCase() === "active";
  const [checking, setChecking] = useState(false);
  // The sections read account_id (the row comes with db keys).
  const row = useMemo(() => ({ ...campaign, account_id: (campaign as any).account_id ?? (campaign as any).Accounts_id }), [campaign]);

  // Same rule as the Campaigns page: activation is blocked while a critical
  // launch check fails (the server refuses it too), so the switch never shows
  // an Active that snaps back.
  const toggleStatus = async () => {
    const next = isActive ? "Paused" : "Active";
    if (next === "Active") {
      setChecking(true);
      try {
        const { ready, checks } = await fetchCampaignPreflight(campaignId);
        if (!ready) {
          const blockers = checks
            .filter((c) => c.critical && c.status === "error")
            .map((c) => tc(`preflight.checks.${c.key}`, c.key, c.count !== undefined ? { count: c.count } : undefined));
          toast({ variant: "destructive", title: tc("preflight.blockedTitle"), description: blockers.join(" · ") });
          return;
        }
      } catch {
        // The check itself failed: the server guard still protects the save.
      } finally {
        setChecking(false);
      }
    }
    detail.setDraft((d) => ({ ...d, status: next }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }} data-testid="reactivation-campaign">
      <div className="flex flex-wrap items-center gap-3">
        {leading}
        <span className={`la-status ${statusClass(status)}`} data-testid="reactivation-campaign-status">
          <span className="dot" />
          {tc(`statusLabels.${status}`, status)}
        </span>
        {campaignId > 0 && (
          <CampaignPreflight
            campaignId={campaignId}
            refreshKey={campaign.status}
            t={(key, fallback, opts) => tc(key, fallback ?? key, opts) as string}
          />
        )}
        {detail.saving && (
          <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: "var(--mute)" }}>
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            {t("reactivationTab.saving")}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {!readOnly && (
            <button
              type="button"
              className="la-btn la-btn--soft"
              onClick={toggleStatus}
              disabled={checking}
              data-testid="reactivation-campaign-toggle"
            >
              {checking ? <Loader2 size={14} className="animate-spin" /> : isActive ? <Pause size={14} /> : <Play size={14} />}
              {isActive ? t("reactivationTab.pause") : t("reactivationTab.activate")}
            </button>
          )}
          {trailing}
        </div>
      </div>

      <ReactivationSections
        key={campaignId}
        campaign={row}
        detail={detail}
        canEdit={!readOnly}
        stacked={compact}
        status={tc(`statusLabels.${status}`, status)}
        initialSection={initialSection}
      />
    </div>
  );
}
