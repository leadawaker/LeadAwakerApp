import { apiFetch } from "@/lib/apiUtils";
import type { ExpenseRow } from "../types";

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function fetchExpenses(year?: number, quarter?: string): Promise<ExpenseRow[]> {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  if (quarter) params.set("quarter", quarter);
  const qs = params.toString();
  const res = await apiFetch(`/api/expenses${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function createExpense(payload: Record<string, unknown>): Promise<ExpenseRow> {
  const res = await apiFetch("/api/expenses", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any)?.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function updateExpense(id: number, patch: Record<string, unknown>): Promise<ExpenseRow> {
  const res = await apiFetch(`/api/expenses/${id}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any)?.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function deleteExpense(id: number): Promise<void> {
  const res = await apiFetch(`/api/expenses/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function parsePdf(pdfData: string): Promise<Record<string, unknown>> {
  const res = await apiFetch("/api/expenses/parse-pdf", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ pdf_data: pdfData }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
