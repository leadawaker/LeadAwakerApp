// Onboarding wizard, under the daily recap time: how the recap and alerts are
// sent (email, WhatsApp) and to whom. Saves straight through the alert settings
// merge route, so it never touches the wizard's own answers.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { toE164 } from "@shared/phoneE164";
import { Chip, inputStyle } from "../communication/wizardAtoms";
import { useAlertSettings, type AlertSettingsPatch } from "./alertsApi";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function WizardAlertChannels({ accountId, handoffName, handoffNumber }: {
  accountId: number; handoffName: string; handoffNumber: string;
}) {
  const { t, i18n } = useTranslation("clientAlerts");
  const { settings, save } = useAlertSettings(accountId);
  const [error, setError] = useState<string | null>(null);
  if (!settings || !settings.canEdit) return null;

  const a = settings.alerts;
  const on = (c: "email" | "whatsapp") => a.channels.recap[c] || a.channels.alerts[c];
  const patch = async (p: AlertSettingsPatch) => {
    setError(null);
    try { await save.mutateAsync(p); } catch { setError(t("wizard.saveFailed")); }
  };
  const setChannel = (c: "email" | "whatsapp", value: boolean) =>
    patch({ alerts: { channels: { recap: { [c]: value }, alerts: { [c]: value } } } });

  const firstEmail = a.recipients.emails[0]?.address ?? "";
  const saveEmail = (value: string) => {
    const address = value.trim();
    if (address === firstEmail) return;
    if (address && !EMAIL_RE.test(address)) { setError(t("recipients.badEmail")); return; }
    const rest = a.recipients.emails.slice(1);
    void patch({ alerts: { recipients: { emails: address ? [{ address, name: handoffName }, ...rest] : rest } } });
  };

  const raw = handoffNumber.replace(/[\s\-().]/g, "");
  const number = raw.startsWith("+") ? raw : (toE164(raw, "NL") ?? "");
  // No name yet: "team", in the language the alerts go out in (it is the
  // greeting of every WhatsApp alert), else the language on screen.
  const name = handoffName.trim() || i18n.getFixedT(a.language ?? i18n.language, "clientAlerts")("wizard.team");
  const existing = a.recipients.whatsapp.find((w) => w.number === number);
  const consented = !!existing?.optedInAt && !existing?.optedOutAt;
  const setConsent = (value: boolean) => {
    const others = a.recipients.whatsapp.filter((w) => w.number !== number)
      .map((w) => ({ number: w.number, name: w.name }));
    void patch({ alerts: { recipients: { whatsapp: [...others, { number, name, consent: value }] } } });
  };

  return (
    <div style={{ marginTop: 14 }}>
      <div className="eyebrow eyebrow-sm" style={{ marginBottom: 8 }}>{t("wizard.channelsLabel")}</div>
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
        <Chip selected={on("email")} disabled={save.isPending} onClick={() => setChannel("email", !on("email"))} label={t("wizard.email")} />
        <Chip selected={on("whatsapp")} disabled={save.isPending} onClick={() => setChannel("whatsapp", !on("whatsapp"))} label={t("wizard.whatsapp")} />
      </div>
      {on("email") && (
        <input type="email" key={firstEmail} defaultValue={firstEmail} onBlur={(e) => saveEmail(e.target.value)}
          placeholder={t("wizard.emailPlaceholder")} aria-label={t("wizard.email")} className="neu-inset-crisp"
          style={{ ...inputStyle, maxWidth: 360, marginTop: 10 }} />
      )}
      {on("whatsapp") && (
        number ? (
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13, color: "var(--ink-soft)" }}>
            <Checkbox checked={consented} disabled={save.isPending || !!existing?.optedOutAt} onCheckedChange={(v) => setConsent(v === true)} />
            <span>
              {t("wizard.whatsappTo", { name, number })}
              <span style={{ display: "block", fontSize: 12, color: "var(--mute)" }}>{t("wizard.consent", { name })}</span>
            </span>
          </label>
        ) : <p style={{ fontSize: 12.5, color: "var(--mute)", margin: "10px 0 0" }}>{t("wizard.whatsappNoNumber")}</p>
      )}
      {error && <p role="alert" style={{ fontSize: 12.5, color: "var(--stage-lost)", margin: "8px 0 0" }}>{error}</p>}
    </div>
  );
}
