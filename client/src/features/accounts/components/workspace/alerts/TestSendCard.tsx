// "Send test": one sample recap or alert through the real send path, to this
// account's own recipients on one channel, or only to the owner. Agency only.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Send } from "lucide-react";
import { Panel } from "../atoms";
import { ALERT_TYPES } from "@shared/clientAlerts";
import { FieldLabel, errorStyle, helpStyle, inputStyle } from "./alertsAtoms";
import type { AlertSettingsResponse, TestResult, TestType } from "./alertsApi";

const BUTTONS = [
  { key: "email", channel: "email", className: "la-btn la-btn--wine", label: "test.email" },
  { key: "whatsapp", channel: "whatsapp", className: "la-btn la-btn--soft", label: "test.whatsapp" },
  { key: "emailMe", channel: "email", className: "la-btn la-btn--soft", label: "test.emailMe" },
  { key: "whatsappMe", channel: "whatsapp", className: "la-btn la-btn--soft", label: "test.whatsappMe" },
] as const;
type Button = (typeof BUTTONS)[number]["key"];

export function TestSendCard({ settings, onTest }: {
  settings: AlertSettingsResponse;
  onTest: (body: { channel: "email" | "whatsapp"; type: TestType; onlyMe?: boolean }) => Promise<TestResult>;
}) {
  const { t } = useTranslation("clientAlerts");
  const [type, setType] = useState<TestType>("daily_recap");
  const [busy, setBusy] = useState<Button | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const r = settings.alerts.recipients;
  const hasEmail = r.emails.length > 0;
  const hasWa = r.whatsapp.some((w) => w.optedInAt && !w.optedOutAt);

  const run = async (button: Button) => {
    const onlyMe = button.endsWith("Me");
    setBusy(button);
    setResult(null);
    try {
      const res = await onTest({ channel: button.startsWith("email") ? "email" : "whatsapp", type, onlyMe });
      if (res.ok) setResult({ ok: true, text: onlyMe ? t("test.sentMe") : t("test.sent", { count: res.results?.filter((x) => x.status === "sent").length ?? 1 }) });
      else {
        const why = res.error ?? res.results?.find((x) => x.error)?.error ?? "";
        const known = ["no_recipients", "owner_not_listed", "engine_unavailable", "engine_not_restarted"].includes(why);
        setResult({ ok: false, text: known ? t(`test.errors.${why}`) : t("test.failed", { error: why }) });
      }
    } catch (e) {
      setResult({ ok: false, text: t("test.failed", { error: (e as Error).message }) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel icon={<Send size={17} />} title={t("test.title")} pad={20}>
      <p style={helpStyle}>{t("test.help")}</p>
      <FieldLabel>{t("test.type")}</FieldLabel>
      <select value={type} onChange={(e) => setType(e.target.value as TestType)} className="neu-inset-crisp"
        style={{ ...inputStyle, maxWidth: 300 }} aria-label={t("test.type")}>
        <option value="daily_recap">{t("types.daily_recap.label")}</option>
        {ALERT_TYPES.map((k) => <option key={k} value={k}>{t(`types.${k}.label`)}</option>)}
      </select>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        {BUTTONS.map(({ key, channel, className, label }) => (
          <button key={key} type="button" className={className} disabled={!(channel === "email" ? hasEmail : hasWa) || busy !== null}
            onClick={() => run(key)}>
            {busy === key ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} {t(label)}
          </button>
        ))}
      </div>
      {result && (
        <p role={result.ok ? "status" : "alert"} style={result.ok ? { ...helpStyle, margin: "10px 0 0", color: "var(--ink-soft)" } : errorStyle}>
          {result.text}
        </p>
      )}
    </Panel>
  );
}
