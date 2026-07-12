// No-show claim dialog (no-show-recovery spec). One shared dialog used from
// the lead detail booking section, the calendar booking detail, and the
// contacts row action. The chosen reason drives a different follow-up
// automation server-side, so the labels must stay honest to the automation.
import { useState } from "react";
import { UserX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export type NoShowReason = "not_interested" | "wants_other_time" | "no_reason";

const REASONS: NoShowReason[] = ["not_interested", "wants_other_time", "no_reason"];

const CLAIM_WINDOW_MS = 48 * 3600 * 1000;

/** Shared visibility rule: booked, call in the past, within the 48h claim
 * window, not already claimed. Tolerates both snake_case (raw DB rows) and
 * camelCase (Drizzle-mapped) lead shapes, since callers mix the two. */
export function canReportNoShow(lead: Record<string, any>, now = new Date()): boolean {
  if (lead.no_show ?? lead.noShow) return false;
  const status = lead.Conversion_Status ?? lead.conversion_status ?? lead.conversionStatus;
  if (status !== "Booked") return false;
  const rawDate = lead.booked_call_date ?? lead.bookedCallDate;
  if (!rawDate) return false;
  const call = new Date(rawDate);
  return call < now && now.getTime() - call.getTime() <= CLAIM_WINDOW_MS;
}

interface NoShowDialogProps {
  leadId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful claim so the caller can refetch/patch the lead. */
  onReported?: (reason: NoShowReason) => void;
}

export function NoShowDialog({ leadId, open, onOpenChange, onReported }: NoShowDialogProps) {
  const { t } = useTranslation("leads");
  const [reason, setReason] = useState<NoShowReason | "">("");
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!reason) return;
    setLoading(true);
    try {
      const resp = await apiFetch(`/api/leads/${leadId}/no-show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      toast({ title: t("noShow.reported") });
      onOpenChange(false);
      onReported?.(reason);
    } catch {
      toast({ title: t("noShow.reportFailed"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setReason(""); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="h-4 w-4 text-destructive" />
            {t("noShow.title")}
          </DialogTitle>
          <DialogDescription>{t("noShow.description")}</DialogDescription>
        </DialogHeader>
        <RadioGroup value={reason} onValueChange={(v) => setReason(v as NoShowReason)} className="gap-2 py-1">
          {REASONS.map((r) => (
            <label
              key={r}
              htmlFor={`no-show-${r}`}
              className="flex items-start gap-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
            >
              <RadioGroupItem value={r} id={`no-show-${r}`} className="mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <Label htmlFor={`no-show-${r}`} className="text-[13px] font-medium cursor-pointer">
                  {t(`noShow.reasons.${r}.label`)}
                </Label>
                <span className="text-[11px] text-muted-foreground leading-snug">
                  {t(`noShow.reasons.${r}.hint`)}
                </span>
              </div>
            </label>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("noShow.cancel")}
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!reason || loading}>
            {t("noShow.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
