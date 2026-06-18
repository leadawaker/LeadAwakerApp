import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiUtils";

export interface WorkingHours {
  start: number;
  end: number;
}

const DEFAULT: WorkingHours = { start: 9, end: 17 };

export function useCalendarWorkingHours(accountId: number | undefined): WorkingHours {
  const [wh, setWh] = useState<WorkingHours>(DEFAULT);

  useEffect(() => {
    if (!accountId) { setWh(DEFAULT); return; }
    apiFetch(`/api/calendar/working-hours?accountId=${accountId}`)
      .then((r) => (r.ok ? r.json() : DEFAULT))
      .then((d) => setWh(typeof d?.start === "number" && typeof d?.end === "number" ? d : DEFAULT))
      .catch(() => {});
  }, [accountId]);

  return wh;
}
