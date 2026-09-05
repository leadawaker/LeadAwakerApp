import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_COMPANY, MAX_CALL_MS, SPEED_CHOICES } from "../useVoiceCall";
import type { CallState, EndedReason, Floor, Turn, VoiceLang, VoiceOptions } from "../types";

const FIELD =
  "h-10 w-full rounded-[var(--r-button)] border border-border bg-[hsl(var(--input-bg))] px-3 text-sm";
const LABEL =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground";

/** "gpt-realtime-2.1-mini" is not a thing to read out on a demo call. */
function modelLabel(id: string) {
  const base = id.replace("gpt-realtime", "Realtime").replace(/^Realtime$/, "Realtime 1.0");
  return base.replace("-mini", " mini").replace("-", " ");
}

/** Marin (female) and Cedar are the only two voices this demo offers. */
function voiceAvatarSrc(voice: string) {
  return voice === "marin" ? "/avatars/AI_Receptionist_2.png" : "/avatars/images.jpeg";
}

function VoiceAvatar({ voice, className }: { voice: string; className: string }) {
  return (
    <img
      src={voiceAvatarSrc(voice)}
      alt=""
      className={cn(className, "rounded-full object-cover")}
    />
  );
}

const FLOOR_LABEL: Record<Floor, string> = {
  connecting: "Connecting",
  listening: "Listening",
  speaking: "Speaking",
};

const ENDED_LABEL: Record<Exclude<EndedReason, null>, string> = {
  time_limit: "Demo time is up",
  dropped: "Call disconnected",
  completed: "Call finished",
  silence: "Ended — no answer",
};

function CallTimer({ startedAt }: { startedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return null;
  const left = Math.max(0, Math.ceil((startedAt + MAX_CALL_MS - now) / 1000));
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <span className={cn("tabular-nums", left <= 60 && "text-destructive")}>
      {`${mm}:${ss} left`}
    </span>
  );
}

interface SetupProps {
  language: VoiceLang;
  companyName: string;
  callerNumber: string;
  model: string;
  voice: string;
  speed: number;
  options: VoiceOptions;
  onLanguage: (v: VoiceLang) => void;
  onCompany: (v: string) => void;
  onCallerNumber: (v: string) => void;
  onModel: (v: string) => void;
  onVoice: (v: string) => void;
  onSpeed: (v: number) => void;
  onCall: () => void;
  busy: boolean;
  error: string | null;
  /** A pre-configured share link: hide the setup, just offer the call. */
  simple: boolean;
}

