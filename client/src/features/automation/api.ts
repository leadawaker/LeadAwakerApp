import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import type { ClientAutomationsResponse, DiaryPage, OverviewResponse, ResolveFailuresBody } from "@shared/automationTypes";

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
    refetchOnWindowFocus: false,
  });
}

export function useClientAutomations(accountId: number) {
  return useQuery<ClientAutomationsResponse>({
    queryKey: ["/api/accounts/automations", accountId],
    queryFn: () => getJson(`/api/accounts/${accountId}/automations`),
    enabled: accountId > 0,
  });
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

/** Refetch everything that shows failure counts after a clear. */
function useInvalidateAutomations() {
  const qc = useQueryClient();
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: ["/api/automations/overview"] }),
    qc.invalidateQueries({ queryKey: ["/api/automations/diary"] }),
    qc.invalidateQueries({ queryKey: ["/api/accounts/automations"] }),
  ]);
}

/** Clear the open failures of a category or automation as fixed. Nothing is deleted. */
export function useResolveFailures() {
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: (body: ResolveFailuresBody) => postJson<{ resolved: number }>("/api/automations/resolve", body),
    onSuccess: invalidate,
  });
}

/** Clear (or reopen) one failure line in the diary. */
export function useResolveDiaryLine() {
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: ({ id, resolved }: { id: number; resolved: boolean }) => postJson<{ ok: true }>(`/api/automations/diary/${id}/resolve`, { resolved }),
    onSuccess: invalidate,
  });
}
