// Booking block for LeadDetailPanel: call date, reschedule, no-show, summary.
// Extracted verbatim (Session C).
import { PhoneCall, RefreshCw, X, Bot } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatBookedDate } from "@/features/leads/components/cardView/formatUtils";
import { SectionTitle, InfoRow } from "./atoms";
import { fmtDateTime } from "./format";

interface LeadBookingSectionProps {
  lead: Record<string, any>;
  accountTimezone: string | undefined;
}

export function LeadBookingSection({ lead, accountTimezone }: LeadBookingSectionProps) {
  const { t } = useTranslation("leads");
  if (!(lead.booked_call_date || lead.booking_confirmed_at)) return null;
  return (
    <>
      <SectionTitle icon={<PhoneCall className="h-3.5 w-3.5" />} title={t("detail.sections.booking")} />
      <div
        className="rounded-xl border border-border/40 bg-muted/20 px-3 py-1.5"
        data-testid="booked-call-section"
      >
        {lead.previous_booked_call_date && lead.re_scheduled_count != null && lead.re_scheduled_count > 0 && (
          <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/30">
            <span className="text-[11px] text-muted-foreground shrink-0">{t("detail.fields.previousCallDate", "Previous")}</span>
            <span className="text-[12px] text-muted-foreground/50 line-through tabular-nums">{formatBookedDate(lead.previous_booked_call_date, accountTimezone)}</span>
          </div>
        )}
        <InfoRow label={t("detail.fields.callDate")} value={formatBookedDate(lead.booked_call_date, accountTimezone)} />
        <InfoRow label={t("detail.fields.confirmedAt")} value={fmtDateTime(lead.booking_confirmed_at)} />
        {/* No-show indicator */}
        <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
          <span className="text-[11px] text-muted-foreground shrink-0">{t("detail.fields.noShow")}</span>
          {lead.no_show ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-600 dark:text-red-400"
              data-testid="no-show-badge"
            >
              <X className="h-3 w-3" />
              {t("detail.fields.noShow")}
            </span>
          ) : (
            <span className="text-[12px] text-muted-foreground">{"2014"}</span>
          )}
        </div>
        {/* Reschedule count */}
        {lead.re_scheduled_count != null && lead.re_scheduled_count > 0 && (
          <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <RefreshCw className="h-3 w-3 text-muted-foreground/60" />
              <span className="text-[11px] text-muted-foreground">{t("detail.fields.rescheduled")}</span>
            </div>
            <span
              className="text-[12px] font-semibold text-amber-600 dark:text-amber-400 tabular-nums"
              data-testid="reschedule-count"
            >
              {lead.re_scheduled_count}×
            </span>
          </div>
        )}
        {lead.call_duration_minutes != null && (
          <InfoRow label={t("detail.fields.duration")} value={t("detail.fields.durationMinutes", { minutes: lead.call_duration_minutes })} />
        )}
        {/* Lead summary generated at booking */}
        {lead.ai_memory && (() => {
          let isJsonArray = false;
          try { if (Array.isArray(JSON.parse(lead.ai_memory))) isJsonArray = true; } catch { /* not JSON */ }
          if (isJsonArray) return null;
          return (
            <div className="pt-2 pb-1 border-t border-border/30 mt-1">
              <div className="flex items-center gap-1.5 mb-1">
                <Bot className="h-3 w-3 text-muted-foreground/60" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {t("detail.fields.aiSummary", "AI Summary")}
                </span>
              </div>
              <p className="text-[12px] text-foreground/80 leading-relaxed">{lead.ai_memory}</p>
            </div>
          );
        })()}
      </div>
    </>
  );
}
