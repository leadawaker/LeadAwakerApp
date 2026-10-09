import { useTranslation } from "react-i18next";
import { ListCard, Pill } from "@/components/crm/primitives";
import type { OverviewRow } from "@shared/automationTypes";
import { HealthDot } from "./HealthDot";
import { automationName, automationDescription, triggerLabel, timeAgo } from "../labels";

export function OverviewRowCard({ row, selected, onClick }: { row: OverviewRow; selected: boolean; onClick: () => void }) {
  const { t } = useTranslation("automation");
  const c = row.counts24h;
  const scheduled = row.entry ? row.entry.trigger.type !== "event" : false;
  const when = row.lastRunAt
    ? t(scheduled ? "row.lastRun" : "row.lastAction", { ago: timeAgo(t, row.lastRunAt) })
    : t("row.never");
  return (
    <ListCard selected={selected} onClick={onClick} role="button" tabIndex={0} data-testid={`automation-row-${row.id}`}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ paddingTop: 5 }}><HealthDot state={row.health} title={t(`health.${row.health}`)} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, color: "var(--ink)" }}>{automationName(t, row.id)}</span>
            {row.entry && <span style={{ fontSize: 12, color: "var(--mute)" }}>{triggerLabel(t, row.entry.trigger)}</span>}
            {row.quiet && <Pill>{t("row.quiet")}</Pill>}
            {c.failed > 0 && <Pill color="var(--destructive)">{t("row.failedBadge", { count: c.failed })}</Pill>}
          </div>
          {row.entry && <div style={{ fontSize: 13, color: "var(--mute)", marginTop: 2 }}>{automationDescription(t, row.id)}</div>}
          <div style={{ fontSize: 12, color: "var(--mute-2)", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span>{when}</span>
            <span>{t("row.counts", { success: c.success, failed: c.failed, skipped: c.skipped })}</span>
            {row.clientsOn !== null && <span>{t("row.clientsOn", { count: row.clientsOn })}</span>}
          </div>
          {row.lastError && row.health === "failing" && (
            <div style={{ fontSize: 12, color: "var(--destructive)", marginTop: 4, wordBreak: "break-word" }}>{row.lastError}</div>
          )}
        </div>
      </div>
    </ListCard>
  );
}
