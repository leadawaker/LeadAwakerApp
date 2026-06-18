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

export const updateCampaign = async (rowId: number | string, patch: Record<string, unknown>) => {
  const res = await apiFetch(`/api/campaigns/${rowId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update campaign");
  return await res.json();
};

export interface PreflightCheck {
  key: string;
  critical: boolean;
  status: "ok" | "warn" | "error";
  count?: number;
  total?: number;
}
export interface PreflightResult {
  ready: boolean;
  active: boolean;
  checks: PreflightCheck[];
}

export const fetchCampaignPreflight = async (rowId: number | string): Promise<PreflightResult> => {
  const res = await apiFetch(`/api/campaigns/${rowId}/preflight`);
  if (!res.ok) throw new Error("Failed to fetch preflight");
  return await res.json();
};

export const fetchPreflightBatch = async (ids: number[]): Promise<Record<number, { ready: boolean }>> => {
  if (ids.length === 0) return {};
  const res = await apiFetch(`/api/campaigns/preflight-batch?ids=${ids.join(",")}`);
  if (!res.ok) throw new Error("Failed to fetch preflight batch");
  return await res.json();
};

export const createCampaign = async (payload: Record<string, unknown>) => {
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

export const bulkDeleteCampaigns = async (ids: Array<number | string>) => {
  await Promise.all(ids.map((id) => deleteCampaign(id)));
};

export const bulkUpdateCampaigns = async (ids: Array<number | string>, patch: Record<string, unknown>) => {
  await Promise.all(ids.map((id) => updateCampaign(id, patch)));
};
