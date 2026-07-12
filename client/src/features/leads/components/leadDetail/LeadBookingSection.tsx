// Booking block for LeadDetailPanel: call date, reschedule, no-show, summary.
// Extracted verbatim (Session C); reschedule action added Phase 1.
import { useState } from "react";
import { PhoneCall, RefreshCw, Bot, Calendar, Sparkles, AlertTriangle, X, UserX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiFetch } from "@/lib/apiUtils";
import { formatBookedDate } from "@/features/leads/components/cardView/formatUtils";
import { NoShowDialog, canReportNoShow } from "@/features/leads/components/NoShowDialog";
import { SectionTitle, InfoRow } from "./atoms";
import { fmtDateTime } from "./format";

const CALDIY_WEBAPP_URL = "https://cal.leadawaker.com";

interface LeadBookingSectionProps {
  lead: Record<string, any>;
  accountTimezone: string | undefined;
}

export function LeadBookingSection({ lead, accountTimezone }: LeadBookingSectionProps) {
  const { t } = useTranslation("leads");
  const [open, setOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [noShowOpen, setNoShowOpen] = useState(false);
  const [noShowClaimed, setNoShowClaimed] = useState(false);

  if (!(lead.booked_call_date || lead.booking_confirmed_at_)) return null;

  const bookingUid: string = lead.calcom_booking_uid ?? "";

  async function handleAiRebook() {
    setAiLoading(true);
    setOpen(false);
    try {
      const resp = await apiFetch(`/api/leads/${lead.id}/reschedule-reengage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "client_requested" }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      toast({ title: t("detail.fields.aiRebookTriggered") });
    } catch {
      toast({ title: t("detail.fields.aiRebookFailed"), variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  async function handleClientCancel() {
    setCancelLoading(true);
    setOpen(false);
    setConfirmCancel(false);
    try {
      const resp = await apiFetch(`/api/leads/${lead.id}/cancel-booking`, { method: "POST" });
      if (!resp.ok) throw new Error(await resp.text());
      toast({ title: t("detail.fields.bookingCancelled") });
    } catch {
      toast({ title: t("detail.fields.bookingCancelFailed"), variant: "destructive" });
    } finally {
      setCancelLoading(false);
    }
  }

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
        <InfoRow label={t("detail.fields.confirmedAt")} value={fmtDateTime(lead.booking_confirmed_at_)} />
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

        {/* No-show claim: button within the 48h window, badge once claimed */}
        {(lead.no_show || noShowClaimed) ? (
          <div className="pt-2 mt-1 border-t border-border/30 flex items-center gap-1.5" data-testid="no-show-claimed">
            <UserX className="h-3 w-3 text-destructive/70" />
            <span className="text-[11px] text-muted-foreground">
              {t("noShow.claimedBadge")}
              {lead.no_show_reason ? ` · ${t(`noShow.reasons.${lead.no_show_reason}.label`)}` : ""}
            </span>
          </div>
        ) : canReportNoShow(lead) ? (
          <div className="pt-2 mt-1 border-t border-border/30">
            <button
              className="flex items-center gap-1.5 text-[11px] font-medium text-destructive/80 hover:text-destructive transition-colors"
              onClick={() => setNoShowOpen(true)}
              data-testid="report-no-show"
            >
              <UserX className="h-3 w-3" />
              {t("noShow.reportButton")}
            </button>
            <NoShowDialog
              leadId={lead.id}
              open={noShowOpen}
              onOpenChange={setNoShowOpen}
              onReported={() => setNoShowClaimed(true)}
            />
          </div>
        ) : null}

        {/* Reschedule / Cancel actions */}
        <div className="pt-2 mt-1 border-t border-border/30 flex items-center gap-3">
          <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmCancel(false); }}>
            <PopoverTrigger asChild>
              <button
                className="flex items-center gap-1.5 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                disabled={aiLoading || cancelLoading}
              >
                <RefreshCw className={`h-3 w-3 ${aiLoading ? "animate-spin" : ""}`} />
                {t("detail.fields.rescheduleCall")}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
              <div className="flex flex-col gap-2">
                {bookingUid ? (
                  <a
                    href={`${CALDIY_WEBAPP_URL}/reschedule/${bookingUid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium bg-muted/40 hover:bg-muted/80 transition-colors text-foreground"
                    onClick={() => setOpen(false)}
                  >
                    <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                    {t("detail.fields.pickNewTime")}
                  </a>
                ) : null}
                <button
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium bg-muted/40 hover:bg-muted/80 transition-colors text-foreground text-left"
                  onClick={handleAiRebook}
                  disabled={aiLoading}
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                  {t("detail.fields.letAiRebook")}
                </button>
                <div className="border-t border-border/30 pt-2">
                  {confirmCancel ? (
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[11px] text-muted-foreground px-1">{t("detail.fields.cancelConfirm")}</p>
                      <div className="flex gap-2">
                        <button
                          className="flex-1 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                          onClick={handleClientCancel}
                          disabled={cancelLoading}
                        >
                          {t("detail.fields.cancelConfirmYes")}
                        </button>
                        <button
                          className="flex-1 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-muted/40 hover:bg-muted/80 transition-colors text-foreground"
                          onClick={() => setConfirmCancel(false)}
                        >
                          {t("detail.fields.cancelConfirmNo")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium bg-muted/40 hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground text-left w-full"
                      onClick={() => setConfirmCancel(true)}
                      disabled={cancelLoading}
                    >
                      <X className="h-3.5 w-3.5 shrink-0" />
                      {t("detail.fields.cancelCall")}
                    </button>
                  )}
                </div>
                <div className="flex items-start gap-1.5 px-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    {t("detail.fields.calendarEditWarning")}
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

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
