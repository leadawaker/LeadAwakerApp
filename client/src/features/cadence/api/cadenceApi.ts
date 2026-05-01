import { apiFetch } from "@/lib/apiUtils";

// Returns prospects where nextFollowUpDate <= today and not paused/closed/converted
export const fetchCadenceQueue = async (): Promise<any[]> => {
  const res = await apiFetch("/api/prospects/cadence-queue");
  if (!res.ok) {
    if (res.status === 401) throw new Error("Session expired — please log in again.");
    if (res.status === 403) throw new Error("Access denied — agency account required.");
    throw new Error(`Failed to fetch cadence queue (${res.status})`);
  }
  return res.json();
};

// POST /api/prospects/:id/enter-cadence (no body)
export const enterCadence = async (id: number): Promise<any> => {
  const res = await apiFetch(`/api/prospects/${id}/enter-cadence`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to enter cadence (${res.status})`);
  return res.json();
};

// POST /api/prospects/:id/log-contact with body { channel: string, notes?: string }
export const logContact = async (
  id: number,
  payload: { channel: string; notes?: string }
): Promise<any> => {
  const res = await apiFetch(`/api/prospects/${id}/log-contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to log contact (${res.status})`);
  return res.json();
};

// POST /api/prospects/:id/skip-cadence (no body) — bumps nextFollowUpDate to tomorrow
export const skipCadence = async (id: number): Promise<any> => {
  const res = await apiFetch(`/api/prospects/${id}/skip-cadence`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to skip cadence (${res.status})`);
  return res.json();
};