function Setup({
  language, companyName, callerNumber, model, voice, speed, options,
  onLanguage, onCompany, onCallerNumber, onModel, onVoice, onSpeed,
  onCall, busy, error, simple,
}: SetupProps) {
  return (
    // Scrolls rather than centring rigidly: opening the voice/model details
    // makes this taller than the panel, and a centred flex column clips its
    // overflow at the top where it cannot be scrolled to. `m-auto` still
    // centres it whenever there is room.
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-8">
      <div className="m-auto flex w-full flex-col items-center text-center">
      <VoiceAvatar voice={voice} className="mb-4 h-16 w-16 flex-none" />
      <h1 className="text-2xl font-semibold tracking-tight">
        {simple ? `Call ${companyName}` : "Call the receptionist"}
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        An AI receptionist that answers the phone, handles the questions, and books the job.
        {simple && " Have a real conversation — they pick up as soon as you call."}
      </p>

      <div className={cn("mt-6 w-full max-w-sm space-y-3.5 text-left", simple && "hidden")}>
        <div>
          <label htmlFor="vd-lang" className={LABEL}>Language</label>
          <select
            id="vd-lang"
            value={language}
            onChange={(e) => onLanguage(e.target.value as VoiceLang)}
            className={FIELD}
          >
            <option value="en">English</option>
            <option value="nl">Nederlands</option>
            <option value="pt">Português (Brasil)</option>
          </select>
        </div>
        <div>
          <label htmlFor="vd-company" className={LABEL}>
            Business name
          </label>
          <input
            id="vd-company"
            value={companyName}
            onChange={(e) => onCompany(e.target.value)}
            placeholder={DEMO_COMPANY[language]}
            autoComplete="off"
            className={FIELD}
          />
          <p className="mt-1 text-xs text-muted-foreground">They answer as this company.</p>
        </div>
        <div>
          <label htmlFor="vd-phone" className={LABEL}>
            Your number
          </label>
          <input
            id="vd-phone"
            type="tel"
            value={callerNumber}
            onChange={(e) => onCallerNumber(e.target.value)}
            placeholder="+31 6 1234 5678"
            autoComplete="tel"
            className={FIELD}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            She sees this as caller ID, so she won&apos;t ask for it.
          </p>
        </div>
      </div>

      <details className={cn("mt-4 w-full max-w-sm text-left", simple && "hidden")}>
        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
          Voice &amp; model · {modelLabel(model)}, {voice}
        </summary>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          <div>
            <label htmlFor="vd-model" className={LABEL}>Model</label>
            <select
              id="vd-model"
              value={model}
              onChange={(e) => onModel(e.target.value)}
              className={FIELD}
            >
              <optgroup label="OpenAI Realtime">
                {options.models.map((m) => (
                  <option key={m} value={m}>{modelLabel(m)}</option>
                ))}
              </optgroup>
              <optgroup label="Google (needs the Gemini door — not built)">
                <option disabled>Gemini Live</option>
              </optgroup>
            </select>
          </div>
          <div>
            <label htmlFor="vd-voice" className={LABEL}>Voice</label>
            <select
              id="vd-voice"
              value={voice}
              onChange={(e) => onVoice(e.target.value)}
              className={FIELD}
            >
              {options.voices.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="vd-speed" className={LABEL}>Pace</label>
            <select
              id="vd-speed"
              value={speed}
              onChange={(e) => onSpeed(Number(e.target.value))}
              className={FIELD}
            >
              {SPEED_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
      </details>

      <button
        type="button"
        onClick={onCall}
        disabled={busy}
        className="mt-6 inline-flex h-11 w-full max-w-sm items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        <Phone className="h-4 w-4" />
        {busy ? "Connecting…" : `Call ${simple ? companyName : "now"}`}
      </button>

      {simple && (
        <p className="mt-3 max-w-sm text-xs text-muted-foreground">
          Your browser will ask for the microphone. Demo calls end automatically after
          five minutes.
        </p>
      )}

      {error && (
        <p className="mt-4 w-full max-w-sm rounded-[var(--r-surface)] bg-destructive/10 px-4 py-3 text-left text-sm text-destructive">
          {error}
        </p>
      )}
      </div>
    </div>
  );
}

interface CallPanelProps extends SetupProps {
  state: CallState;
  floor: Floor;
  turns: Turn[];
  company: string;
  startedAt: number | null;
  endedReason: EndedReason;
  onHangup: () => void;
  onReset: () => void;
}

export function CallPanel(props: CallPanelProps) {
  const { state, floor, turns, company, voice, startedAt, endedReason, onHangup, onReset } = props;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  if (state === "idle") return <Setup {...props} />;

  const ended = state === "ended";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border bg-muted px-5 py-3.5">
        <VoiceAvatar voice={voice} className="h-10 w-10 flex-none" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{company}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {!ended && <span className="h-2 w-2 flex-none animate-pulse rounded-full bg-emerald-500" />}
            <span>
              {ended
                ? (endedReason && ENDED_LABEL[endedReason]) || "Call ended"
                : FLOOR_LABEL[floor]}
            </span>
            {!ended && startedAt && (
              <>
                <span aria-hidden>·</span>
                <CallTimer startedAt={startedAt} />
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={ended ? onReset : onHangup}
          className="inline-flex h-9 flex-none items-center gap-1.5 rounded-full border border-destructive/40 px-4 text-xs font-semibold text-destructive transition hover:bg-destructive/10"
        >
          {!ended && <PhoneOff className="h-3.5 w-3.5" />}
          {ended ? "Start over" : "Hang up"}
        </button>
      </div>

      <div ref={scrollRef} className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-5">
        {turns.length === 0 && (
          <p className="m-auto max-w-[30ch] text-center text-sm text-muted-foreground">
            Alex picks up in a moment. Everything either of you says appears here.
          </p>
        )}
        {turns.map((turn) => (
          <div
            key={turn.id}
            className={cn(
              "max-w-[80%] whitespace-pre-wrap rounded-[var(--r-surface)] px-3.5 py-2.5 text-sm leading-relaxed",
              turn.side === "them"
                ? "self-start rounded-bl-sm bg-highlight-selected"
                : "self-end rounded-br-sm bg-muted",
              turn.pending && "opacity-70",
            )}
          >
            {turn.text || <TypingDots />}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A turn whose audio has happened but whose transcript is still in flight. */
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="transcribing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-current opacity-50"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}
