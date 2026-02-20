import { apiFetch } from "@/lib/apiUtils";

export const fetchLeads = async (accountId?: number) => {
  const params = new URLSearchParams();
  if (accountId) params.set("accountId", String(accountId));
  const qs = params.toString();
  const url = qs ? `/api/leads?${qs}` : "/api/leads";
  const res = await apiFetch(url);
  if (!res.ok) throw new Error("Failed to fetch leads");
  const data = await res.json();
  return Array.isArray(data) ? data : data?.list || [];
};

export const updateLead = async (rowId: number | string, patch: any) => {
  const res = await apiFetch(`/api/leads/${rowId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update lead");
  return await res.json();
};

export const createLead = async (payload: any) => {
  const res = await apiFetch("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create lead");
  return await res.json();
};

export const deleteLead = async (rowId: number | string) => {
  const res = await apiFetch(`/api/leads/${rowId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete lead");
};

/** Bulk update multiple leads at once (e.g. move stage, assign campaign) */
export const bulkUpdateLeads = async (
  ids: number[],
  data: Record<string, any>,
) => {
  const res = await apiFetch("/api/leads/bulk-update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, data }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Bulk update failed");
  }
  return await res.json();
};

/** Bulk add tags to multiple leads */
export const bulkTagLeads = async (
  leadIds: number[],
  tagIds: number[],
) => {
  const res = await apiFetch("/api/leads/bulk-tag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leadIds, tagIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Bulk tag failed");
  }
  return await res.json();
};
