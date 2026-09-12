import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, RotateCcw } from "lucide-react";
import { DEMO_COMPANY } from "../door";
import type {
  CallState,
  EndedReason,
  LiveOptions,
  LiveSetup,
  Turn,
  VoiceLocale,
} from "../types";
import type { DemoCopy } from "../copy";

/**
 * The left panel: call setup before the call, transcript during and after.
 *
 * Deliberately missing, versus the Realtime panel this replaces: the floor
 * indicator ("she's listening" / "she's speaking") and the per-turn pending
 * dots. Both existed to make Realtime's turn machinery legible, and a prospect
 * should not be watching the plumbing. The orb says everything about who holds
 * the floor that a prospect needs to know.
 */

const FIELD =
  "w-full rounded-[var(--r-field)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60";
const LABEL = "mb-1.5 block text-xs font-medium text-muted-foreground";

/** The clock the caller sees. Matches MAX_CALL_MS in useLiveCall. */
const MAX_CALL_MS = 5 * 60 * 1000;

const ENDED_KEY: Record<Exclude<EndedReason, null>, keyof DemoCopy> = {
  time_limit: "endedTimeLimit",
  dropped: "endedDropped",
  completed: "endedCompleted",
  silence: "endedSilence",
};

function CallTimer({ startedAt }: { startedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return null;
  const left = Math.max(0, Math.round((MAX_CALL_MS - (now - startedAt)) / 1000));
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return <span className="tabular-nums text-xs text-muted-foreground">{mm}:{ss}</span>;
}

export function LiveCallPanel({
  state,
  turns,
  company,
  startedAt,
  endedReason,
  error,
  setup,
  options,
  simple,
  copy,
  onSetup,
  onCall,
  onHangup,
  onReset,
}: {
  state: CallState;
  turns: Turn[];
  company: string | null;
  startedAt: number | null;
  endedReason: EndedReason;
  error: string | null;
  setup: LiveSetup;
  options: LiveOptions | null;
  /**
   * A link minted for a prospect (it carries a token, or ?start=1). The setup
   * form is theirs to never see: the language, the company and the voice were
   * decided when the link was made, and a form is a thing to get wrong in
   * front of someone you are trying to impress.
   */
  simple: boolean;
  copy: DemoCopy;
  onSetup: (next: Partial<LiveSetup>) => void;
  onCall: () => void;
  onHangup: () => void;
  onReset: () => void;
}) {
  const locales = options?.locales ?? [];
  const current = locales.find((l) => l.id === setup.locale);

  /**
   * Follow the conversation. Deltas stream in a few characters at a time, so
   * this keys on the last turn's length as well as the count: a turn that is
   * still being written grows without ever adding a new bubble, and the
   * transcript would sit still while she talked.
   */
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const tail = turns.length ? turns[turns.length - 1].text.length : 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length, tail]);

  if (state === "idle" && simple) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
        <div>
          <h1 className="text-xl font-semibold">{setup.companyName}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {copy.simplePrompt}
          </p>
        </div>
        <button
          type="button"
          onClick={onCall}
          className="inline-flex items-center justify-center gap-2.5 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition hover:brightness-110"
        >
          <Phone className="h-4 w-4" />
          {copy.call}
        </button>
        {error && <p className="max-w-xs text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  if (state === "idle") {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto p-6 lg:p-8">
        <h1 className="text-lg font-semibold">{copy.setupTitle}</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">
          {copy.setupSubtitle}
        </p>

        <div className="space-y-4">
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
              <p className="mt-1.5 text-xs text-muted-foreground">
                {copy.noNativeVoice}
              </p>
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
              placeholder="+31 6 12345678"
              onChange={(e) => onSetup({ callerNumber: e.target.value })}
            />
          </div>

          <details className="rounded-[var(--r-surface)] border border-border/60 px-3 py-2">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              {copy.voiceLabel} · {setup.voice || current?.voice || "—"}
            </summary>
            <div className="pt-3">
              <select
                className={FIELD}
                value={setup.voice}
                onChange={(e) => onSetup({ voice: e.target.value })}
              >
                <option value="">{copy.voiceDefault}</option>
                {(options?.voices ?? []).map((v) => (
                  <option key={v.id} value={v.id}>{v.id} — {v.label}</option>
                ))}
              </select>
            </div>
          </details>
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <button
          type="button"
          onClick={onCall}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-[var(--r-field)] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <Phone className="h-4 w-4" />
          {copy.callHer}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-none items-center gap-3 border-b border-border px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{company || setup.companyName}</div>
          <div className="text-xs text-muted-foreground">
            {state === "connecting"
              ? copy.connecting
              : state === "live"
                ? copy.onCall
                : copy.callEnded}
          </div>
        </div>
        {state === "live" && <CallTimer startedAt={startedAt} />}
        {state === "ended" ? (
          <button type="button" onClick={onReset} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium">
            <RotateCcw className="h-3.5 w-3.5" />
            {copy.again}
          </button>
        ) : (
          <button type="button" onClick={onHangup} className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground">
            <PhoneOff className="h-3.5 w-3.5" />
            {copy.hangUp}
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
        {turns.length === 0 && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            {copy.sayHello}
          </p>
        )}
        {turns.map((t) => (
          <div key={t.id} className={t.side === "you" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] rounded-[var(--r-surface)] px-3.5 py-2 text-sm ${
                t.side === "you"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border/60 bg-background"
              }`}
            >
              {t.text}
            </div>
          </div>
        ))}
        {endedReason && (
          <p className="pt-2 text-center text-xs text-muted-foreground">{copy[ENDED_KEY[endedReason]]}</p>
        )}
        {error && <p className="pt-2 text-center text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
