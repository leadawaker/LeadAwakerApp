// Small controls shared by Demos > Settings and the account Voice tab's line
// engine card: inputs, the segmented switch, the card frame and its save bar.
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

export const ENGINE_INPUT: React.CSSProperties = {
  height: 34,
  borderRadius: "var(--r-field, 8px)",
  border: "1px solid var(--line)",
  background: "var(--card)",
  color: "var(--ink)",
  padding: "0 9px",
  fontSize: 13,
};
const SEG_BTN: React.CSSProperties = { padding: "6px 11px", fontSize: 11, letterSpacing: "0.08em" };

export function Seg<T extends string>({ value, options, label, ariaLabel, onChange, disabledOptions, describedBy }: {
  value: T; options: T[]; label: (o: T) => string; ariaLabel?: string; onChange: (o: T) => void; disabledOptions?: T[];
  /** Element id that explains an option (e.g. why it is disabled), by option. */
  describedBy?: Partial<Record<T, string>>;
}) {
  return (
    <div className="la-seg" role="radiogroup" aria-label={ariaLabel} style={{ alignSelf: "flex-start" }}>
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={value === o}
          className={value === o ? "la-seg-btn on" : "la-seg-btn"} style={SEG_BTN}
          disabled={disabledOptions?.includes(o)} aria-describedby={describedBy?.[o]} onClick={() => onChange(o)}>
          {label(o)}
        </button>
      ))}
    </div>
  );
}

export const SETTINGS_CARD: React.CSSProperties = {
  borderRadius: "var(--r-card)",
  background: "var(--bone)",
  padding: "20px 22px",
  maxWidth: 560,
};
export const SETTINGS_TITLE: React.CSSProperties = { display: "block", fontSize: 14, fontWeight: 600, color: "var(--ink)" };
export const SETTINGS_LABEL: React.CSSProperties = { flex: 1, minWidth: 90, fontSize: 13, color: "var(--ink)" };
export const SETTINGS_HINT: React.CSSProperties = { display: "block", fontSize: 12, color: "var(--mute)", margin: "2px 0 8px" };
export const SETTINGS_RULE: React.CSSProperties = { height: 1, background: "var(--line)", margin: "18px 0" };

/** Save and cancel under a settings card with a draft; the error sits beside them. */
export function SaveBar({ dirty, pending, error, onSave, onCancel }: {
  dirty: boolean; pending: boolean; error?: Error | null; onSave: () => void; onCancel: () => void;
}) {
  const { t } = useTranslation("demos");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
      <button type="button" className="la-btn la-btn--primary" disabled={!dirty || pending} onClick={onSave}>
        {pending && <Loader2 size={13} className="animate-spin" />}
        {t("settings.voice.save")}
      </button>
      {dirty && (
        <button type="button" className="la-btn la-btn--soft" onClick={onCancel}>
          {t("settings.voice.cancel")}
        </button>
      )}
      {error && <span style={{ fontSize: 12, color: "hsl(var(--destructive))" }}>{error.message}</span>}
    </div>
  );
}
