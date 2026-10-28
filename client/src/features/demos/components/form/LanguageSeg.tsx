import { cn } from "@/lib/utils";
import type { DemoLang } from "@/features/campaigns/api/demoClientsApi";

const LANGS: readonly DemoLang[] = ["en", "nl", "pt"];

/** EN | NL | PT as one segmented control. The codes are the same in every UI language. */
export function LanguageSeg({ value, onChange, disabled, ariaLabel }: {
  value: DemoLang;
  onChange: (lang: DemoLang) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <div className="la-seg la-seg--fill max-md:[&_.la-seg-btn]:min-h-11" role="radiogroup" aria-label={ariaLabel}>
      {LANGS.map((lang) => (
        <button
          key={lang}
          type="button"
          role="radio"
          aria-checked={value === lang}
          disabled={disabled}
          className={cn("la-seg-btn", value === lang && "on")}
          style={{ padding: "8px 12px", fontSize: 11, letterSpacing: "0.13em" }}
          onClick={() => onChange(lang)}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
