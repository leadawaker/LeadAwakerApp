const API_BASE_URL = "https://api-leadawaker.netlify.app/.netlify/functions/api";
const TABLE_ID = "leads";

export const fetchLeads = async () => {
  const res = await fetch(`${API_BASE_URL}?tableId=${TABLE_ID}`);
  if (!res.ok) throw new Error("Failed to fetch leads");
  const data = await res.json();
  // normalize data to always be an array
  return Array.isArray(data) ? data : data?.list || [];
};

export const updateLead = async (rowId: number | string, patch: any) => {
  const res = await fetch(`${API_BASE_URL}?tableId=${TABLE_ID}&id=${rowId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    throw new Error("Failed to update lead");
  }

  return await res.json();
};

export const createLead = async (payload: any) => {
  const res = await fetch(`${API_BASE_URL}?tableId=${TABLE_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Failed to create lead");
  return await res.json();
};

export const deleteLead = async (rowId: number | string) => {
  const res = await fetch(`${API_BASE_URL}?tableId=${TABLE_ID}&id=${rowId}`, {
    method: "DELETE",
  });

  if (!res.ok) throw new Error("Failed to delete lead");
};