import { useState, useCallback, useEffect } from "react";
import type { ContractRow } from "../types";
import {
  fetchContracts,
  createContract as apiCreate,
  updateContract as apiUpdate,
  deleteContract as apiDelete,
  markContractSigned as apiMarkSigned,
} from "../api/contractsApi";

export function useContractsData(accountId?: number) {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchContracts(accountId);
      setContracts(data);
    } catch (e) {
      console.error("Failed to fetch contracts:", e);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const create = useCallback(async (payload: Record<string, any>) => {
    const created = await apiCreate(payload);
    setContracts((prev) => [created, ...prev]);
    return created;
  }, []);

  const update = useCallback(async (id: number, patch: Record<string, any>) => {
    const updated = await apiUpdate(id, patch);
    setContracts((prev) => prev.map((c) => (c.id === id ? updated : c)));
    return updated;
  }, []);

  const remove = useCallback(async (id: number) => {
    await apiDelete(id);
    setContracts((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const markSigned = useCallback(async (id: number) => {
    const updated = await apiMarkSigned(id);
    setContracts((prev) => prev.map((c) => (c.id === id ? updated : c)));
    return updated;
  }, []);

  return { contracts, loading, fetchData, create, update, remove, markSigned };
}
