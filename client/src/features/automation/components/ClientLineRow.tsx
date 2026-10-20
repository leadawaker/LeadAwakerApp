import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { PauseCircle, ChevronRight } from "lucide-react";
import type { ClientLine, ClientState } from "@shared/automationTypes";
import { automationName, reasonLabel, summaryText, timeAgo } from "../labels";

const STATE_COLOR: Record<ClientState, string> = { on: "var(--good)", off: "var(--mute-2)", always_on: "var(--wine)" };

/** One automation for one client: on/off, what it does here, its last 7 days, and where to change it. */
export function ClientLineRow({ line: l, selected, linkable, onOpen, onChange }: {
  line: ClientLine;
  selected: boolean;
  /** False when the setting lives somewhere this view cannot link to (shows the hint instead). */
  linkable: boolean;
  onOpen: () => void;
  onChange: () => void;
}) {
  const { t } = useTranslation("automation");
  const c = l.counts7d;
  const total = c.success + c.failed + c.skipped;
  const summary = summaryText(t, l.summary);

  return (
    <div
      role="button"
      tabIndex={0}
      className={`am-row am-crow${selected ? " is-selected" : ""}`}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      aria-pressed={selected}
    >
      <span className="am-state" style={{ "--am-dot": STATE_COLOR[l.state] } as CSSProperties}>
        <span className={`am-dot${l.state === "off" ? " am-dot--hollow" : ""}`} />
        {t(`client.state.${l.state}`)}
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="am-name">{automationName(t, l.automationId)}</div>
        {l.campaignName && <div className="am-desc" style={{ color: "var(--mute-2)" }}>{l.campaignName}</div>}
        {summary && <div className="am-desc" style={{ whiteSpace: "normal" }}>{summary}</div>}
        {c.failed > 0 && c.topFailureReason && (
          <div className="am-error">{t("client.topReason", { reason: reasonLabel(t, c.topFailureReason) })}</div>
        )}
        {l.warning && (
          <div style={{ fontSize: 12, color: "var(--mute)", marginTop: 4, display: "flex", gap: 6, alignItems: "center" }}>
            <PauseCircle className="h-3.5 w-3.5 shrink-0" />{t(`client.warning.${l.warning.key}`, { count: l.warning.count })}
          </div>
        )}
        {l.change?.kind === "settings_account" && !linkable && (
          <div style={{ fontSize: 12, color: "var(--mute-2)", marginTop: 4 }}>{t("client.changeHintAccount")}</div>
        )}
      </div>
      <div className={`am-num${total === 0 ? " zero" : ""}`} title={t("client.counts7d", { success: c.success, failed: c.failed, skipped: c.skipped })}>
        {l.state === "off" && total === 0 ? "" : total}
        {c.failed > 0 && <div className="bad" style={{ fontSize: 11 }}>{t("row.failedBadge", { count: c.failed })}</div>}
      </div>
      <div className="am-col-when am-mono" style={{ textAlign: "right" }}>
        {c.lastActionAt ? timeAgo(t, c.lastActionAt) : ""}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {linkable ? (
          <button type="button" className="la-btn la-btn--soft" onClick={(e) => { e.stopPropagation(); onChange(); }}>
            {t("client.change")}
          </button>
        ) : (
          <ChevronRight className="am-chev h-4 w-4" />
        )}
      </div>
    </div>
  );
}
