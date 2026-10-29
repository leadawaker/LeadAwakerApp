// Recaps & alerts settings (specs/client-recaps): read for everyone on the
// account, edited by the agency only. Writes are merge patches.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import type { AlertSettingsResponse, AlertChannel, AlertType, AlertLanguage } from "@shared/clientAlerts";

export type { AlertSettingsResponse };

export interface AlertSettingsPatch {
  recap?: { enabled?: boolean; time?: string };
  alerts?: {
    language?: AlertLanguage | null;
    channels?: { recap?: Partial<Record<AlertChannel, boolean>>; alerts?: Partial<Record<AlertChannel, boolean>> };
    instant?: Partial<Record<AlertType, boolean>>;
    quietHours?: { enabled?: boolean; from?: string; to?: string };
    includePhoneInWhatsApp?: boolean;
    recipients?: {
      emails?: Array<{ address: string; name?: string }>;
      whatsapp?: Array<{ number: string; name: string; consent?: boolean; resubscribe?: boolean }>;
    };
  };
}

export type TestType = "daily_recap" | AlertType;
export interface TestResult {
  ok: boolean;
  error?: string;
  results?: Array<{ to: string; status: string; error: string | null }>;
}

async function call<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await apiFetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const first = Array.isArray(data?.errors) ? data.errors[0]?.message : null;
    throw new Error(first || data?.message || `HTTP ${res.status}`);
  }
  return data as T;
}

export const alertSettingsKey = (accountId: number) => ["alert-settings", accountId] as const;

export function useAlertSettings(accountId: number) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: alertSettingsKey(accountId),
    queryFn: () => call<AlertSettingsResponse>(`/api/accounts/${accountId}/alert-settings`),
    enabled: accountId > 0,
    staleTime: 15_000,
  });
  const save = useMutation({
    mutationFn: (patch: AlertSettingsPatch) =>
      call<AlertSettingsResponse>(`/api/accounts/${accountId}/alert-settings`, "PATCH", patch),
    onSuccess: (data) => qc.setQueryData(alertSettingsKey(accountId), data),
  });
  const test = useMutation({
    mutationFn: (body: { channel: "email" | "whatsapp"; type: TestType; onlyMe?: boolean }) =>
      call<TestResult>(`/api/accounts/${accountId}/alert-settings/test`, "POST", body),
  });
  return { settings: query.data ?? null, loading: query.isLoading, error: query.error as Error | null, save, test };
}
