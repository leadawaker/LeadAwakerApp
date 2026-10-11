// The receptionist's WhatsApp message templates for one account: what each
// one says, whether Meta has approved it, and the buttons to send them in.
// Spec: specs/receptionist-channels, Phase 4. The texts come from the engine's
// catalog; nothing here is edited by hand.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Loader2, RefreshCw, Send } from "lucide-react";
import { IconTile, SectionHead } from "../integrationsAtoms";
import { CARD_STYLE, EXPLAINER, MONO_LABEL, Note, TonePill, type Tone } from "./whatsappAtoms";
import {
  useWhatsappSender, useWhatsappTemplates, WhatsappApiError,
  type TemplateActionResult, type TemplateRow, type TemplateStatus,
} from "./whatsappApi";

const STATUS_TONE: Record<TemplateStatus, Tone> = {
  not_submitted: "mute", pending: "warn", approved: "good", rejected: "bad", paused: "warn", disabled: "mute",
};
const rowKey = (r: { name: string; language: string }) => `${r.name}:${r.language}`;

function TemplateItem({ row, canAct, busy, working, onResubmit }: {
  row: TemplateRow; canAct: boolean; busy: boolean; working: boolean; onResubmit: () => void;
}) {
  const { t } = useTranslation("whatsappCloud");
  const reason = row.rejectedReason
    ? t(`templates.reasons.${row.rejectedReason}`, { defaultValue: row.rejectedReason })
    : null;
  return (
    <li
      style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", borderRadius: "var(--r-button)", background: "var(--card)", boxShadow: "var(--sh-inset)" }}
      data-testid={`whatsapp-template-${row.name}-${row.language}`}
    >
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
            {t(`templates.names.${row.name}`, { defaultValue: row.name })}
          </div>
          <div style={{ ...MONO_LABEL, marginTop: 3 }}>{t(`templates.languages.${row.language}`, { defaultValue: row.language })}</div>
        </div>
        {row.outdated && <TonePill tone="warn">{t("templates.outdated")}</TonePill>}
        <TonePill tone={STATUS_TONE[row.status] ?? "mute"}>
          {t(`templates.status.${row.status}`, { defaultValue: row.status })}
        </TonePill>
        {row.canResubmit && canAct && (
          <button type="button" className="la-btn la-btn--soft" disabled={busy} onClick={onResubmit}>
            {working ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {t("templates.resubmit")}
          </button>
        )}
      </div>
      {row.preview && (
        <p style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.55, margin: 0, overflowWrap: "anywhere" }}>{row.preview}</p>
      )}
      {row.status === "rejected" && reason && <Note tone="bad">{t("templates.rejectedReason", { reason })}</Note>}
    </li>
  );
}

export function WhatsAppTemplatesCard({ accountId }: { accountId: number }) {
  const { t } = useTranslation("whatsappCloud");
  const { sender } = useWhatsappSender(accountId);
  const { rows, catalogAvailable, loading, submit, refresh } = useWhatsappTemplates(accountId, !!sender);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: Tone; text: string } | null>(null);

  // Templates belong to a WhatsApp account: without one there is nothing to show.
  if (!sender) return null;

  const connected = sender.status === "connected";
  const busy = submit.isPending || refresh.isPending;
  const errorText = (code: string | null | undefined, fallback?: string | null) =>
    t(`templates.errors.${code || "unknown"}`, { defaultValue: fallback || t("templates.errors.unknown") });

  const run = async (key: string, action: () => Promise<TemplateActionResult>, done: (r: TemplateActionResult) => string) => {
    setWorking(key); setMessage(null);
    try {
      const r = await action();
      if (r.failed) setMessage({ tone: "bad", text: t("templates.result.failed", { count: r.failed, error: r.error ?? "" }) });
      else if (!r.ok) setMessage({ tone: "bad", text: errorText(r.errorCode, r.error) });
      else setMessage({ tone: "good", text: done(r) });
    } catch (err) {
      setMessage({ tone: "bad", text: err instanceof WhatsappApiError ? errorText(err.code, err.message) : errorText(null) });
    } finally {
      setWorking(null);
    }
  };
  const submitted = (r: TemplateActionResult) =>
    r.submitted ? t("templates.result.submitted", { count: r.submitted }) : t("templates.result.nothing");

  return (
    <div className="neu-raised" style={CARD_STYLE} data-testid="whatsapp-templates-card">
      <SectionHead>
        <IconTile><FileText size={18} style={{ color: "var(--mute-2)" }} /></IconTile>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{t("templates.title")}</span>
        {connected && (
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="la-btn la-btn--soft" disabled={busy} onClick={() => void run("refresh", () => refresh.mutateAsync(), () => t("templates.result.refreshed"))}>
              {working === "refresh" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {working === "refresh" ? t("templates.refreshing") : t("templates.refresh")}
            </button>
            <button type="button" className="la-btn la-btn--wine" disabled={busy} onClick={() => void run("all", () => submit.mutateAsync(undefined), submitted)}>
              {working === "all" ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              {working === "all" ? t("templates.submitting") : t("templates.submitAll")}
            </button>
          </div>
        )}
      </SectionHead>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={EXPLAINER}>{t("templates.explainer")}</p>
        {!connected && <Note tone="warn">{t("templates.needsConnection")}</Note>}
        {!catalogAvailable && <Note tone="warn">{t("templates.catalogUnavailable")}</Note>}
        {message && <Note tone={message.tone}>{message.text}</Note>}

        {loading ? null : rows.length === 0 ? (
          <Note tone="mute">{t("templates.empty")}</Note>
        ) : (
          <>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {rows.map((row) => (
                <TemplateItem
                  key={rowKey(row)}
                  row={row}
                  canAct={connected}
                  busy={busy}
                  working={working === rowKey(row)}
                  onResubmit={() => void run(rowKey(row), () => submit.mutateAsync({ name: row.name, language: row.language }), submitted)}
                />
              ))}
            </ul>
            {catalogAvailable && <p style={{ fontSize: 10.5, color: "var(--mute)", fontStyle: "italic", margin: 0 }}>{t("templates.sampleNote")}</p>}
          </>
        )}
      </div>
    </div>
  );
}
