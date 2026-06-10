import { useTranslation } from "react-i18next";
import type { Campaign } from "@/types/models";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/avatarUtils";
import { CAMPAIGN_STICKERS } from "@/assets/campaign-stickers/index";

function getCampaignId(c: Campaign): number {
  return c.id || (c as any).Id || 0;
}
function getLeadCount(c: Campaign): number {
  return Number(c.total_leads_targeted ?? (c as any).Leads ?? 0);
}
function getResponseRate(c: Campaign): number {
  return Number(c.response_rate_percent ?? 0);
}

export function CampaignListCard({
  campaign,
  isActive,
  onClick,
}: {
  campaign: Campaign;
  isActive: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation("campaigns");
  const name = String(campaign.name || t("detail.unnamed"));
  const initials = getInitials(name);
  const status = String(campaign.status || "");
  const leads = getLeadCount(campaign);
  const responseRate = getResponseRate(campaign);
  const bookings = Number(campaign.bookings_generated ?? 0);
  const accountName = campaign.account_name || "";
  const cid = getCampaignId(campaign);

  const statusClass =
    status === "Active" ? "active-s"
    : status === "Paused" ? "paused"
    : "inactive";
  const statusLabel = t(`statusLabels.${status}`, status) || t("statusLabels.Unknown");

  const tileClass = status === "Active" || isActive ? "wine"
    : status === "Inactive" || status === "Draft" ? "inactive"
    : "";

  const campaignStickerSlug = campaign.campaign_sticker ?? null;
  const campaignSticker = campaignStickerSlug
    ? CAMPAIGN_STICKERS.find(s => s.slug === campaignStickerSlug) ?? null
    : null;
  const isGrayscale = status === "Inactive";

  const createdAt: string | null = (campaign as any).createdAt ?? (campaign as any).created_at ?? null;
  const startAt: string | null = campaign.start_date ?? createdAt;
  const daysRunning = (status === "Active" && startAt)
    ? Math.max(0, Math.floor((Date.now() - new Date(startAt).getTime()) / 86_400_000))
    : null;
  const createdLabel = daysRunning !== null
    ? `Running ${daysRunning}d`
    : createdAt
    ? new Date(createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
    : null;

  return (
    <div
      className={`la-camp-card group${isActive ? " active" : ""}`}
      style={{ flexDirection: "column", alignItems: "stretch", gap: 'var(--space-xs)' }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        {campaignSticker ? (
          <div className="la-mono-tile" style={{ overflow: "hidden", padding: 0 }}>
            <img
              src={campaignSticker.url}
              alt=""
              className="h-full w-full object-contain"
              style={isGrayscale ? { filter: "grayscale(1) opacity(0.45)" } : undefined}
            />
          </div>
        ) : (
          <div className={`la-mono-tile ${tileClass}`}>{initials}</div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 600, color: "var(--ink)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            marginBottom: 'var(--space-xxs)',
          }}>
            {name}
          </div>

          <div className="row" style={{ gap: 'var(--space-xs)', marginBottom: 6 }}>
            <span className={`la-status ${statusClass}`}>
              <span className="dot" />{statusLabel}
            </span>
            {cid > 0 && (
              <span style={{
                fontFamily: "'Geist Mono', ui-monospace, monospace",
                fontSize: 10, color: "var(--mute-2)", letterSpacing: "0.1em",
              }}>
                #{cid}
              </span>
            )}
          </div>

          {accountName && (
            <div className="row" style={{ gap: 5, fontSize: 11, color: "var(--mute)" }}>
              <span className="dot" style={{ background: "var(--mute-2)" }} />
              {accountName}
            </div>
          )}
        </div>
      </div>

      {!campaign.is_demo && (
      <div className={cn(
        "opacity-100 max-h-[72px] md:opacity-0 md:max-h-0 md:group-hover:opacity-100 md:group-hover:max-h-[72px]",
        "transition-[opacity,max-height] duration-200 flex flex-col gap-1 overflow-hidden"
      )}>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1,
          borderRadius: "var(--r-button)", overflow: "hidden",
          background: isActive ? "var(--warn-tint)" : "var(--line)",
        }}>
          {([
            { label: t("card.leads"),    value: leads > 0        ? leads.toLocaleString()   : "—", booked: false },
            { label: t("card.response"), value: responseRate > 0 ? `${responseRate}%`        : "—", booked: false },
            { label: t("card.booked"),   value: bookings > 0     ? bookings.toLocaleString() : "—", booked: true  },
          ] as const).map((stat) => (
            <div
              key={stat.label}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                padding: "6px 0",
                background: isActive ? "hsl(var(--highlight-selected))" : "var(--card)",
              }}
            >
              <span style={{
                fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.15,
                color: stat.booked && bookings > 0 ? "var(--good)" : "var(--ink)",
                fontSize: stat.booked && bookings > 0 ? 15 : 13,
              }}>{stat.value}</span>
              <span style={{
                fontSize: 9, color: "var(--mute)", textTransform: "uppercase",
                letterSpacing: "0.05em", marginTop: 2,
              }}>{stat.label}</span>
            </div>
          ))}
        </div>

        {createdLabel && (
          <div style={{ paddingLeft: 'var(--space-xxs)' }}>
            <span style={{ fontSize: 10, color: "var(--mute)", fontVariantNumeric: "tabular-nums" }}>
              {daysRunning !== null ? createdLabel : t("card.started", { date: createdLabel })}
            </span>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

export function GroupHeader({ label, count, isFirst }: { label: string; count: number; isFirst?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: isFirst ? '8px 17px 2px' : '12px 17px 2px' }}
      data-group-header="true">
      {!isFirst && <div className="rule" />}
      <span className="eyebrow eyebrow-sm">{label} — {count}</span>
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="space-y-0 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3.5 rounded-lg animate-pulse"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="h-10 w-10 rounded-full bg-foreground/10 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-foreground/10 rounded-full w-2/3" />
            <div className="h-2.5 bg-foreground/8 rounded-full w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
