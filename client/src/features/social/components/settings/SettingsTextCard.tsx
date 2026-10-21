// One of the three AI-context texts in Settings (caption style, voice guide, about me): title, help,
// a textarea that fills the card, a character counter, and its own Save button. Read-only mode
// (a Viewer) shows the saved text instead of the editor.
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { SocialApiError } from "../../api/socialApi";
import { studioErrorKey } from "../../lib/studio";

export interface SettingsTextCardProps {
  /** Used for the element ids and the default data-testids (`<id>-text`, `<id>-save`). */
  id: string;
  title: string;
  help: string;
  text: string;
  onChange: (text: string) => void;
  max: number;
  dirty: boolean;
  /** The save mutation (only what the card reads from it). */
  save: { mutate: () => void; isPending: boolean; isSuccess: boolean; error: unknown };
  saveLabel: string;
  savedLabel: string;
  placeholder?: string;
  /** Monospace for instruction-like texts (caption style, voice guide). */
  mono?: boolean;
  /** Viewer: show the text, no editor, no save. */
  readOnly?: boolean;
  emptyLabel?: string;
  testIds?: { card?: string; text?: string; save?: string };
}

export function SettingsTextCard(p: SettingsTextCardProps) {
  const { t } = useTranslation("social");
  const fieldId = `settings-${p.id}`;
  const near = p.text.length >= p.max * 0.95;
  return (
    <section className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--bone)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }} data-testid={p.testIds?.card ?? `${fieldId}-card`}>
      <label htmlFor={fieldId} style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{p.title}</label>
      <p style={{ margin: 0, fontSize: 12, color: "var(--mute)", lineHeight: 1.5 }}>{p.help}</p>
      {p.readOnly ? (
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{p.text || p.emptyLabel}</p>
      ) : (
        <>
          <textarea id={fieldId} className="neu-input" maxLength={p.max} value={p.text} placeholder={p.placeholder} onChange={(e) => p.onChange(e.target.value)}
            style={{ flex: 1, minHeight: 260, fontSize: p.mono ? 12.5 : 13.5, lineHeight: 1.55, padding: "10px 12px", width: "100%", resize: "vertical", fontFamily: p.mono ? "var(--mono)" : undefined }}
            data-testid={p.testIds?.text ?? `${fieldId}-text`} />
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="la-btn la-btn--wine" disabled={!p.dirty || p.save.isPending} onClick={() => p.save.mutate()} data-testid={p.testIds?.save ?? `${fieldId}-save`}>
              {p.save.isPending && <Loader2 size={12} className="animate-spin" />}{p.saveLabel}
            </button>
            {p.save.isSuccess && !p.dirty && <span role="status" style={{ fontSize: 12, color: "var(--good)" }}>{p.savedLabel}</span>}
            <span aria-hidden style={{ marginLeft: "auto", fontSize: 11.5, fontFamily: "var(--mono)", color: near ? "hsl(var(--destructive))" : "var(--mute-2)" }}>
              {p.text.length.toLocaleString()} / {p.max.toLocaleString()}
            </span>
          </div>
          {p.save.error && <p role="alert" style={{ margin: 0, fontSize: 12, color: "hsl(var(--destructive))" }}>{t(studioErrorKey(p.save.error instanceof SocialApiError ? p.save.error.reason : "failed"))}</p>}
        </>
      )}
    </section>
  );
}
