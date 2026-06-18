import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/apiUtils";

export interface BusySlot {
  start: string; // ISO
  end: string;   // ISO
}

/**
 * Fetches merged busy intervals across an account's connected calendars for the
 * given window. Returns [] when no account / no connections (free/busy is
 * per-account, so an "all accounts" view passes accountId = undefined).
 * `refresh()` forces a re-fetch without changing the window parameters.
 */
export function useCalendarFreeBusy(accountId: number | undefined, timeMin: string, timeMax: string) {
  const [busy, setBusy] = useState<BusySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!accountId || !timeMin || !timeMax) { setBusy([]); return; }
    let cancelled = false;
    setLoading(true);
    apiFetch(`/api/calendar/freebusy?accountId=${accountId}&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`)
      .then((r) => (r.ok ? r.json() : { busy: [] }))
      .then((d) => { if (!cancelled) setBusy(Array.isArray(d.busy) ? d.busy : []); })
      .catch(() => { if (!cancelled) setBusy([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [accountId, timeMin, timeMax, tick]);

  return { busy, loading, refresh };
}
