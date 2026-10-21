import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { twoFactorRequest } from "@/features/settings/twoFactor/useTwoFactor";

/**
 * Owner only: remove every 2FA method of a user (lost phone, no email access).
 * Verify the person out of band (a call) before using it.
 */
export function TwoFactorResetButton({ userId, userName, onDone }: { userId: number; userName: string; onDone: () => void }) {
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = async () => {
    setBusy(true);
    const r = await twoFactorRequest("POST", `/api/admin/users/${userId}/2fa/reset`);
    setBusy(false);
    setConfirming(false);
    if (r.ok) {
      toast({ variant: "success", title: t("twoFactorReset.done", { name: userName }) });
      onDone();
    } else {
      toast({ variant: "destructive", title: r.data?.message || t("twoFactor.genericError") });
    }
  };

  return (
    <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--line)" }} data-testid="section-two-factor-reset">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1.5 flex items-center gap-1.5">
        <ShieldOff className="w-3.5 h-3.5" />{t("twoFactorReset.title")}
      </p>
      {confirming ? (
        <div className="space-y-2">
          <p className="text-[12px] text-muted-foreground">{t("twoFactorReset.confirm", { name: userName })}</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={reset} disabled={busy} className="la-btn la-btn--wine la-btn--pill disabled:opacity-50" data-testid="button-2fa-reset-confirm">
              {t("twoFactorReset.reset")}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="la-btn la-btn--plain">{t("twoFactor.cancel")}</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="la-btn la-btn--soft" data-testid="button-2fa-reset">
          {t("twoFactorReset.reset")}
        </button>
      )}
    </div>
  );
}
