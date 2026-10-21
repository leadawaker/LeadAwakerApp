import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PasswordGate } from "./PasswordGate";
import { CodeInput, ErrorLine, PanelBox } from "./TwoFactorPrimitives";
import { twoFactorRequest } from "./useTwoFactor";

/** Enable the email code: password, we email a code to the account address, confirm it. */
export function EmailPanel({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation("settings");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!sentTo) {
    return (
      <PanelBox>
        <PasswordGate
          title={t("twoFactor.email.setupTitle")}
          submitLabel={t("twoFactor.email.sendCode")}
          onCancel={onCancel}
          onSubmit={async (password) => {
            const r = await twoFactorRequest("POST", "/api/auth/2fa/email/enable", { password });
            if (!r.ok) return r.data?.message || t("twoFactor.genericError");
            setSentTo(r.data.sentTo);
            return null;
          }}
        >
          <p className="text-xs text-muted-foreground">{t("twoFactor.email.setupHelp")}</p>
        </PasswordGate>
      </PanelBox>
    );
  }

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const r = await twoFactorRequest("POST", "/api/auth/2fa/email/confirm", { code });
    setBusy(false);
    if (r.ok) onDone();
    else setError(r.status === 401 ? t("twoFactor.invalidCode") : r.data?.message || t("twoFactor.genericError"));
  };

  return (
    <PanelBox>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void confirm(); }}>
        <p className="text-xs text-muted-foreground">{t("twoFactor.email.sentTo", { email: sentTo })}</p>
        <CodeInput value={code} onChange={setCode} placeholder="123456" testId="input-email-code" autoFocus maxLength={7} />
        <ErrorLine>{error}</ErrorLine>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="la-btn la-btn--plain la-btn--lg">{t("twoFactor.cancel")}</button>
          <button type="submit" disabled={busy || code.replace(/\s/g, "").length < 6} className="la-btn la-btn--wine la-btn--lg la-btn--pill disabled:opacity-50" data-testid="button-email-confirm">
            {t("twoFactor.email.enable")}
          </button>
        </div>
      </form>
    </PanelBox>
  );
}
