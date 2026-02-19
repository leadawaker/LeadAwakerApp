import { apiFetch } from "@/lib/apiUtils";

export const fetchCampaigns = async (accountId?: number) => {
  const params = new URLSearchParams();
  if (accountId) params.set("accountId", String(accountId));
  const qs = params.toString();
  const url = qs ? `/api/campaigns?${qs}` : "/api/campaigns";
  const res = await apiFetch(url);
  if (!res.ok) throw new Error("Failed to fetch campaigns");
  const data = await res.json();
  return Array.isArray(data) ? data : data?.list || [];
};

export const updateCampaign = async (rowId: number | string, patch: any) => {
  const res = await apiFetch(`/api/campaigns/${rowId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update campaign");
  return await res.json();
};

export const createCampaign = async (payload: any) => {
  const res = await apiFetch("/api/campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create campaign");
  return await res.json();
};

export const deleteCampaign = async (rowId: number | string) => {
  const res = await apiFetch(`/api/campaigns/${rowId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete campaign");
};
