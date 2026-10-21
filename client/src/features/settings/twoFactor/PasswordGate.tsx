import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PasswordField } from "../components/SettingsFields";
import { ErrorLine } from "./TwoFactorPrimitives";

/** Asks for the account password, then hands it to `onSubmit` (which returns an error message or null). */
export function PasswordGate({
  title, submitLabel, onSubmit, onCancel, children,
}: {
  title?: ReactNode;
  submitLabel: string;
  onSubmit: (password: string) => Promise<string | null>;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation("settings");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!password) { setError(t("twoFactor.passwordRequired")); return; }
    setBusy(true);
    setError(null);
    const err = await onSubmit(password);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      {title && <div className="text-sm font-semibold text-foreground">{title}</div>}
      {children}
      <PasswordField
        label={t("twoFactor.confirmPassword")}
        value={password}
        onChange={setPassword}
        show={show}
        onToggleShow={() => setShow((s) => !s)}
        testId="input-2fa-password"
        placeholder={t("security.currentPasswordPlaceholder")}
        autoComplete="current-password"
      />
      <ErrorLine>{error}</ErrorLine>
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="la-btn la-btn--plain la-btn--lg">{t("twoFactor.cancel")}</button>
        <button type="submit" disabled={busy} className="la-btn la-btn--wine la-btn--lg la-btn--pill disabled:opacity-50" data-testid="button-2fa-password-submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
