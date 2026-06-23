import { useState, useEffect, useCallback, useMemo } from "react";
import { Star, Save, Link2, BellRing } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

interface Props {
  account: Record<string, any>;
  accountId: number;
}

const readEnabled = (a: Record<string, any>) =>
  Boolean(a.enable_reputation_management ?? a.enableReputationManagement);
const readReviewUrl = (a: Record<string, any>) =>
  String(a.google_review_url ?? a.googleReviewUrl ?? "");
const readAlertTarget = (a: Record<string, any>) =>
  String(a.reputation_alert_target ?? a.reputationAlertTarget ?? "");

export default function ReputationSettingsPanel({ account, accountId }: Props) {
  const { t } = useTranslation("accounts");
  const { toast } = useToast();

  const [enabled, setEnabled] = useState(() => readEnabled(account));
  const [reviewUrl, setReviewUrl] = useState(() => readReviewUrl(account));
  const [alertTarget, setAlertTarget] = useState(() => readAlertTarget(account));
  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Reset the form when the selected account changes.
  useEffect(() => {
    setEnabled(readEnabled(account));
    setReviewUrl(readReviewUrl(account));
    setAlertTarget(readAlertTarget(account));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  useEffect(() => {
    apiFetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: any[]) => setUsers(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, []);

  const dirty = useMemo(
    () =>
      enabled !== readEnabled(account) ||
      reviewUrl.trim() !== readReviewUrl(account).trim() ||
      alertTarget !== readAlertTarget(account),
    [enabled, reviewUrl, alertTarget, account],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enable_reputation_management: enabled,
          google_review_url: reviewUrl.trim() || null,
          reputation_alert_target: alertTarget || null,
        }),
      });
      if (res.ok) {
        toast({ description: t("reputation.saved", "Reputation settings saved") });
      } else {
        toast({ description: t("reputation.saveError", "Could not save settings"), variant: "destructive" });
      }
    } catch {
      toast({ description: t("reputation.saveError", "Could not save settings"), variant: "destructive" });
    }
    setSaving(false);
  }, [accountId, enabled, reviewUrl, alertTarget, t, toast]);

  const userLabel = (u: any) =>
    u.fullName || u.name || u.email || `User ${u.id ?? u.Id}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Star className="w-4 h-4 text-primary" />
        <p className="text-[18px] font-semibold font-heading text-foreground">
          {t("reputation.title", "Reputation Management")}
        </p>
      </div>
      <p className="text-[12px] text-foreground/50 leading-relaxed -mt-2">
        {t(
          "reputation.description",
          "Automatically ask served customers for feedback over WhatsApp. Happy customers get your Google review link; unhappy ones are caught privately and routed to a person.",
        )}
      </p>

      {/* Enable toggle */}
      <div className="flex items-center justify-between gap-3 rounded-xl bg-foreground/[0.03] border border-border/30 px-3.5 py-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-foreground">
            {t("reputation.enableLabel", "Enable reputation management")}
          </p>
          <p className="text-[11px] text-foreground/40">
            {t("reputation.enableHint", "Turn the feedback flow on for this account")}
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      {/* Detailed config — only relevant when enabled */}
      <div className={enabled ? "space-y-4" : "space-y-4 opacity-50 pointer-events-none"}>
        {/* Google review URL */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-[12px] font-medium text-foreground/70">
            <Link2 className="w-3.5 h-3.5 text-foreground/40" />
            {t("reputation.reviewUrlLabel", "Google review link")}
          </label>
          <input
            type="url"
            value={reviewUrl}
            onChange={(e) => setReviewUrl(e.target.value)}
            placeholder={t("reputation.reviewUrlPlaceholder", "https://g.page/r/...")}
            className="w-full text-[12px] bg-background border border-border/40 rounded-lg px-2.5 py-2 outline-none focus:border-primary/50 transition-colors"
          />
          <p className="text-[11px] text-foreground/40">
            {t("reputation.reviewUrlHint", "Sent to customers who report a positive experience.")}
          </p>
        </div>

        {/* Manager alert target */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-[12px] font-medium text-foreground/70">
            <BellRing className="w-3.5 h-3.5 text-foreground/40" />
            {t("reputation.alertTargetLabel", "Negative-feedback alert")}
          </label>
          <select
            value={alertTarget}
            onChange={(e) => setAlertTarget(e.target.value)}
            className="w-full text-[12px] bg-background border border-border/40 rounded-lg px-2.5 py-2 outline-none focus:border-primary/50 transition-colors"
          >
            <option value="">{t("reputation.alertTargetOwner", "Account owner (default)")}</option>
            {users.map((u) => (
              <option key={u.id ?? u.Id} value={String(u.id ?? u.Id)}>
                {userLabel(u)}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-foreground/40">
            {t("reputation.alertTargetHint", "Who gets notified when a customer is unhappy.")}
          </p>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? t("reputation.saving", "Saving…") : t("reputation.save", "Save")}
        </button>
      </div>
    </div>
  );
}
