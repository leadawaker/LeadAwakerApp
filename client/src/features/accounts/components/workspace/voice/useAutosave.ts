import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveState = "idle" | "saving" | "saved" | "error";

/**
 * Save `value` a moment after typing stops, and once more when the editor
 * closes with an edit still waiting, so nothing typed is lost to a forgotten
 * Save button. `save` resolves true on success.
 *
 * One save runs at a time and always sends the editor's current text, so a
 * slow older save can never land after a newer one, and text typed and then
 * deleted again inside the debounce window is never sent.
 */
export function useAutosave(value: string, saved: string, save: (value: string) => Promise<boolean>, delayMs = 900) {
  const [state, setState] = useState<AutosaveState>("idle");
  const lastSaved = useRef(saved);
  const latest = useRef(value);
  latest.current = value;
  const running = useRef<Promise<void> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  // A fresh server value (another save, a refetch) is the new baseline.
  useEffect(() => { lastSaved.current = saved; }, [saved]);

  const flush = useCallback(async () => {
    while (running.current) await running.current;
    const next = latest.current;
    if (next === lastSaved.current) return;
    const run = (async () => {
      setState("saving");
      let ok = false;
      try { ok = await saveRef.current(next); } catch { ok = false; }
      if (ok) lastSaved.current = next;
      setState(ok ? "saved" : "error");
    })();
    running.current = run;
    try { await run; } finally { if (running.current === run) running.current = null; }
  }, []);

  // Also scheduled when the text goes back to the saved text: a save still
  // running may be about to store the edit that was just undone.
  useEffect(() => {
    const id = window.setTimeout(() => { void flush(); }, delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs, flush]);

  // Leaving the section with an edit still in the debounce window.
  useEffect(() => () => { void flush(); }, [flush]);

  return state;
}
