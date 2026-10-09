import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { DiaryLine } from "@shared/automationTypes";
import { actionLabel, reasonLabel } from "../labels";

const OUTCOME_COLOR = { success: "var(--good)", failed: "hsl(var(--destructive))", skipped: "var(--mute-2)" } as const;

function dayLabel(t: TFunction, iso: string, lang: string): string {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diff === 0) return t("diary.today");
  if (diff === 1) return t("diary.yesterday");
  return d.toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" });
}

/** Diary lines grouped by day on a vertical rail: time, outcome node, what happened, for whom, and why. */
export function DiaryTimeline({ lines, showClient, onOpenLead }: { lines: DiaryLine[]; showClient: boolean; onOpenLead: (leadId: number) => void }) {
  const { t, i18n } = useTranslation("automation");
  const days: { label: string; lines: DiaryLine[] }[] = [];
  for (const l of lines) {
    const label = dayLabel(t, l.createdAt, i18n.language);
    const last = days[days.length - 1];
    if (last && last.label === label) last.lines.push(l);
    else days.push({ label, lines: [l] });
  }

  return (
    <div>
      {days.map((day) => (
        <section key={day.label}>
          <div className="am-day">{day.label}</div>
          <div style={{ paddingTop: 4 }}>
            {day.lines.map((l) => {
              const color = OUTCOME_COLOR[l.outcome];
              const showReason = l.reason && l.outcome !== "success";
              return (
                <div key={l.id} className="am-entry" data-testid="automation-diary-line">
                  <span className="am-entry-time am-mono" title={new Date(l.createdAt).toLocaleString()}>
                    {new Date(l.createdAt).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}
                  </span>
                  <span className="am-entry-rail">
                    <span className={`am-dot${l.outcome === "skipped" ? " am-dot--hollow" : ""}`} style={{ "--am-dot": color } as CSSProperties} title={t(`outcome.${l.outcome}`)} />
                  </span>
                  <div className="am-entry-body">
                    <div className="am-entry-action">
                      {actionLabel(t, l.action)}
                      {l.outcome !== "success" && (
                        <span style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 600, color }}>{t(`outcome.${l.outcome}`)}</span>
                      )}
                    </div>
                    {(l.leadId || (showClient && l.accountName) || l.campaignName) && (
                      <div className="am-entry-meta">
                        {l.leadId && (
                          <button type="button" className="am-lead-link" onClick={() => onOpenLead(l.leadId!)}>
                            {l.leadName || t("diary.openLead")}
                          </button>
                        )}
                        {showClient && l.accountName && <span>{l.accountName}</span>}
                        {l.campaignName && <span style={{ color: "var(--mute-2)" }}>{l.campaignName}</span>}
                      </div>
                    )}
                    {showReason && (
                      <div
                        className="am-entry-reason"
                        style={{
                          background: l.outcome === "failed" ? "color-mix(in srgb, hsl(var(--destructive)) 9%, transparent)" : "var(--wine-tint)",
                          color: l.outcome === "failed" ? "hsl(var(--destructive))" : "var(--ink-soft)",
                        }}
                      >
                        {reasonLabel(t, l.reason!)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
