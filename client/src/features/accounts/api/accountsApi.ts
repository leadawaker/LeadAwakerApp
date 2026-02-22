import { apiFetch } from "@/lib/apiUtils";

export const fetchAccounts = async () => {
  const res = await apiFetch("/api/accounts");
  if (!res.ok) throw new Error("Failed to fetch accounts");
  const data = await res.json();
  return Array.isArray(data) ? data : data?.list || [];
};

export const updateAccount = async (rowId: number | string, patch: Record<string, unknown>) => {
  const res = await apiFetch(`/api/accounts/${rowId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update account");
  return await res.json();
};

export const createAccount = async (payload: Record<string, unknown>) => {
  const res = await apiFetch("/api/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create account");
  return await res.json();
};

export const deleteAccount = async (rowId: number | string) => {
  const res = await apiFetch(`/api/accounts/${rowId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete account");
};
