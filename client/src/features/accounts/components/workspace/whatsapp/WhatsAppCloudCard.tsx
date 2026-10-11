// Connect a client's own WhatsApp number (Meta Cloud API) from the account
// page. Spec: specs/receptionist-channels, Phase 4.
//
// Five values go in, "Save and test connection" stores them and asks Meta
// whether they work. The two secrets are write-only: the server never sends
// them back, so their inputs are always empty and an empty input keeps the
// stored value.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageCircle, Check, X, Loader2, RefreshCw } from "lucide-react";
import { PanelAction, EditButton } from "../atoms";
import { IconTile, SectionHead } from "../integrationsAtoms";
import { CARD_STYLE, EXPLAINER, Fact, MONO_LABEL, Note, TonePill, type Tone } from "./whatsappAtoms";
import {
  useWhatsappSender, WhatsappApiError,
  type SenderInput, type SenderStatus, type TestResult, type WhatsappSender,
} from "./whatsappApi";

const EMPTY: SenderInput = { wabaId: "", phoneNumberId: "", appId: "", appSecret: "", accessToken: "" };
const ID_FIELDS = ["wabaId", "phoneNumberId", "appId"] as const;
const SECRET_FIELDS = ["appSecret", "accessToken"] as const;
const PILL_TONE: Record<SenderStatus | "none", Tone> = {
  none: "mute", pending: "warn", connected: "good", error: "bad", disabled: "mute",
};
const QUALITY_TONE: Record<string, Tone> = { GREEN: "good", YELLOW: "warn", RED: "bad" };

function formFrom(sender: WhatsappSender | null): SenderInput {
  return sender
    ? { wabaId: sender.wabaId, phoneNumberId: sender.phoneNumberId, appId: sender.appId, appSecret: "", accessToken: "" }
    : EMPTY;
}

