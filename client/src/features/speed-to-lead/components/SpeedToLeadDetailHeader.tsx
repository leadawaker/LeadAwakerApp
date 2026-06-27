import { useTranslation } from "react-i18next";
import { Zap, MessageCircle, Mail, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/avatarUtils";
import type { SpeedToLeadCampaign } from "../data/mockMetrics";

const CHANNEL_ICON: Record<string, typeof MessageCircle> = {
  whatsapp: MessageCircle,
  emailFallback: Mail,
};

function statusClass(status: SpeedToLeadCampaign["status"]) {
  if (status === "active") return "active-s";
  if (status === "paused") return "paused";
  return "draft";
}

/**
 * Selected-campaign header mirroring the campaigns DetailViewHeader: status
 * eyebrow + avatar + editable-looking serif name, with four config metachips
 * (Status · Response Target · Primary Channel · Fallback Channel).
 */
export function SpeedToLeadDetailHeader({ campaign }: { campaign: SpeedToLeadCampaign }) {
  const { t } = useTranslation("speedToLead");
  const PrimaryIcon = CHANNEL_ICON[campaign.primaryChannel] ?? MessageCircle;
  const FallbackIcon = CHANNEL_ICON[campaign.fallbackChannel] ?? Mail;

  const renderMetaChip = (label: string, value: React.ReactNode, icon?: React.ReactNode) => (
    <div>
      <div className="eyebrow eyebrow-sm" style={{ color: "var(--mute)" }}>{label}</div>
      <div className="flex items-center gap-1.5" style={{ fontSize: 13, color: "var(--ink)", marginTop: 5 }}>
        {icon}
        {value}
      </div>
    </div>
  );

  return (
    <>
      {/* Eyebrow: status pill + SPEED-TO-LEAD · #N */}
      <div className="flex items-center gap-3 mb-3" data-testid="speed-to-lead-detail-status">
        <span className={cn("la-status", statusClass(campaign.status))}>
          <span className="dot" />
          {t(`meta.statusValues.${campaign.status}`)}
        </span>
        <span style={{ fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 10, color: "var(--mute)", letterSpacing: "0.18em", textTransform: "uppercase" }}>
          {t("detail.label")} · #{campaign.id}
        </span>
      </div>

      {/* Title row: avatar + name */}
      <div className="relative flex items-center gap-4">
        <div className="la-mono-tile wine shrink-0" style={{ width: 52, height: 52, fontSize: 21 }}>
          {getInitials(campaign.name) || <Zap className="w-5 h-5" />}
        </div>

        <div className="flex-1 min-w-0">
          <h2
            className="text-[26px] md:text-[40px] font-normal leading-none truncate"
            style={{ fontFamily: "var(--serif)", color: "var(--ink)", letterSpacing: "-0.018em" }}
            data-testid="speed-to-lead-detail-name"
          >
            {campaign.name}
          </h2>
        </div>

        {/* Meta chips */}
        <div className="flex flex-wrap items-center justify-end shrink-0 ml-auto" style={{ gap: 28, rowGap: 12 }}>
          {renderMetaChip(t("meta.status"), t(`meta.statusValues.${campaign.status}`))}
          {renderMetaChip(
            t("meta.responseTarget"),
            t("meta.responseTargetValue", { seconds: campaign.responseTargetSec }),
            <Clock size={16} style={{ color: "var(--ink-soft)" }} />,
          )}
          {renderMetaChip(
            t("meta.primaryChannel"),
            t(`channels.${campaign.primaryChannel}`),
            <PrimaryIcon size={16} style={{ color: "var(--good)" }} />,
          )}
          {renderMetaChip(
            t("meta.fallbackChannel"),
            t(`channels.${campaign.fallbackChannel}`),
            <FallbackIcon size={16} style={{ color: "var(--warn)" }} />,
          )}
        </div>
      </div>
    </>
  );
}
