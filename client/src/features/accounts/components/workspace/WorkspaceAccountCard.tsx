import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/avatarUtils";
import { STATUS_I18N_KEY, formatRelativeTime } from "../listWidgets/accountListConstants";
import type { AccountRow } from "./types";

// Account list card styled to match the Campaigns page (la-camp-card / la-mono-tile / la-status).
export function WorkspaceAccountCard({
  account, isActive, onClick, campaignNames, leadCount,
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
  const aid = account.Id ?? account.id ?? 0;
  const logo = account.logo_url ? String(account.logo_url) : "";
  const niche = String(account.business_niche || "");
  const type = String(account.type || "");
  const lastUpdated = account.updated_at || account.created_at;

  const statusClass = status === "Active" ? "active-s" : status === "Trial" ? "paused" : "inactive";
  const statusLabel = status ? t(STATUS_I18N_KEY[status] ?? status) : t("status.unknown");
  const tileClass = status === "Active" || isActive ? "wine" : status === "Inactive" || status === "Suspended" ? "inactive" : "";

  const campaignCount = campaignNames.length;

  return (
    <div
      className={`la-camp-card group${isActive ? " active" : ""}`}
      style={{ flexDirection: "column", alignItems: "stretch", gap: "var(--space-xs)" }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      data-testid="account-card"
    >
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        {logo ? (
          <div className="la-mono-tile" style={{ overflow: "hidden", padding: 0, boxShadow: isActive ? "var(--sh-raised-crisp), 0 0 0 2px var(--wine)" : undefined }}>
            <img src={logo} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className={`la-mono-tile ${tileClass}`}>{initials}</div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "var(--space-xxs)" }}>
            {name}
          </div>
          <div className="row" style={{ gap: "var(--space-xs)", marginBottom: type || niche ? 6 : 0 }}>
            <span className={`la-status ${statusClass}`}><span className="dot" />{statusLabel}</span>
            {aid > 0 && <span style={{ fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 10, color: "var(--mute-2)", letterSpacing: "0.1em" }}>#{aid}</span>}
          </div>
          {(type || niche) && (
            <div className="row" style={{ gap: 5, fontSize: 11, color: "var(--mute)" }}>
              <span className="dot" style={{ background: "var(--mute-2)" }} />
              {[type, niche].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      </div>

      <div className={cn(
        "opacity-100 max-h-[72px] md:opacity-0 md:max-h-0 md:group-hover:opacity-100 md:group-hover:max-h-[72px]",
        "transition-[opacity,max-height] duration-200 flex flex-col gap-1 overflow-hidden",
      )}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1, borderRadius: "var(--r-button)", overflow: "hidden", background: isActive ? "var(--warn-tint)" : "var(--line)" }}>
          {([
            { label: t("panels.leads"), value: leadCount != null ? leadCount.toLocaleString() : "—" },
            { label: t("panels.campaigns"), value: campaignCount > 0 ? String(campaignCount) : "—" },
          ] as const).map((stat) => (
            <div key={stat.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 0", background: isActive ? "hsl(var(--highlight-selected))" : "var(--card)" }}>
              <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.15, color: "var(--ink)", fontSize: 13 }}>{stat.value}</span>
              <span style={{ fontSize: 9, color: "var(--mute)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>{stat.label}</span>
            </div>
          ))}
        </div>
        {lastUpdated && (
          <div style={{ paddingLeft: "var(--space-xxs)" }}>
            <span style={{ fontSize: 10, color: "var(--mute)", fontVariantNumeric: "tabular-nums" }}>{formatRelativeTime(lastUpdated)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function WorkspaceGroupHeader({ label, count, isFirst }: { label: string; count: number; isFirst?: boolean }) {
  return (
    <>
      {!isFirst && <div className="rule" style={{ margin: "10px 9px 0 11px" }} />}
      <div data-group-header="true" style={{ position: "sticky", top: 0, zIndex: 5, background: "hsl(var(--panel-list-bg))", padding: isFirst ? "2px 17px 6px" : "8px 17px 6px", boxShadow: "0 -8px 0 8px hsl(var(--panel-list-bg))" }}>
        <span className="eyebrow eyebrow-sm">{label} — {count}</span>
      </div>
    </>
  );
}
