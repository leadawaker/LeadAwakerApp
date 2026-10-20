/**
 * Small shared pieces for the ClientGuide illustrations. Everything is drawn
 * with design tokens so the pictures follow light and dark mode.
 */

import { Pill } from "@/components/crm/primitives";

/** Translator bound to `clientGuide.*` with the guide's name/company vars. */
export type K = (key: string) => string;

/** Outcome colours, shared by the call flow, the Calls tabs and the email. */
export const OUTCOME_COLOR = {
  booked: "var(--good)",
  callback: "var(--warn)",
  transferred: "var(--wine)",
  answered: "var(--mute)",
} as const;

export type Outcome = keyof typeof OUTCOME_COLOR;

/** Captioned frame around one illustration. Capped so it never stretches wide. */
export function Figure({ caption, children, max = 420 }: { caption: string; children: React.ReactNode; max?: number }) {
  return (
    <figure className="m-0 w-full" style={{ maxWidth: max }} aria-label={caption}>
      <div
        className="w-full overflow-hidden p-3"
        style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "var(--r-card)" }}
      >
        {children}
      </div>
      <figcaption className="mt-1.5 text-[11px]" style={{ color: "var(--mute)" }}>{caption}</figcaption>
    </figure>
  );
}

export function OutcomePill({ outcome, children }: { outcome: Outcome; children: React.ReactNode }) {
  return <Pill color={OUTCOME_COLOR[outcome]}>{children}</Pill>;
}

/** The small "Needs you" marker shown next to a person waiting on the client. */
export function NeedsYou({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold whitespace-nowrap" style={{ color: "var(--warn)" }}>
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--warn)" }} />
      {children}
    </span>
  );
}

/** A rounded phone outline; children are the screen. */
export function PhoneFrame({ children, max = 260 }: { children: React.ReactNode; max?: number }) {
  return (
    <div
      className="mx-auto w-full overflow-hidden flex flex-col"
      style={{
        maxWidth: max,
        border: "6px solid var(--ink-soft)",
        borderRadius: 28,
        background: "var(--surface)",
      }}
    >
      <div className="flex justify-center pt-1.5 pb-1" aria-hidden>
        <span className="block h-1.5 w-12 rounded-full" style={{ background: "var(--line-strong)" }} />
      </div>
      {children}
    </div>
  );
}

/** A single raised row inside a mock screen. */
export function MockRow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-2 ${className}`}
      style={{ background: "var(--card)", borderRadius: "var(--r-button)", border: "1px solid var(--line)" }}
    >
      {children}
    </div>
  );
}
