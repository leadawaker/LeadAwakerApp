// The Automations menu: one tile per category with its open failure count.
// The tiles are the shared side tabs (SectionRail); this only maps the
// categories onto them, for the Automation logs page and the client view.
import { useTranslation } from "react-i18next";
import type { AutomationService } from "@shared/automationCatalogue";
import { SectionRail, type SectionRailItem } from "@/features/accounts/components/workspace/SectionRail";
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
  const tiles: SectionRailItem<RailKey>[] = items.map((item) => {
    const Icon = SERVICE_ICON[item.key];
    return {
      key: item.key,
      icon: <Icon size={16} className="shrink-0" />,
      label: t(`rail.short.${item.key}`, { defaultValue: t(`services.${item.key}`) }),
      detail: item.detail,
      alerts: item.failures,
      alertsLabel: t("rail.failuresTitle", { count: item.failures }),
      controls: railPanelId(item.key),
    };
  });
  return (
    <SectionRail items={tiles} active={active} onSelect={onSelect} layout={layout} testId="automation-rail" ariaLabel={t("rail.label")} />
  );
}
