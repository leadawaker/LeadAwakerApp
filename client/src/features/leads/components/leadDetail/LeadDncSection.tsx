// Do-not-contact (opted-out) block for LeadDetailPanel: toggle + reason input.
// Extracted verbatim (Session C).
import { Ban, Loader2, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { SectionTitle } from "./atoms";

interface LeadDncSectionProps {
  localOptedOut: boolean;
  savingDnc: boolean;
  dncSaved: boolean;
  showDncReason: boolean;
  localDncReason: string;
  setLocalDncReason: (value: string) => void;
  handleDncChange: (checked: boolean) => void;
  handleDncReasonSave: () => void;
}

export function LeadDncSection({
  localOptedOut,
  savingDnc,
  dncSaved,
  showDncReason,
  localDncReason,
  setLocalDncReason,
  handleDncChange,
  handleDncReasonSave,
}: LeadDncSectionProps) {
  const { t } = useTranslation("leads");
  return (
    <>
      {/* DNC / Opted-out Section */}
      <SectionTitle icon={<Ban className="h-3.5 w-3.5" />} title={t("detail.sections.doNotContact")} />
      <div
        className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2"
        data-testid="dnc-section"
      >
        {/* Opted-out toggle */}
        <div
          className="flex items-center justify-between gap-3 py-1.5"
          data-testid="dnc-toggle-row"
        >
          <div className="flex items-center gap-1.5">
            <Ban className="h-3 w-3 text-muted-foreground/60" />
            <span className="text-[11px] text-muted-foreground">{t("detail.fields.optedOutDnc")}</span>
            {localOptedOut && (
              <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-500/15 px-1.5 py-px rounded-full">
                {t("detail.fields.dncActive")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {savingDnc && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            {dncSaved && !savingDnc && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
            <Switch
              checked={localOptedOut}
              onCheckedChange={handleDncChange}
              disabled={savingDnc}
              data-testid="dnc-toggle"
              aria-label={t("detail.fields.optedOutDnc")}
            />
          </div>
        </div>

        {/* DNC reason input — shows when opted out */}
        {showDncReason && (
          <div className="mt-1.5 pt-1.5 border-t border-border/30" data-testid="dnc-reason-container">
            <label className="text-[11px] text-muted-foreground mb-1 block">{t("detail.fields.dncReason")}</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={localDncReason}
                onChange={(e) => setLocalDncReason(e.target.value)}
                onBlur={handleDncReasonSave}
                onKeyDown={(e) => { if (e.key === "Enter") handleDncReasonSave(); }}
                placeholder={t("detail.fields.dncReasonPlaceholder")}
                className="flex-1 text-[12px] bg-background border border-border/60 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-indigo/50"
                data-testid="dnc-reason-input"
                disabled={savingDnc}
              />
            </div>
            {localDncReason && (
              <p className="mt-1 text-[11px] text-muted-foreground" data-testid="dnc-reason-display">
                {t("detail.fields.dncReasonLabel")}: <span className="text-foreground/80">{localDncReason}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
