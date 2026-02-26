import { useState, useCallback, useEffect } from "react";
import type { InvoiceRow } from "../types";
import {
  fetchInvoices,
  createInvoice as apiCreate,
  updateInvoice as apiUpdate,
  deleteInvoice as apiDelete,
  markInvoiceSent as apiMarkSent,
  markInvoicePaid as apiMarkPaid,
} from "../api/invoicesApi";

export function useInvoicesData(accountId?: number) {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchInvoices(accountId);
      setInvoices(data);
    } catch (e) {
      console.error("Failed to fetch invoices:", e);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const create = useCallback(async (payload: Record<string, any>) => {
    const created = await apiCreate(payload);
    setInvoices((prev) => [created, ...prev]);
    return created;
  }, []);

  const update = useCallback(async (id: number, patch: Record<string, any>) => {
    const updated = await apiUpdate(id, patch);
    setInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)));
    return updated;
  }, []);

  const remove = useCallback(async (id: number) => {
    await apiDelete(id);
    setInvoices((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const markSent = useCallback(async (id: number) => {
    const updated = await apiMarkSent(id);
    setInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)));
    return updated;
  }, []);

  const markPaid = useCallback(async (id: number) => {
    const updated = await apiMarkPaid(id);
    setInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)));
    return updated;
  }, []);

  return { invoices, loading, fetchData, create, update, remove, markSent, markPaid };
}
