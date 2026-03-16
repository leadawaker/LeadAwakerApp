import { apiFetch } from "@/lib/apiUtils";

export const fetchProspects = async () => {
  const res = await apiFetch("/api/prospects");
  if (!res.ok) {
    if (res.status === 401) throw new Error("Session expired — please log in again.");
    if (res.status === 403) throw new Error("Access denied — agency account required.");
    throw new Error(`Failed to fetch prospects (${res.status})`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : data?.list || [];
};

export const updateProspect = async (rowId: number | string, patch: Record<string, unknown>) => {
  const res = await apiFetch(`/api/prospects/${rowId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update prospect");
  return await res.json();
};

export const createProspect = async (payload: Record<string, unknown>) => {
  const res = await apiFetch("/api/prospects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create prospect");
  return await res.json();
};

export const deleteProspect = async (rowId: number | string) => {
  const res = await apiFetch(`/api/prospects/${rowId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete prospect");
};
