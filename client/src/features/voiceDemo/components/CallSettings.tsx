import { Settings2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DEMO_COMPANY } from "../door";
import type { LiveOptions, LiveSetup, VoiceLocale } from "../types";
import { demoCallerNumber } from "../demoNumber";
import type { DemoCopy } from "../copy";

/**
 * Everything about the call that is set before it, behind one gear under the
 * phone, so the page before a call is only the phone.
 *
 * A link minted for a prospect (`simple`) gets the voice picker alone: its
 * language and company were decided when the link was made, and a form is a
 * thing to get wrong in front of someone you are trying to impress. The voice
 * stays, for now, so voices can be compared on the real thing.
 */

const FIELD =
  "w-full rounded-[var(--r-field)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40";
const LABEL = "mb-1.5 block text-xs font-medium text-muted-foreground";

export function CallSettings({
  setup,
  options,
  simple,
  copy,
  onSetup,
}: {
  setup: LiveSetup;
  options: LiveOptions | null;
  simple: boolean;
  copy: DemoCopy;
  onSetup: (next: Partial<LiveSetup>) => void;
}) {
  const locales = options?.locales ?? [];
  const current = locales.find((l) => l.id === setup.locale);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={copy.settingsLabel}
          title={copy.settingsLabel}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:rotate-45 hover:text-foreground"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" sideOffset={12} className="w-80 space-y-4 p-4">
        <div className="text-sm font-semibold">{copy.settingsLabel}</div>

        {!simple && (
          <>
            <div>
              <label htmlFor="vd-locale" className={LABEL}>{copy.languageLabel}</label>
              <select
                id="vd-locale"
                className={FIELD}
                value={setup.locale}
                onChange={(e) => onSetup({ locale: e.target.value as VoiceLocale, voice: "" })}
              >
                {locales.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
              {current?.needs_listening_test && (
                // Said plainly rather than hidden: OpenAI publishes no voice for
                // this language, so she speaks it through a voice built for
                // another one and the accent is not guaranteed.
                <p className="mt-1.5 text-xs text-muted-foreground">{copy.noNativeVoice}</p>
              )}
            </div>

            <div>
              <label htmlFor="vd-company" className={LABEL}>{copy.companyLabel}</label>
              <input
                id="vd-company"
                className={FIELD}
                value={setup.companyName}
                placeholder={DEMO_COMPANY[current?.language ?? "en"]}
                onChange={(e) => onSetup({ companyName: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="vd-phone" className={LABEL}>{copy.phoneLabel}</label>
              <input
                id="vd-phone"
                className={FIELD}
                value={setup.callerNumber}
                placeholder={demoCallerNumber(setup.locale)}
                onChange={(e) => onSetup({ callerNumber: e.target.value })}
              />
            </div>
          </>
        )}

        <div>
          <label htmlFor="vd-voice" className={LABEL}>{copy.voiceLabel}</label>
          <select
            id="vd-voice"
            className={FIELD}
            value={setup.voice}
            onChange={(e) => onSetup({ voice: e.target.value })}
          >
            {/* The default names its voice, so it is never a mystery. */}
            <option value="">
              {copy.voiceDefault}
              {current?.voice ? ` (${current.voice})` : ""}
            </option>
            {(options?.voices ?? []).map((v) => (
              <option key={v.id} value={v.id}>{v.id} — {v.label}</option>
            ))}
          </select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
