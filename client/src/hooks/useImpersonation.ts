import { useCallback } from "react";
import { apiFetch } from "@/lib/apiUtils";
import { queryClient } from "@/lib/queryClient";

export function useImpersonation() {
  const impersonate = useCallback(async (role: string, accountId?: number) => {
    await apiFetch("/api/auth/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, accountId }),
    });
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  }, []);

  const stopImpersonation = useCallback(async () => {
    await apiFetch("/api/auth/impersonate/stop", { method: "POST" });
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  }, []);

  return { impersonate, stopImpersonation };
}
