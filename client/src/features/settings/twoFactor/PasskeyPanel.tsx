import { useState } from "react";
import { useTranslation } from "react-i18next";
import { startRegistration } from "@simplewebauthn/browser";
import { PasswordGate } from "./PasswordGate";
import { inputClass, inputStyle, PanelBox } from "./TwoFactorPrimitives";
import { twoFactorRequest } from "./useTwoFactor";

/** Register a passkey: password, name it, then the browser/device prompt. */
export function PasskeyPanel({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation("settings");
  const [label, setLabel] = useState("");

  return (
    <PanelBox>
      <PasswordGate
        title={t("twoFactor.passkey.addTitle")}
        submitLabel={t("twoFactor.passkey.add")}
        onCancel={onCancel}
        onSubmit={async (password) => {
          const opts = await twoFactorRequest("POST", "/api/auth/2fa/passkey/register/options", { password });
          if (!opts.ok) return opts.data?.message === "Password is incorrect." ? t("twoFactor.wrongPassword") : opts.data?.message || t("twoFactor.genericError");
          let response;
          try {
            response = await startRegistration({ optionsJSON: opts.data });
          } catch (err: any) {
            return err?.name === "NotAllowedError" ? t("twoFactor.passkey.cancelled") : t("twoFactor.passkey.failed");
          }
          const done = await twoFactorRequest("POST", "/api/auth/2fa/passkey/register/verify", { response, deviceLabel: label.trim() });
          if (!done.ok) return done.data?.message || t("twoFactor.passkey.failed");
          onDone();
          return null;
        }}
      >
        <p className="text-xs text-muted-foreground">{t("twoFactor.passkey.addHelp")}</p>
        <div>
          <label className="text-xs font-medium text-muted-foreground">{t("twoFactor.passkey.nameLabel")}</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={60}
            placeholder={t("twoFactor.passkey.namePlaceholder")}
            className={`mt-1.5 ${inputClass}`}
            style={inputStyle}
            data-testid="input-passkey-name"
          />
        </div>
      </PasswordGate>
    </PanelBox>
  );
}
