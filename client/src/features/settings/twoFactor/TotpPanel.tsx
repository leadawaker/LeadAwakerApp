import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PasswordGate } from "./PasswordGate";
import { CodeInput, ErrorLine, PanelBox } from "./TwoFactorPrimitives";
import { twoFactorRequest } from "./useTwoFactor";

/** Enable the authenticator app: password, scan the QR code, confirm one code. */
export function TotpPanel({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation("settings");
  const [setup, setSetup] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!setup) {
    return (
      <PanelBox>
        <PasswordGate
          title={t("twoFactor.totp.setupTitle")}
          submitLabel={t("twoFactor.continue")}
          onCancel={onCancel}
          onSubmit={async (password) => {
            const r = await twoFactorRequest("POST", "/api/auth/2fa/totp/setup", { password });
            if (!r.ok) return r.data?.message || t("twoFactor.genericError");
            setSetup({ qrDataUrl: r.data.qrDataUrl, secret: r.data.secret });
            return null;
          }}
        />
      </PanelBox>
    );
  }

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const r = await twoFactorRequest("POST", "/api/auth/2fa/totp/enable", { code });
    setBusy(false);
    if (r.ok) onDone();
    else setError(r.status === 401 ? t("twoFactor.invalidCode") : r.data?.message || t("twoFactor.genericError"));
  };

  return (
    <PanelBox>
      <div className="text-sm font-semibold text-foreground">{t("twoFactor.totp.scanTitle")}</div>
      <p className="text-xs text-muted-foreground">{t("twoFactor.totp.scanHelp")}</p>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <img src={setup.qrDataUrl} alt={t("twoFactor.totp.qrAlt")} width={176} height={176} className="rounded-lg border border-border shrink-0" />
        <div className="space-y-1 min-w-0 w-full">
          <div className="text-xs text-muted-foreground">{t("twoFactor.totp.manualKey")}</div>
          <code className="block text-xs font-mono break-all select-all rounded-md bg-muted px-2 py-1.5" data-testid="text-totp-secret">{setup.secret}</code>
        </div>
      </div>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void confirm(); }}>
        <div>
          <label className="text-xs font-medium text-muted-foreground">{t("twoFactor.enterCode")}</label>
          <div className="mt-1.5"><CodeInput value={code} onChange={setCode} placeholder="123456" testId="input-totp-code" autoFocus maxLength={7} /></div>
        </div>
        <ErrorLine>{error}</ErrorLine>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="la-btn la-btn--plain la-btn--lg">{t("twoFactor.cancel")}</button>
          <button type="submit" disabled={busy || code.replace(/\s/g, "").length < 6} className="la-btn la-btn--wine la-btn--lg la-btn--pill disabled:opacity-50" data-testid="button-totp-enable">
            {t("twoFactor.totp.enable")}
          </button>
        </div>
      </form>
    </PanelBox>
  );
}
