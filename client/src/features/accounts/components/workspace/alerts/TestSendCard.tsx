// "Send test": one sample recap or alert through the real send path, to this
// account's own recipients on one channel. Agency only.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Send } from "lucide-react";
import { Panel } from "../atoms";
import { ALERT_TYPES } from "@shared/clientAlerts";
import { FieldLabel, errorStyle, helpStyle, inputStyle } from "./alertsAtoms";
import type { AlertSettingsResponse, TestResult, TestType } from "./alertsApi";

export function TestSendCard({ settings, onTest }: {
  settings: AlertSettingsResponse;
  onTest: (body: { channel: "email" | "whatsapp"; type: TestType }) => Promise<TestResult>;
}) {
  const { t } = useTranslation("clientAlerts");
  const [type, setType] = useState<TestType>("daily_recap");
  const [busy, setBusy] = useState<"email" | "whatsapp" | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const r = settings.alerts.recipients;
  const hasEmail = r.emails.length > 0;
  const hasWa = r.whatsapp.some((w) => w.optedInAt && !w.optedOutAt);

  const run = async (channel: "email" | "whatsapp") => {
    setBusy(channel);
    setResult(null);
    try {
      const res = await onTest({ channel, type });
      if (res.ok) setResult({ ok: true, text: t("test.sent", { count: res.results?.filter((x) => x.status === "sent").length ?? 1 }) });
      else {
        const why = res.error ?? res.results?.find((x) => x.error)?.error ?? "";
        const known = ["no_recipients", "engine_unavailable", "engine_not_restarted"].includes(why);
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
        <button type="button" className="la-btn la-btn--wine" disabled={!hasEmail || busy !== null} onClick={() => run("email")}>
          {busy === "email" ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} {t("test.email")}
        </button>
        <button type="button" className="la-btn la-btn--soft" disabled={!hasWa || busy !== null} onClick={() => run("whatsapp")}>
          {busy === "whatsapp" ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} {t("test.whatsapp")}
        </button>
      </div>
      {result && (
        <p role={result.ok ? "status" : "alert"} style={result.ok ? { ...helpStyle, margin: "10px 0 0", color: "var(--ink-soft)" } : errorStyle}>
          {result.text}
        </p>
      )}
    </Panel>
  );
}
