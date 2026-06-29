import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/apiUtils";

export interface CalendarBlock {
  id: number;
  accountId: number;
  startsAt: string; // ISO
  endsAt: string;   // ISO
  allDay: boolean;
  label: string | null;
}

export function useCalendarBlocks(accountId: number | undefined, timeMin: string, timeMax: string) {
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!accountId || !timeMin || !timeMax) { setBlocks([]); return; }
    let cancelled = false;
    const url = `/api/calendar/blocks?accountId=${accountId}&from=${encodeURIComponent(timeMin)}&to=${encodeURIComponent(timeMax)}`;
    apiFetch(url)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (!cancelled) setBlocks(Array.isArray(d) ? d : []); })
      .catch(() => { if (!cancelled) setBlocks([]); });
    return () => { cancelled = true; };
  }, [accountId, timeMin, timeMax, tick]);

  const createBlock = useCallback(async (data: {
    accountId: number;
    date: string;
    startTime?: string;
    endTime?: string;
    allDay: boolean;
    label?: string;
  }) => {
    const res = await apiFetch("/api/calendar/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    refresh();
    return res.json();
  }, [refresh]);

  const updateBlock = useCallback(async (id: number, data: {
    date?: string;
    startTime?: string;
    endTime?: string;
    allDay?: boolean;
    label?: string;
  }) => {
    const res = await apiFetch(`/api/calendar/blocks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    refresh();
    return res.json();
  }, [refresh]);

  const deleteBlock = useCallback(async (id: number, accountId: number) => {
    const res = await apiFetch(`/api/calendar/blocks/${id}?accountId=${accountId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    refresh();
  }, [refresh]);

  return { blocks, refresh, createBlock, updateBlock, deleteBlock };
}
