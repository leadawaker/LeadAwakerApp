import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/apiUtils";

export interface ClaudeKeyStatus {
  hasKey: boolean;
  masked: string | null;
}

export function useClaudeApiKey() {
  const [status, setStatus] = useState<ClaudeKeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/user/claude-key");
      if (!res.ok) {
        throw new Error("Failed to fetch API key status");
      }
      const data = (await res.json()) as ClaudeKeyStatus;
      setStatus(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const saveKey = useCallback(async (apiKey: string) => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/user/claude-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      if (!res.ok) {
        throw new Error("Failed to save API key");
      }
      await fetchStatus();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  const deleteKey = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/user/claude-key", {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Failed to delete API key");
      }
      await fetchStatus();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  return {
    status,
    loading,
    error,
    saveKey,
    deleteKey,
    refetch: fetchStatus,
  };
}
