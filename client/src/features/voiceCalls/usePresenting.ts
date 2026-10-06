import { useCallback, useState } from "react";
import { readPref, writePref } from "./localPref";

export const PRESENTING_KEY = "la.voiceCalls.presenting";

/**
 * Presenting mode hides caller names and numbers for screenshares. Owner only:
 * a client looking at their own account is never masked and has no toggle.
 * Masked by default for the Owner; "0" in storage means they chose to reveal.
 */
export function usePresenting(isOwner: boolean): { masked: boolean; toggle: () => void } {
  const [ownerMasked, setOwnerMasked] = useState(() => readPref(PRESENTING_KEY) !== "0");

  const toggle = useCallback(() => {
    if (!isOwner) return;
    setOwnerMasked((prev) => {
      const next = !prev;
      writePref(PRESENTING_KEY, next ? "1" : "0");
      return next;
    });
  }, [isOwner]);

  return { masked: isOwner && ownerMasked, toggle };
}
