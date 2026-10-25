// Two-step confirm for a destructive button: the first tap arms it (the button shows "Tap again to
// delete"), a second tap within the window runs the action, and it disarms by itself after that.
import { useCallback, useEffect, useRef, useState } from "react";

export const TAP_AGAIN_MS = 4000;

export function useTapAgain(onConfirm: () => void, windowMs = TAP_AGAIN_MS) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const tap = useCallback(() => {
    clearTimeout(timer.current);
    if (armed) {
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), windowMs);
  }, [armed, onConfirm, windowMs]);
  return { armed, tap };
}
