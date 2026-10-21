import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PasswordField } from "../components/SettingsFields";
import { CodeInput, ErrorLine, PanelBox } from "./TwoFactorPrimitives";
import { twoFactorRequest } from "./useTwoFactor";
import { cn } from "@/lib/utils";

type StepMethod = "totp" | "email" | "backup";

/** Proof of a second factor (and the password) before removing something. */
export function StepUpPanel({
  hasTotp, hasBackup, onVerified, onCancel,
}: {
  hasTotp: boolean; hasBackup: boolean; onVerified: () => void; onCancel: () => void;
}) {
  const { t } = useTranslation("settings");
  const methods: StepMethod[] = [...(hasTotp ? ["totp" as const] : []), "email" as const, ...(hasBackup ? ["backup" as const] : [])];
  const [method, setMethod] = useState<StepMethod>(methods[0]);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendEmail = async () => {
    setBusy(true);
    setError(null);
    const r = await twoFactorRequest("POST", "/api/auth/2fa/step-up/email");
    setBusy(false);
    if (r.ok) setSentTo(r.data.sentTo);
    else setError(r.data?.message || t("twoFactor.genericError"));
  };

  const submit = async () => {
    if (!password) { setError(t("twoFactor.passwordRequired")); return; }
    setBusy(true);
    setError(null);
    const r = await twoFactorRequest("POST", "/api/auth/2fa/step-up", { password, method, code });
    setBusy(false);
    if (r.ok) onVerified();
    else setError(r.data?.message === "Password is incorrect." ? t("twoFactor.wrongPassword") : r.status === 401 ? t("twoFactor.invalidCode") : r.data?.message || t("twoFactor.genericError"));
  };

  return (
    <PanelBox>
      <div className="text-sm font-semibold text-foreground">{t("twoFactor.stepUp.title")}</div>
      <p className="text-xs text-muted-foreground">{t("twoFactor.stepUp.help")}</p>
      {methods.length > 1 && (
        <div className="la-seg w-full" role="tablist">
          {methods.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={method === m}
              onClick={() => { setMethod(m); setCode(""); setError(null); }}
              className={cn("la-seg-btn flex-1", method === m && "on")}
              data-testid={`stepup-method-${m}`}
            >
              {t(`twoFactor.stepUp.method.${m}`)}
            </button>
          ))}
        </div>
      )}
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <PasswordField
          label={t("twoFactor.confirmPassword")}
          value={password}
          onChange={setPassword}
          show={showPw}
          onToggleShow={() => setShowPw((s) => !s)}
          testId="input-stepup-password"
          placeholder={t("security.currentPasswordPlaceholder")}
          autoComplete="current-password"
        />
        {method === "email" && !sentTo && (
          <button type="button" onClick={sendEmail} disabled={busy} className="la-btn la-btn--soft la-btn--lg">{t("twoFactor.email.sendCode")}</button>
        )}
        {(method !== "email" || sentTo) && (
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {method === "email" && sentTo ? t("twoFactor.email.sentTo", { email: sentTo }) : method === "backup" ? t("twoFactor.stepUp.enterBackup") : t("twoFactor.enterCode")}
            </label>
            <div className="mt-1.5"><CodeInput value={code} onChange={setCode} placeholder={method === "backup" ? "XXXXX-XXXXX" : "123456"} testId="input-stepup-code" maxLength={11} /></div>
          </div>
        )}
        <ErrorLine>{error}</ErrorLine>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="la-btn la-btn--plain la-btn--lg">{t("twoFactor.cancel")}</button>
          <button type="submit" disabled={busy || !code} className="la-btn la-btn--wine la-btn--lg la-btn--pill disabled:opacity-50" data-testid="button-stepup-submit">
            {t("twoFactor.stepUp.confirm")}
          </button>
        </div>
      </form>
    </PanelBox>
  );
}
