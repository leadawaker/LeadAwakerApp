// One campaign, loaded by id, for the places that host the campaign settings
// outside the Campaigns page (Accounts > Reactivation, Home > Reactivation,
// Demos > Settings). Same cache key as the Chat tab's useChatCampaign, so a
// campaign shown in two places is one copy.
//
// onSave is the callback useCampaignDetail calls after its debounce: the same
// PATCH and niche-template write-back as the Campaigns page.
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { Campaign } from "@/types/models";
import { updateCampaign } from "../api/campaignsApi";
import { syncNicheTemplate } from "../lib/campaignWrites";

export const campaignQueryKey = (id: number | null) => ["/api/campaigns", id] as const;

export function useCampaignById(campaignId: number | null): {
  /** The row as GET /api/campaigns/:id sends it (db keys: id, Accounts_id, ab_enabled, ...). */
  campaign: Campaign | null;
  loading: boolean;
  error: boolean;
  onSave: (id: number, patch: Record<string, unknown>) => Promise<void>;
} {
  const qc = useQueryClient();
  const { isAgencyUser } = useWorkspace();
  const query = useQuery<Campaign | null>({
    queryKey: campaignQueryKey(campaignId),
    enabled: !!campaignId,
    queryFn: async () => {
      const res = await apiFetch(`/api/campaigns/${campaignId}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to load campaign");
      return res.json();
    },
    staleTime: 30_000,
  });

  const onSave = useCallback(async (id: number, patch: Record<string, unknown>) => {
    const key = campaignQueryKey(id);
    const before = qc.getQueryData<Campaign | null>(key);
    if (before) qc.setQueryData(key, { ...before, ...patch });
    let row: unknown;
    try {
      row = await updateCampaign(id, patch);
    } catch (e) {
      if (before) qc.setQueryData(key, before);
      throw e; // useCampaignDetail shows the failed-save toast
    }
    if (row && typeof row === "object") qc.setQueryData(key, row);
    if (isAgencyUser) await syncNicheTemplate(String(patch.niche ?? (before as any)?.niche ?? ""), patch);
  }, [qc, isAgencyUser]);

  return { campaign: query.data ?? null, loading: !!campaignId && query.isLoading, error: query.isError, onSave };
}