export function WhatsAppCloudCard({ accountId }: { accountId: number }) {
  const { t } = useTranslation("whatsappCloud");
  const { sender, loading, save, test } = useWhatsappSender(accountId);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<SenderInput>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);

  if (loading) return null;

  const busy = save.isPending || test.isPending;
  const showForm = !sender || editing;
  const errorText = (code: string | null | undefined, fallback?: string | null) =>
    t(`connect.errors.${code || "unknown"}`, { defaultValue: fallback || t("connect.errors.unknown") });
  const thrownText = (err: unknown) =>
    err instanceof WhatsappApiError ? errorText(err.code, err.message) : t("connect.errors.unknown");

  const runTest = async () => {
    setFormError(null);
    try { setResult(await test.mutateAsync()); }
    catch (err) { setResult(null); setFormError(thrownText(err)); }
  };

  const startEdit = () => { setForm(formFrom(sender)); setFormError(null); setEditing(true); };

  const submit = async () => {
    const values = { ...form };
    for (const k of [...ID_FIELDS, ...SECRET_FIELDS]) values[k] = values[k].trim();
    const secretsMissing = (!sender?.hasAppSecret && !values.appSecret) || (!sender?.hasToken && !values.accessToken);
    if (ID_FIELDS.some((k) => !values[k]) || secretsMissing) return setFormError(t("connect.missing"));
    if (ID_FIELDS.some((k) => !/^\d+$/.test(values[k]))) return setFormError(t("connect.digitsOnly"));
    setFormError(null); setResult(null);
    try {
      await save.mutateAsync(values);
    } catch (err) {
      return setFormError(thrownText(err));
    }
    // Saved: drop the secrets from memory and show the outcome of the test.
    setForm(EMPTY); setEditing(false);
    await runTest();
  };

  const status: SenderStatus | "none" = sender?.status ?? "none";
  // The last test's verdict: from the call that just ran, else what is stored.
  const failure = result && !result.ok
    ? { text: errorText(result.errorCode, result.error), detail: result.metaDetail }
    : !result && sender?.status === "error"
      ? { text: errorText(sender.lastErrorCode, sender.lastError), detail: null }
      : null;

  return (
    <div className="neu-raised" style={CARD_STYLE} data-testid="whatsapp-cloud-card">
      <SectionHead>
        <IconTile><MessageCircle size={18} style={{ color: "var(--mute-2)" }} /></IconTile>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{t("connect.title")}</span>
        <TonePill tone={PILL_TONE[status]}>{t(`connect.pill.${status}`)}</TonePill>
        {sender && !showForm && <EditButton label={t("connect.edit")} onClick={startEdit} />}
      </SectionHead>

      {showForm ? (
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={EXPLAINER}>{t("connect.explainer")}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px 18px" }}>
            {[...ID_FIELDS, ...SECRET_FIELDS].map((key) => {
              const isSecret = key === "appSecret" || key === "accessToken";
              const stored = key === "appSecret" ? sender?.hasAppSecret : key === "accessToken" ? sender?.hasToken : false;
              return (
                <label key={key} style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                  <span style={MONO_LABEL}>{t(`connect.fields.${key}`)}</span>
                  <input
                    className="neu-input"
                    style={{ fontSize: 12, padding: "8px 11px", width: "100%", fontFamily: "var(--mono)" }}
                    type={isSecret ? "password" : "text"}
                    inputMode={isSecret ? undefined : "numeric"}
                    autoComplete={isSecret ? "new-password" : "off"}
                    spellCheck={false}
                    value={form[key]}
                    placeholder={stored ? t("connect.secretSaved") : undefined}
                    disabled={busy}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    data-testid={`whatsapp-field-${key}`}
                  />
                  <span style={{ fontSize: 10.5, color: "var(--mute)", lineHeight: 1.45 }}>{t(`connect.help.${key}`)}</span>
                </label>
              );
            })}
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button type="submit" className="la-btn la-btn--wine" disabled={busy}>
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {save.isPending ? t("connect.saving") : test.isPending ? t("connect.testing") : t("connect.saveAndTest")}
            </button>
            {sender && (
              <PanelAction onClick={() => { setEditing(false); setFormError(null); }} disabled={busy} icon={<X size={12} />}>
                {t("connect.cancel")}
              </PanelAction>
            )}
          </div>
          {formError && <Note tone="bad">{formError}</Note>}
        </form>
      ) : sender && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {(sender.displayPhoneNumber || sender.verifiedName) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px 18px" }}>
              <Fact label={t("connect.facts.number")}>
                {sender.displayPhoneNumber && <span style={{ fontFamily: "var(--mono)" }}>{sender.displayPhoneNumber}</span>}
              </Fact>
              <Fact label={t("connect.facts.verifiedName")}>{sender.verifiedName}</Fact>
              <Fact label={t("connect.facts.nameStatus")}>
                {sender.nameStatus && t(`connect.nameStatus.${sender.nameStatus}`, { defaultValue: sender.nameStatus })}
              </Fact>
              <Fact label={t("connect.facts.quality")}>
                {sender.qualityRating && (
                  <TonePill tone={QUALITY_TONE[sender.qualityRating] ?? "mute"}>
                    {t(`connect.quality.${sender.qualityRating}`, { defaultValue: sender.qualityRating })}
                  </TonePill>
                )}
              </Fact>
            </div>
          )}

          {status === "pending" && !test.isPending && !failure && <Note tone="mute">{t("connect.pendingNote")}</Note>}
          {failure && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Note tone="bad">{failure.text}</Note>
              {failure.detail && <Note tone="mute">{t("connect.metaSays", { detail: failure.detail })}</Note>}
            </div>
          )}
          {formError && <Note tone="bad">{formError}</Note>}
          {result?.ok && <Note tone="good">{t("connect.ok")}</Note>}
          {result?.ok && result.warnings.map((w) => (
            <Note key={w} tone="warn">{t(`connect.warnings.${w}`, { defaultValue: w })}</Note>
          ))}

          <div>
            <button type="button" className="la-btn la-btn--soft" disabled={busy} onClick={() => void runTest()}>
              {test.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {test.isPending ? t("connect.testing") : t("connect.test")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
