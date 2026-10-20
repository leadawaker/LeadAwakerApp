import { useCallback, useState } from "react";
import { readPref, writePref } from "./localPref";

export const PRESENTING_KEY = "la.voiceCalls.presenting";

/**
 * Presenting mode hides caller names and numbers for screenshares. Owner only:
 * a client looking at their own account is never masked and has no toggle.
 * Names show by default (Gabriel, 2026-10-15); "1" in storage means the Owner
 * switched presenting on, and it stays on until switched off.
 */
export function usePresenting(isOwner: boolean): { masked: boolean; toggle: () => void } {
  const [ownerMasked, setOwnerMasked] = useState(() => readPref(PRESENTING_KEY) === "1");

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
