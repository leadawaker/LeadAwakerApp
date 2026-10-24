// Small controls shared by the engine pickers: Demos > Settings > Engine tests
// and the account Voice tab's line engine card.
import { useTranslation } from "react-i18next";
import type { EngineVoice } from "../api/demoSettingsApi";

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
const GENDERS = ["female", "male", "neutral", null] as const;

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

/** An engine voice list grouped by gender; the empty option is `emptyLabel`. */
export function VoiceSelect({ voices, value, emptyLabel, onChange }: {
  voices: EngineVoice[]; value: string; emptyLabel: string; onChange: (v: string) => void;
}) {
  const { t } = useTranslation("demos");
  return (
    <select style={{ ...ENGINE_INPUT, width: "100%" }} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{emptyLabel}</option>
      {GENDERS.map((g) => {
        const group = voices.filter((v) => v.gender === g);
        return group.length ? (
          <optgroup key={g ?? "other"} label={t(`settings.voice.engines.gender.${g ?? "other"}`)}>
            {group.map((v) => <option key={v.id} value={v.id}>{v.label === v.id ? v.id : `${v.label} (${v.id})`}</option>)}
          </optgroup>
        ) : null;
      })}
    </select>
  );
}
