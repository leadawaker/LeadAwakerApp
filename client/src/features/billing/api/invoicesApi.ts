import { apiFetch } from "@/lib/apiUtils";

export async function fetchInvoices(accountId?: number) {
  const url = accountId ? `/api/invoices?accountId=${accountId}` : "/api/invoices";
  const res = await apiFetch(url);
  if (!res.ok) throw new Error("Failed to fetch invoices");
  const data = await res.json();
  return Array.isArray(data) ? data : data?.list ?? [];
}

export async function createInvoice(payload: Record<string, any>) {
  const res = await apiFetch("/api/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to create invoice");
  }
  return res.json();
}

export async function updateInvoice(id: number, patch: Record<string, any>) {
  const res = await apiFetch(`/api/invoices/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update invoice");
  return res.json();
}

export async function deleteInvoice(id: number) {
  const res = await apiFetch(`/api/invoices/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete invoice");
}

export async function markInvoiceSent(id: number) {
  const res = await apiFetch(`/api/invoices/${id}/mark-sent`, { method: "PATCH" });
  if (!res.ok) throw new Error("Failed to mark invoice as sent");
  return res.json();
}

export async function markInvoicePaid(id: number) {
  const res = await apiFetch(`/api/invoices/${id}/mark-paid`, { method: "PATCH" });
  if (!res.ok) throw new Error("Failed to mark invoice as paid");
  return res.json();
}
