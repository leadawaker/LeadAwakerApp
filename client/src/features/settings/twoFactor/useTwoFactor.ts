import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiUtils";
import type { ApiResult, TwoFactorStatus } from "./types";

/** JSON request helper: never throws, returns status + parsed body. */
export async function twoFactorRequest<T = any>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await apiFetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: {} as T };
  }
}

export function useTwoFactor() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const r = await twoFactorRequest<TwoFactorStatus>("GET", "/api/auth/2fa/status");
    if (r.ok) setStatus(r.data);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return { status, loading, refresh };
}
