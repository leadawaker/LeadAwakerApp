// Bump cadence progress block for LeadDetailPanel: 3-step bar + sent timestamps.
// Extracted verbatim (Session C).
import { Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { SectionTitle } from "./atoms";
import { fmtDateTime } from "./format";

export function LeadBumpSection({ lead }: { lead: Record<string, any> }) {
  const { t } = useTranslation("leads");
  if (!(lead.current_bump_stage != null || lead.bump_1_sent_at || lead.bump_2_sent_at || lead.bump_3_sent_at)) {
    return null;
  }
  return (
    <>
      <SectionTitle icon={<Layers className="h-3.5 w-3.5" />} title={t("detail.sections.bumpProgress")} />
      <div
        className="rounded-xl border border-border/40 bg-muted/20 px-3 py-3"
        data-testid="bump-stage-section"
      >
        {/* Stage progress bar */}
        <div className="flex items-center gap-1 mb-3">
          {[1, 2, 3].map((stage) => {
            const currentStage = Number(lead.current_bump_stage ?? 0);
            const done = currentStage >= stage;
            return (
              <div
                key={stage}
                className={cn(
                  "flex-1 h-2 rounded-full transition-[width] duration-300",
                  done ? "bg-brand-indigo" : "bg-muted"
                )}
                data-testid={`bump-stage-step-${stage}`}
                data-done={done ? "true" : "false"}
              />
            );
          })}
        </div>

        {/* Current stage label */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-muted-foreground">{t("detail.fields.currentStage")}</span>
          <span
            className="text-[12px] font-semibold text-foreground tabular-nums"
            data-testid="bump-current-stage"
          >
            {lead.current_bump_stage ?? 0} / 3
          </span>
        </div>

        {/* Bump timestamps */}
        {lead.bump_1_sent_at && (
          <div className="flex items-center justify-between py-0.5">
            <span className="text-[11px] text-muted-foreground">{t("detail.fields.bump", { n: 1 })}</span>
            <span className="text-[11px] text-foreground/80 tabular-nums" data-testid="bump-1-sent-at">
              {fmtDateTime(lead.bump_1_sent_at)}
            </span>
          </div>
        )}
        {lead.bump_2_sent_at && (
          <div className="flex items-center justify-between py-0.5">
            <span className="text-[11px] text-muted-foreground">{t("detail.fields.bump", { n: 2 })}</span>
            <span className="text-[11px] text-foreground/80 tabular-nums" data-testid="bump-2-sent-at">
              {fmtDateTime(lead.bump_2_sent_at)}
            </span>
          </div>
        )}
        {lead.bump_3_sent_at && (
          <div className="flex items-center justify-between py-0.5">
            <span className="text-[11px] text-muted-foreground">{t("detail.fields.bump", { n: 3 })}</span>
            <span className="text-[11px] text-foreground/80 tabular-nums" data-testid="bump-3-sent-at">
              {fmtDateTime(lead.bump_3_sent_at)}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
