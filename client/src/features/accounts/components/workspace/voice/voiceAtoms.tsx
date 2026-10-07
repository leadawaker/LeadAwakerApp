// Small shared pieces for the Voice tab cards: card shell with a scroll anchor,
// field label/help text, the per-card save row and a draft hook.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2 } from "lucide-react";
import { Panel } from "../atoms";
import { cardAnchorId, type VoiceCard } from "./readiness";

export { inputStyle } from "../communication/wizardAtoms";

export const helpStyle = { fontSize: 12.5, color: "var(--mute)", margin: "0 0 12px", lineHeight: 1.5 } as const;

/** A Panel with a stable id so the readiness checklist can scroll to it. */
export function VoiceCardShell({ card, icon, title, action, children }: {
  card: VoiceCard; icon?: ReactNode; title: ReactNode; action?: ReactNode; children: ReactNode;
}) {
  return (
    <div id={cardAnchorId(card)} style={{ scrollMarginTop: 96 }} data-testid={`voice-card-${card}`}>
      <Panel icon={icon} title={title} action={action} pad={20}>
        {children}
      </Panel>
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="eyebrow eyebrow-sm" style={{ marginBottom: 8 }}>{children}</div>;
}

export function ReadOnlyValue({ value }: { value?: string | null }) {
  return (
    <div style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
      {value || <span style={{ color: "var(--mute-2)", fontStyle: "italic" }}>{"—"}</span>}
    </div>
  );
}

/**
 * Local edit state seeded from the server value. Re-seeds whenever the server
 * value changes (a save, or a wizard write-through), so the form never goes stale.
 */
export function useDraft<T>(server: T) {
  const serverKey = useMemo(() => JSON.stringify(server), [server]);
  const [draft, setDraft] = useState<T>(server);
  useEffect(() => { setDraft(server); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [serverKey]);
  const dirty = JSON.stringify(draft) !== serverKey;
  return { draft, setDraft, dirty, reset: () => setDraft(server) };
}

export function SaveRow({ dirty, saving, error, onSave, onReset, canSave = true }: {
  dirty: boolean; saving: boolean; error?: string | null; onSave: () => void; onReset: () => void; canSave?: boolean;
}) {
  const { t } = useTranslation("voiceTab");
  if (!dirty && !error) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
      <button type="button" className="la-btn la-btn--wine" onClick={onSave} disabled={saving || !dirty || !canSave}>
        {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        {t("common.save")}
      </button>
      <button type="button" className="la-btn la-btn--soft" onClick={onReset} disabled={saving || !dirty}>
        {t("common.discard")}
      </button>
      {error && <span role="alert" style={{ fontSize: 12.5, color: "var(--stage-lost)" }}>{error}</span>}
    </div>
  );
}
