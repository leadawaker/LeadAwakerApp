import { useTranslation } from "react-i18next";
import { Clock, ChevronRight } from "lucide-react";
import { formatHours } from "../formFields/campaignFormatters";

/** Renders a single bump template block */
export function BumpCard({
  bumpNumber,
  template,
  delayHours,
}: {
  bumpNumber: number;
  template: string | null | undefined;
  delayHours: number | null | undefined;
}) {
  const { t } = useTranslation("campaigns");
  return (
    <div
      className="rounded-xl border border-border bg-muted/30 p-3 space-y-2"
      data-testid={`campaign-detail-bump-${bumpNumber}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Bump {bumpNumber}
          </span>
          <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{t("config.delayLabel", { value: formatHours(delayHours) })}</span>
        </div>
      </div>
      {template ? (
        <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words">
          {template}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground italic">{t("config.noTemplateSet")}</p>
      )}
    </div>
  );
}
