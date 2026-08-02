import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CallState, Floor, Turn, VoiceLang } from "../types";

const FLOOR_LABEL: Record<Floor, string> = {
  connecting: "Connecting",
  listening: "Listening",
  speaking: "Emma is speaking",
};

function CallTimer({ startedAt }: { startedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return null;
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return <span className="tabular-nums">{`${mm}:${ss}`}</span>;
}

interface SetupProps {
  language: VoiceLang;
  companyName: string;
  callerNumber: string;
  onLanguage: (v: VoiceLang) => void;
  onCompany: (v: string) => void;
  onCallerNumber: (v: string) => void;
  onCall: () => void;
  busy: boolean;
  error: string | null;
}

function Setup({
  language, companyName, callerNumber,
  onLanguage, onCompany, onCallerNumber, onCall, busy, error,
}: SetupProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-semibold text-primary-foreground">
        E
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Call Emma</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        An AI receptionist that answers the phone, handles the questions, and books the job.
      </p>

      <div className="mt-7 w-full max-w-sm space-y-4 text-left">
        <div>
          <label htmlFor="vd-lang" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Language
          </label>
          <select
            id="vd-lang"
            value={language}
            onChange={(e) => onLanguage(e.target.value as VoiceLang)}
            className="h-10 w-full rounded-[var(--r-button)] border border-border bg-[hsl(var(--input-bg))] px-3 text-sm"
          >
            <option value="en">English</option>
            <option value="nl">Nederlands</option>
            <option value="pt">Português (Brasil)</option>
          </select>
        </div>
        <div>
          <label htmlFor="vd-company" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Business name
          </label>
          <input
            id="vd-company"
            value={companyName}
            onChange={(e) => onCompany(e.target.value)}
            placeholder="Brightside Solar"
            autoComplete="off"
            className="h-10 w-full rounded-[var(--r-button)] border border-border bg-[hsl(var(--input-bg))] px-3 text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">She answers as this company.</p>
        </div>
        <div>
          <label htmlFor="vd-phone" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your number
          </label>
          <input
            id="vd-phone"
            type="tel"
            value={callerNumber}
            onChange={(e) => onCallerNumber(e.target.value)}
            placeholder="+31 6 1234 5678"
            autoComplete="tel"
            className="h-10 w-full rounded-[var(--r-button)] border border-border bg-[hsl(var(--input-bg))] px-3 text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            She sees this as caller ID, so she won&apos;t ask for it.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onCall}
        disabled={busy}
        className="mt-6 inline-flex h-11 w-full max-w-sm items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        <Phone className="h-4 w-4" />
        {busy ? "Connecting…" : "Call Emma"}
      </button>

      {error && (
        <p className="mt-4 w-full max-w-sm rounded-[var(--r-surface)] bg-destructive/10 px-4 py-3 text-left text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

interface CallPanelProps extends SetupProps {
  state: CallState;
  floor: Floor;
  turns: Turn[];
  company: string;
  startedAt: number | null;
  onHangup: () => void;
  onReset: () => void;
}

export function CallPanel(props: CallPanelProps) {
  const { state, floor, turns, company, startedAt, onHangup, onReset } = props;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  if (state === "idle") return <Setup {...props} />;

  const ended = state === "ended";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border bg-muted px-5 py-3.5">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          E
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{company}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {!ended && <span className="h-2 w-2 flex-none animate-pulse rounded-full bg-emerald-500" />}
            <span>{ended ? "Call ended" : FLOOR_LABEL[floor]}</span>
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
            Emma picks up in a moment. Everything either of you says appears here.
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
            {turn.text}
          </div>
        ))}
      </div>
    </div>
  );
}
