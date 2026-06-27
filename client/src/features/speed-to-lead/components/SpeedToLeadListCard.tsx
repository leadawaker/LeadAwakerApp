import { useTranslation } from "react-i18next";
import { getInitials } from "@/lib/avatarUtils";
import { getSpeedToLeadMetrics, type SpeedToLeadCampaign } from "../data/mockMetrics";

function statusClass(status: SpeedToLeadCampaign["status"]) {
  if (status === "active") return "active-s";
  if (status === "paused") return "paused";
  return "draft";
}

/**
 * Left-toolbar card for a Speed-to-Lead campaign. Mirrors CampaignListCard's
 * `.la-camp-card` markup (mono tile, name, status pill, #id, account, hover
 * metrics) but reads the mock per-campaign metrics for its hover stats.
 */
export function SpeedToLeadListCard({
  campaign,
  isActive,
  onClick,
}: {
  campaign: SpeedToLeadCampaign;
  isActive: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation("speedToLead");
  const initials = getInitials(campaign.name);
  const m = getSpeedToLeadMetrics(campaign.id);
  const tileClass = campaign.status === "active" || isActive ? "wine" : campaign.status === "draft" ? "inactive" : "";

  const stats = [
    { label: t("card.median"), value: m.medianLabel },
    { label: t("card.leads"), value: m.totalLeads[0].value.toLocaleString() },
    { label: t("card.whatsapp"), value: `${m.dominantChannelPct}%` },
  ];

  return (
    <div
      className={`la-camp-card group${isActive ? " active" : ""}`}
      style={{ flexDirection: "column", alignItems: "stretch", gap: "var(--space-xs)" }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      data-campaign-id={campaign.id}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <div className={`la-mono-tile ${tileClass}`} style={campaign.hue ? { filter: `hue-rotate(${campaign.hue}deg)` } : undefined}>
          {initials}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="text-[14px] max-md:text-[16px]"
            style={{
              fontWeight: 600, color: "var(--ink)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              marginBottom: "var(--space-xxs)",
            }}
          >
            {campaign.name}
          </div>

          <div className="row" style={{ gap: "var(--space-xs)", marginBottom: 6 }}>
            <span className={`la-status ${statusClass(campaign.status)}`}>
              <span className="dot" />{t(`meta.statusValues.${campaign.status}`)}
            </span>
            <span style={{ fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 10, color: "var(--mute-2)", letterSpacing: "0.1em" }}>
              #{campaign.id}
            </span>
          </div>

          <div className="row text-[11px] max-md:text-[13px]" style={{ gap: 5, color: "var(--mute)" }}>
            <span className="dot" style={{ background: "var(--mute-2)" }} />
            {campaign.accountName}
          </div>
        </div>
      </div>

      <div className="hidden md:flex md:opacity-0 md:max-h-0 md:group-hover:opacity-100 md:group-hover:max-h-[72px] transition-[opacity,max-height] duration-200 flex-col gap-1 overflow-hidden">
        <div
          style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1,
            borderRadius: "var(--r-button)", overflow: "hidden",
            background: isActive ? "var(--warn-tint)" : "var(--line)",
          }}
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                padding: "6px 0",
                background: isActive ? "hsl(var(--highlight-selected))" : "var(--card)",
              }}
            >
              <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.15, color: "var(--ink)", fontSize: 13 }}>
                {stat.value}
              </span>
              <span style={{ fontSize: 9, color: "var(--mute)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
