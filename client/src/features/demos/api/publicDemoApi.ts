import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";

/** Mirrors PublicDemoSettings in server/publicDemo/settings.ts (the editable part). */
export interface PublicDemoSettings {
  enabled: boolean;
  dailyBudgetEur: number;
  maxDemosPerDay: number;
  voiceMaxMinutesPerSession: number;
  voiceMaxSessionsPerDemo: number;
  callNumber: string | null;
}

interface PublicDemoState {
  settings: PublicDemoSettings;
  today: { eur: number; built: number };
}

const KEY = ["public-demo-settings"];

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string }).message || `Request failed (${res.status})`);
  return body as T;
}

export function usePublicDemoSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => json<PublicDemoState>(await apiFetch("/api/demo-settings/public-demo")),
    refetchInterval: 60_000,
  });
}

export function useSavePublicDemoSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<PublicDemoSettings>) =>
      json<{ settings: PublicDemoSettings }>(await apiFetch("/api/demo-settings/public-demo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
