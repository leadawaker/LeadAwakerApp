import { apiFetch } from "@/lib/apiUtils";

export async function fetchContracts(accountId?: number) {
  const url = accountId ? `/api/contracts?accountId=${accountId}` : "/api/contracts";
  const res = await apiFetch(url);
  if (!res.ok) throw new Error("Failed to fetch contracts");
  const data = await res.json();
  return Array.isArray(data) ? data : data?.list ?? [];
}

export async function createContract(payload: Record<string, any>) {
  const res = await apiFetch("/api/contracts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to create contract");
  }
  return res.json();
}

export async function updateContract(id: number, patch: Record<string, any>) {
  const res = await apiFetch(`/api/contracts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update contract");
  return res.json();
}

export async function deleteContract(id: number) {
  const res = await apiFetch(`/api/contracts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete contract");
}

export async function markContractSigned(id: number) {
  const res = await apiFetch(`/api/contracts/${id}/mark-signed`, { method: "PATCH" });
  if (!res.ok) throw new Error("Failed to mark contract as signed");
  return res.json();
}
