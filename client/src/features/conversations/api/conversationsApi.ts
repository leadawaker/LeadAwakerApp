import { apiFetch } from "@/lib/apiUtils";

export const fetchLeads = async (accountId?: number) => {
  const params = accountId ? `?accountId=${accountId}` : "";
  const res = await apiFetch(`/api/leads${params}`);
  if (!res.ok) throw new Error("Failed to fetch leads");
  const data = await res.json();
  return Array.isArray(data) ? data : data?.list || [];
};

export const fetchInteractions = async (accountId?: number) => {
  const params = accountId ? `?accountId=${accountId}` : "";
  const res = await apiFetch(`/api/interactions${params}`);
  if (!res.ok) throw new Error("Failed to fetch interactions");
  const data = await res.json();
  return Array.isArray(data) ? data : data?.list || [];
};

export const fetchInteractionsByLeadId = async (leadId: number) => {
  const res = await apiFetch(`/api/interactions?leadId=${leadId}`);
  if (!res.ok) throw new Error("Failed to fetch interactions for lead");
  const data = await res.json();
  return Array.isArray(data) ? data : data?.list || [];
};

export const updateLeadTakeover = async (leadId: number, manualTakeover: boolean) => {
  const res = await apiFetch(`/api/leads/${leadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ manual_takeover: manualTakeover }),
  });
  if (!res.ok) throw new Error("Failed to update lead takeover state");
  return await res.json();
};

export const sendMessage = async (payload: {
  leadsId: number;
  accountsId: number;
  campaignsId?: number;
  content: string;
  type: string;
  direction: string;
  status: string;
  who?: string;
}) => {
  const res = await apiFetch("/api/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return await res.json();
};
