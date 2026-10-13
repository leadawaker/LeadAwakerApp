// Who receives recaps and alerts: up to 5 email addresses and 3 WhatsApp
// numbers. A WhatsApp number is only messaged after the consent box is ticked
// (the server stamps the time), and never after it sent STOP.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Users, X } from "lucide-react";
import { Panel } from "../atoms";
import { IconBtn } from "@/components/ui/icon-btn";
import { Checkbox } from "@/components/ui/checkbox";
import { MAX_EMAIL_RECIPIENTS, MAX_WHATSAPP_RECIPIENTS } from "@shared/clientAlerts";
import { Badge, FieldLabel, ReadOnlyValue, errorStyle, helpStyle, inputStyle, useDraft } from "./alertsAtoms";
import { SaveRow } from "../voice/voiceAtoms";
import type { AlertSettingsPatch, AlertSettingsResponse } from "./alertsApi";

interface WaDraft { number: string; name: string; consent: boolean; optedOut: boolean; resubscribe: boolean }
interface Draft { emails: Array<{ address: string; name: string }>; whatsapp: WaDraft[] }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RecipientsCard({ settings, canEdit, saving, onSave }: {
  settings: AlertSettingsResponse; canEdit: boolean; saving: boolean;
  onSave: (patch: AlertSettingsPatch) => Promise<boolean>;
}) {
  const { t } = useTranslation("clientAlerts");
  const server = useMemo<Draft>(() => ({
    emails: settings.alerts.recipients.emails.map((e) => ({ ...e })),
    whatsapp: settings.alerts.recipients.whatsapp.map((w) => ({
      number: w.number, name: w.name, consent: !!w.optedInAt, optedOut: !!w.optedOutAt, resubscribe: false,
    })),
  }), [settings.alerts.recipients]);
  const { draft, setDraft, dirty, reset } = useDraft(server);
  const [error, setError] = useState<string | null>(null);

  const setEmail = (i: number, patch: Partial<Draft["emails"][number]>) =>
    setDraft({ ...draft, emails: draft.emails.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  const setWa = (i: number, patch: Partial<WaDraft>) =>
    setDraft({ ...draft, whatsapp: draft.whatsapp.map((w, j) => (j === i ? { ...w, ...patch } : w)) });

  const suggestion = settings.suggestedWhatsapp;
  const showSuggestion = canEdit && suggestion && draft.whatsapp.length < MAX_WHATSAPP_RECIPIENTS
    && !draft.whatsapp.some((w) => w.number.replace(/\s/g, "") === suggestion.number);

  const submit = async () => {
    setError(null);
    const emails = draft.emails.filter((e) => e.address.trim());
    if (emails.some((e) => !EMAIL_RE.test(e.address.trim()))) { setError(t("recipients.badEmail")); return; }
    const whatsapp = draft.whatsapp.filter((w) => w.number.trim());
    if (whatsapp.some((w) => !w.name.trim())) { setError(t("recipients.nameRequired")); return; }
    const ok = await onSave({ alerts: { recipients: {
      emails: emails.map((e) => ({ address: e.address.trim(), name: e.name.trim() })),
      whatsapp: whatsapp.map((w) => ({
        number: w.number.trim(), name: w.name.trim(), consent: w.consent,
        ...(w.optedOut && w.resubscribe ? { resubscribe: true, consent: true } : {}),
      })),
    } } });
    if (!ok) setError(t("recipients.saveFailed"));
  };

  const input = (value: string, onChange: (v: string) => void, label: string, extra: object = {}) => (
    <input value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} placeholder={label}
      className="neu-inset-crisp" style={{ ...inputStyle, minWidth: 0 }} autoComplete="off" {...extra} />
  );

  return (
    <Panel icon={<Users size={17} />} title={t("recipients.title")} pad={20}>
      <p style={helpStyle}>{t("recipients.help")}</p>

      <FieldLabel>{t("recipients.emailTitle")}</FieldLabel>
      {!canEdit && draft.emails.length === 0 && <ReadOnlyValue value="" />}
      {draft.emails.map((e, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.6fr) auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
          {canEdit ? input(e.name, (v) => setEmail(i, { name: v }), t("recipients.name")) : <ReadOnlyValue value={e.name} />}
          {canEdit ? input(e.address, (v) => setEmail(i, { address: v }), t("recipients.email"), { type: "email" }) : <ReadOnlyValue value={e.address} />}
          {canEdit ? (
            <IconBtn aria-label={t("recipients.remove")} title={t("recipients.remove")}
              onClick={() => setDraft({ ...draft, emails: draft.emails.filter((_, j) => j !== i) })}>
              <X className="h-4 w-4" />
            </IconBtn>
          ) : <span />}
        </div>
      ))}
      {canEdit && draft.emails.length < MAX_EMAIL_RECIPIENTS && (
        <button type="button" className="la-btn la-btn--soft" onClick={() => setDraft({ ...draft, emails: [...draft.emails, { address: "", name: "" }] })}>
          <Plus size={13} /> {t("recipients.addEmail")}
        </button>
      )}

      <div style={{ marginTop: 20 }}>
        <FieldLabel>{t("recipients.whatsappTitle")}</FieldLabel>
        {!canEdit && draft.whatsapp.length === 0 && <ReadOnlyValue value="" />}
        {draft.whatsapp.map((w, i) => (
          <div key={i} className="neu-inset-super-crisp" style={{ borderRadius: "var(--r-surface)", padding: 12, marginBottom: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr) auto", gap: 8, alignItems: "center" }}>
              {canEdit ? input(w.name, (v) => setWa(i, { name: v }), t("recipients.name")) : <ReadOnlyValue value={w.name} />}
              {canEdit ? input(w.number, (v) => setWa(i, { number: v }), t("recipients.number"), { type: "tel", inputMode: "tel" }) : <ReadOnlyValue value={w.number} />}
              {canEdit ? (
                <IconBtn aria-label={t("recipients.remove")} title={t("recipients.remove")}
                  onClick={() => setDraft({ ...draft, whatsapp: draft.whatsapp.filter((_, j) => j !== i) })}>
                  <X className="h-4 w-4" />
                </IconBtn>
              ) : <span />}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              {w.optedOut ? (
                <>
                  <Badge tone="lost">{t("recipients.optedOut")}</Badge>
                  {canEdit && (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--ink-soft)" }}>
                      <Checkbox checked={w.resubscribe} onCheckedChange={(v) => setWa(i, { resubscribe: v === true })} />
                      {t("recipients.resubscribe")}
                    </label>
                  )}
                </>
              ) : (
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--ink-soft)" }}>
                  <Checkbox checked={w.consent} disabled={!canEdit} onCheckedChange={(v) => setWa(i, { consent: v === true })} />
                  {t("recipients.consent")}
                </label>
              )}
              {!w.optedOut && !w.consent && <Badge tone="warn">{t("recipients.noConsent")}</Badge>}
            </div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canEdit && draft.whatsapp.length < MAX_WHATSAPP_RECIPIENTS && (
            <button type="button" className="la-btn la-btn--soft"
              onClick={() => setDraft({ ...draft, whatsapp: [...draft.whatsapp, { number: "", name: "", consent: false, optedOut: false, resubscribe: false }] })}>
              <Plus size={13} /> {t("recipients.addWhatsapp")}
            </button>
          )}
          {showSuggestion && (
            <button type="button" className="la-btn la-btn--soft"
              onClick={() => setDraft({ ...draft, whatsapp: [...draft.whatsapp, { number: suggestion!.number, name: suggestion!.name, consent: false, optedOut: false, resubscribe: false }] })}>
              <Plus size={13} /> {t("recipients.suggest", { name: suggestion!.name || suggestion!.number, number: suggestion!.number })}
            </button>
          )}
        </div>
      </div>

      {canEdit && <SaveRow dirty={dirty} saving={saving} error={null} onSave={submit} onReset={() => { setError(null); reset(); }} />}
      {error && <p role="alert" style={errorStyle}>{error}</p>}
    </Panel>
  );
}
