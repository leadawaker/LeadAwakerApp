import { useTranslation } from "react-i18next";
import { ChevronRight, Clock, Zap } from "lucide-react";
import type { OverviewRow } from "@shared/automationTypes";
import { HealthDot } from "./HealthDot";
import { PulseBars } from "./PulseBars";
import { automationName, automationDescription, triggerLabel, timeAgo } from "../labels";
import { bucketOf } from "../status";

/** One automation as a table-like row: status, what it does, when it runs, its last 24h, clients, last activity. */
export function AutomationRow({ row, selected, onClick }: { row: OverviewRow; selected: boolean; onClick: () => void }) {
  const { t } = useTranslation("automation");
  const c = row.counts24h;
  const total = c.success + c.failed + c.skipped;
  const isEvent = row.entry?.trigger.type === "event";
  const TriggerIcon = isEvent ? Zap : Clock;
  const statusLabel = t(`health.${row.health}`);
  const showError = row.lastError && bucketOf(row.health) === "broken";

  return (
    <button
      type="button"
      className={`am-row${selected ? " is-selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
      data-testid={`automation-row-${row.id}`}
    >
      <HealthDot state={row.health} title={statusLabel} />
      <div style={{ minWidth: 0 }}>
        <div className="am-name">{automationName(t, row.id)}</div>
        {row.entry ? (
          <div className="am-desc" title={automationDescription(t, row.id)}>{automationDescription(t, row.id)}</div>
        ) : (
          <div className="am-desc">{t("row.unlisted")}</div>
        )}
        {row.quiet && <div className="am-desc" style={{ color: "var(--warn)" }}>{t("row.quiet")}</div>}
        {showError && <div className="am-error">{row.lastError}</div>}
      </div>
      <div className="am-col-trigger am-mono am-trigger" title={row.entry ? triggerLabel(t, row.entry.trigger) : undefined}>
        {row.entry && <><TriggerIcon className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--mute-2)" }} /><span>{triggerLabel(t, row.entry.trigger)}</span></>}
      </div>
      <div className="am-col-pulse" title={t("row.pulseTitle")}>
        <PulseBars pulse={row.pulse} mini />
      </div>
      <div className={`am-num${total === 0 ? " zero" : ""}`} title={t("row.counts", { success: c.success, failed: c.failed, skipped: c.skipped })}>
        {total === 0 ? "0" : total}
        {c.failed > 0 && <div className="bad" style={{ fontSize: 11 }}>{t("row.failedBadge", { count: c.failed })}</div>}
      </div>
      <div className="am-col-clients am-mono" style={{ textAlign: "right" }}>
        {row.clientsOn !== null ? t("row.clientsOn", { count: row.clientsOn }) : t("row.internal")}
      </div>
      <div className="am-col-when am-mono" style={{ textAlign: "right" }} title={row.lastRunAt ? new Date(row.lastRunAt).toLocaleString() : undefined}>
        {row.lastRunAt ? timeAgo(t, row.lastRunAt) : <span style={{ color: "var(--mute-2)" }}>{t("row.neverShort")}</span>}
      </div>
      <ChevronRight className="am-chev h-4 w-4" />
    </button>
  );
}
