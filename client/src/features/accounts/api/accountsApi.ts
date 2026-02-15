const API_BASE_URL = "https://api-leadawaker.netlify.app/.netlify/functions/api";
const TABLE_ID = "accounts";

export const fetchAccounts = async () => {
  const res = await fetch(`${API_BASE_URL}?tableId=${TABLE_ID}`);
  if (!res.ok) throw new Error("Failed to fetch accounts");
  const data = await res.json();
  return Array.isArray(data) ? data : data?.list || [];
};

export const updateAccount = async (rowId: number | string, patch: any) => {
  const res = await fetch(`${API_BASE_URL}?tableId=${TABLE_ID}&id=${rowId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

  if (!res.ok) throw new Error("Failed to update account");
  return await res.json();
};

export const createAccount = async (payload: any) => {
  const res = await fetch(`${API_BASE_URL}?tableId=${TABLE_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Failed to create account");
  return await res.json();
};

export const deleteAccount = async (rowId: number | string) => {
  const res = await fetch(`${API_BASE_URL}?tableId=${TABLE_ID}&id=${rowId}`, {
    method: "DELETE",
  });

  if (!res.ok) throw new Error("Failed to delete account");
};