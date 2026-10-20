// The Automations menu: one tile per category with its open failure count.
// It looks like the Voice and Integrations menus on purpose: a column beside
// the open category on desktop, a 2-column grid above it on a phone.
import { useTranslation } from "react-i18next";
import type { AutomationService } from "@shared/automationCatalogue";
import { SERVICE_ICON } from "../status";

export type RailKey = AutomationService | "unlisted";

export interface RailItem {
  key: RailKey;
  /** One short fact under the label ("3 of 4 on", "12 actions"). */
  detail: string;
  /** Open (not cleared) failures in this category. */
  failures: number;
}

export const railPanelId = (key: RailKey) => `automation-section-${key}`;

export function AutomationRail({ items, active, onSelect, layout }: {
  items: RailItem[];
  active: RailKey;
  onSelect: (key: RailKey) => void;
  layout: "rail" | "grid";
}) {
  const { t } = useTranslation("automation");
  return (
    <div
      className="neu-raised"
      // The 1px gap over a line-coloured ground draws the dividers, so they stay right when the tiles wrap.
      style={{
        borderRadius: "var(--r-card)", background: "var(--line-strong)", display: "grid", gap: 1, overflow: "hidden",
        gridTemplateColumns: layout === "rail" ? "1fr" : "1fr 1fr", alignSelf: "start",
      }}
      role="tablist"
      aria-label={t("rail.label")}
      aria-orientation={layout === "rail" ? "vertical" : "horizontal"}
      data-testid="automation-rail"
    >
      {items.map((item, i) => {
        const on = item.key === active;
        const Icon = SERVICE_ICON[item.key];
        const lonely = layout === "grid" && items.length % 2 === 1 && i === items.length - 1;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={railPanelId(item.key)}
            onClick={() => onSelect(item.key)}
            data-testid={`automation-tab-${item.key}`}
            style={{
              position: "relative", display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start", textAlign: "left", cursor: "pointer",
              padding: layout === "grid" ? "13px 14px" : "15px 18px", border: 0, minWidth: 0,
              // Selected reads lighter, never darker: the open tile is the white card, the rest sit on the panel tone.
              background: on ? "var(--card)" : "var(--surface)",
              boxShadow: on ? "inset 3px 0 0 var(--wine)" : undefined,
              gridColumn: lonely ? "1 / -1" : undefined,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8, color: on ? "var(--wine)" : "var(--mute)", width: "100%" }}>
              <Icon size={16} className="shrink-0" />
              <span style={{ fontSize: 14, fontWeight: 700, color: on ? "var(--wine)" : "var(--ink)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t(`rail.short.${item.key}`, { defaultValue: t(`services.${item.key}`) })}
              </span>
              {item.failures > 0 && (
                <span
                  title={t("rail.failuresTitle", { count: item.failures })}
                  aria-label={t("rail.failuresTitle", { count: item.failures })}
                  style={{
                    minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, flexShrink: 0,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, lineHeight: 1,
                    background: "hsl(var(--destructive))", color: "hsl(var(--destructive-foreground))",
                  }}
                >
                  {item.failures > 99 ? "99+" : item.failures}
                </span>
              )}
            </span>
            <span style={{ fontSize: 12, color: "var(--mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
              {item.detail}
            </span>
          </button>
        );
      })}
    </div>
  );
}
