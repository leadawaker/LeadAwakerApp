import { useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import type { DemoCopy } from "../copy";

const FIELD =
  "h-10 w-full rounded-[var(--r-button)] border border-border bg-[hsl(var(--input-bg))] px-3 text-sm";

/**
 * The /voice-demo door. Deliberately shows no hint of what the password is —
 * printing "hello / ola / hoi" here would defeat the point of gating a page
 * that mints real, billable Realtime sessions. Gabriel tells prospects the
 * word directly (verbally, or over WhatsApp).
 */
export function VoiceDemoLock({
  onUnlock,
  copy,
}: {
  onUnlock: (raw: string) => boolean;
  copy: DemoCopy;
}) {
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    if (!onUnlock(value)) {
      setWrong(true);
      setValue("");
    }
  };

  return (
    <div
      className="flex min-h-svh flex-col items-center justify-center p-4 sm:p-8"
      style={{ background: "var(--bone)" }}
    >
      <form
        onSubmit={submit}
        className="flex w-full max-w-sm flex-col items-center gap-3 rounded-[var(--r-panel)] border border-border p-8 text-center shadow-lg"
        style={{ background: "var(--card)" }}
      >
        <Lock className="mb-1 h-6 w-6 text-muted-foreground" />
        <h1 className="text-lg font-semibold tracking-tight">{copy.lockedTitle}</h1>
        <p className="text-sm text-muted-foreground">{copy.lockedHint}</p>
        <input
          autoFocus
          type="password"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setWrong(false);
          }}
          className={FIELD}
          placeholder={copy.passwordPlaceholder}
        />
        {wrong && <p className="text-sm text-destructive">{copy.wrongPassword}</p>}
        <button
          type="submit"
          className="h-10 w-full rounded-[var(--r-button)] bg-primary text-sm font-semibold text-primary-foreground"
        >
          {copy.continueLabel}
        </button>
      </form>
    </div>
  );
}
