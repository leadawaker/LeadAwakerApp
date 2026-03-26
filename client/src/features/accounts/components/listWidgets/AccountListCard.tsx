import { useTranslation } from "react-i18next";
import { Mail, Phone, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials, getAccountAvatarColor, ACCOUNT_STATUS_HEX } from "@/lib/avatarUtils";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import type { AccountRow } from "../AccountDetailsDialog";
import { STATUS_I18N_KEY, formatRelativeTime } from "./accountListConstants";

export function AccountListCard({
  account,
  isActive,
  onClick,
  campaignNames,
  leadCount,
}: {
  account: AccountRow;
  isActive: boolean;
  onClick: () => void;
  campaignNames: string[];
  leadCount: number | null;
}) {
  const { t } = useTranslation("accounts");
  const name = String(account.name || t("detail.unnamedAccount"));
  const initials = getInitials(name);
  const status = String(account.status || "");
  const avatarColor = getAccountAvatarColor(status);
  const statusHex = ACCOUNT_STATUS_HEX[status] || "#94A3B8";
  const lastUpdated = account.updated_at || account.created_at;
  const email = String(account.owner_email || "");
  const phone = String((account as any).phone || "");
  const niche = String(account.business_niche || "");
  const timezone = String(account.timezone || "");
  const type = String(account.type || "");

  const hasHoverContent = !!(email || phone || niche || timezone || campaignNames.length > 0);

  // Campaign pills: max 3 visible, then "+N more"
  const visibleCampaigns = campaignNames.slice(0, 3);
  const extraCount = campaignNames.length - visibleCampaigns.length;

  return (
    <div
      className={cn(
        "group rounded-xl cursor-pointer",
        "transition-[background-color,box-shadow] duration-150 ease-out",
        "hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
        isActive ? "bg-highlight-selected" : "bg-card hover:bg-card-hover"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      data-testid="account-mobile-card"
    >
      <div className="px-3 pt-3 pb-2.5 flex flex-col gap-2">

        {/* Top row: Avatar + Name + Type badge */}
        <div className="flex items-start gap-2.5">
          <EntityAvatar
            name={name}
            photoUrl={account.logo_url}
            bgColor={avatarColor.bg}
            textColor={avatarColor.text}
          />
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-start justify-between gap-1.5">
              <p className="text-[18px] font-semibold font-heading leading-tight truncate text-foreground">
                {name}
              </p>
              {type && (
                <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-black/[0.07] text-foreground/40 mt-0.5 whitespace-nowrap">
                  {type}
                </span>
              )}
            </div>
            {/* Status dot + label + lead count + last updated — one compact line */}
            <div className="flex items-center justify-between gap-1 mt-[3px]">
              <div className="flex items-center gap-1 min-w-0">
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: statusHex }}
                />
                <span className="text-[11px] text-muted-foreground truncate">{status ? t(STATUS_I18N_KEY[status] ?? status) : t("status.unknown")}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {leadCount !== null && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/50" data-testid="account-card-lead-count">
                    <Users className="h-3 w-3" />
                    <span className="tabular-nums">{leadCount}</span>
                  </span>
                )}
                {lastUpdated && (
                  <span className="text-[10px] text-muted-foreground/45 tabular-nums">
                    {formatRelativeTime(lastUpdated)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Hover-reveal: niche + timezone + email + phone + campaign pills */}
        {hasHoverContent && (
          <div className="overflow-hidden max-h-0 opacity-0 group-hover:max-h-[80px] group-hover:opacity-100 transition-[max-height,opacity] duration-200 ease-out">
            <div className="flex flex-col gap-1.5 pt-1.5 border-t border-black/[0.06]">
              {/* Niche + timezone */}
              {(niche || timezone) && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {niche && (
                    <span className="text-[10px] text-foreground/40 truncate">{niche}</span>
                  )}
                  {niche && timezone && (
                    <span className="text-[10px] text-foreground/25 shrink-0">&middot;</span>
                  )}
                  {timezone && (
                    <span className="text-[10px] text-foreground/40 truncate">{timezone}</span>
                  )}
                </div>
              )}
              {/* Email + phone row */}
              {(email || phone) && (
                <div className="flex items-center gap-3 min-w-0">
                  {email && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60 truncate min-w-0">
                      <Mail className="h-3 w-3 shrink-0 text-muted-foreground/35" />
                      <span className="truncate">{email}</span>
                    </span>
                  )}
                  {phone && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60 shrink-0">
                      <Phone className="h-3 w-3 shrink-0 text-muted-foreground/35" />
                      {phone}
                    </span>
                  )}
                </div>
              )}
              {/* Campaign name pills */}
              {visibleCampaigns.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {visibleCampaigns.map((cname, i) => (
                    <span
                      key={i}
                      className="text-[9px] font-medium rounded px-1.5 py-0.5 truncate max-w-[100px]"
                      style={{
                        backgroundColor: isActive ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.09)",
                        color: "rgba(0,0,0,0.45)",
                      }}
                    >
                      {cname}
                    </span>
                  ))}
                  {extraCount > 0 && (
                    <span
                      className="text-[9px] font-medium rounded px-1.5 py-0.5"
                      style={{
                        backgroundColor: isActive ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.09)",
                        color: "rgba(0,0,0,0.45)",
                      }}
                    >
                      {t("related.more", { count: extraCount })}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
