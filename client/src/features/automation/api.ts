import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import type { ClientAutomationsResponse, DiaryPage, OverviewResponse } from "@shared/automationTypes";

async function getJson<T>(url: string): Promise<T> {
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export function useAutomationsOverview() {
  return useQuery<OverviewResponse>({
    queryKey: ["/api/automations/overview"],
    queryFn: () => getJson("/api/automations/overview"),
    refetchInterval: 30_000,
  });
}

export function useAutomationDiary(id: string | null, opts: { accountId?: number; failedOnly: boolean; page: number }) {
  const qs = new URLSearchParams({ page: String(opts.page) });
  if (opts.accountId) qs.set("accountId", String(opts.accountId));
  if (opts.failedOnly) qs.set("failedOnly", "1");
  return useQuery<DiaryPage>({
    queryKey: ["/api/automations/diary", id, opts],
    queryFn: () => getJson(`/api/automations/${encodeURIComponent(id!)}/diary?${qs}`),
    enabled: !!id,
  });
}

export function useClientAutomations(accountId: number) {
  return useQuery<ClientAutomationsResponse>({
    queryKey: ["/api/accounts/automations", accountId],
    queryFn: () => getJson(`/api/accounts/${accountId}/automations`),
    enabled: accountId > 0,
  });
}
