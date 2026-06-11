// Status block for LeadDetailPanel: pipeline stage selector, automation status,
// and the manual-takeover toggle. Extracted verbatim (Session C).
import { Activity, Loader2, CheckCircle2, UserX, UserCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { SectionTitle, InfoRow } from "./atoms";
import { PIPELINE_STAGES } from "./format";
import { STATUS_COLORS } from "./badges";

interface LeadStatusSectionProps {
  convStatus: string;
  savingStatus: boolean;
  stageSaved: boolean;
  handleStageChange: (newStage: string) => void;
  autoStatus: string;
  localManualTakeover: boolean;
  savingManualTakeover: boolean;
  handleManualTakeoverChange: (checked: boolean) => void;
}

export function LeadStatusSection({
  convStatus,
  savingStatus,
  stageSaved,
  handleStageChange,
  autoStatus,
  localManualTakeover,
  savingManualTakeover,
  handleManualTakeoverChange,
}: LeadStatusSectionProps) {
  const { t } = useTranslation("leads");
  return (
    <>
      {/* Status */}
      <SectionTitle icon={<Activity className="h-3.5 w-3.5" />} title={t("detail.sections.status")} />
      <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-1.5">
        {/* Pipeline Stage — interactive dropdown */}
        <div
          className="flex items-start justify-between gap-3 py-1.5 border-b border-border/30"
          data-testid="pipeline-stage-row"
        >
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-muted-foreground">{t("detail.fields.pipelineStage")}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {/* Change dropdown */}
            <Select
              value={convStatus}
              onValueChange={handleStageChange}
              disabled={savingStatus}
            >
              <SelectTrigger
                className="h-6 w-auto min-w-[70px] text-[11px] px-2 py-0 border-dashed border-border/60 bg-transparent hover:bg-muted/40 transition-colors"
                data-testid="pipeline-stage-trigger"
                aria-label={t("detail.fields.pipelineStage")}
              >
                <SelectValue placeholder={t("detail.fields.changePlaceholder")} />
              </SelectTrigger>
              <SelectContent data-testid="pipeline-stage-dropdown">
                {PIPELINE_STAGES.map((stage) => {
                  const colors = STATUS_COLORS[stage] ?? { bg: "bg-muted", text: "text-muted-foreground" };
                  return (
                    <SelectItem
                      key={stage}
                      value={stage}
                      className="text-[12px]"
                      data-testid={`pipeline-stage-option-${stage.replace(/\s+/g, "-").toLowerCase()}`}
                    >
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold",
                          colors.bg,
                          colors.text
                        )}
                      >
                        {stage}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Saving/saved indicator */}
            {savingStatus && (
              <Loader2
                className="h-3 w-3 animate-spin text-muted-foreground"
                data-testid="pipeline-stage-saving"
              />
            )}
            {stageSaved && !savingStatus && (
              <CheckCircle2
                className="h-3.5 w-3.5 text-emerald-500"
                data-testid="pipeline-stage-saved"
              />
            )}
          </div>
        </div>

        <InfoRow label={t("detail.fields.automation")} value={autoStatus} />

        {/* Manual Takeover — toggle switch */}
        <div
          className="flex items-center justify-between gap-3 py-1.5 border-t border-border/30"
          data-testid="manual-takeover-row"
        >
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-muted-foreground/60">
              {localManualTakeover ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
            </span>
            <span className="text-[11px] text-muted-foreground">{t("detail.fields.manualTakeover")}</span>
            {localManualTakeover && (
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-400/15 px-1.5 py-px rounded-full">
                {t("detail.fields.aiPaused")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {savingManualTakeover && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            <Switch
              checked={localManualTakeover}
              onCheckedChange={handleManualTakeoverChange}
              disabled={savingManualTakeover}
              data-testid="manual-takeover-toggle"
              aria-label={t("detail.fields.manualTakeover")}
            />
          </div>
        </div>
      </div>
    </>
  );
}
