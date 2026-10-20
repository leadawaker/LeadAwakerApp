// The Chat tab's data: the account's receptionist campaign (the one its
// inbound WhatsApp and website widget answer from) and the widget row. Edits go
// through the campaign settings' own draft and 1.5s autosave
// (useCampaignDetail), so there is one copy of the campaign and one save path.
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import { updateCampaign } from "@/features/campaigns/api/campaignsApi";
import { fetchWidgetConfigs, updateWidgetConfig, type WidgetConfigRow } from "../../../api/widgetApi";

export type ChatCampaign = Record<string, any> & { id: number };

/** The widget row, or null. Agency only on the server: a client login gets null. */
export function useChatWidget(accountId: number) {
  const qc = useQueryClient();
  const key = ["/api/widget-configs", accountId];
  const query = useQuery<WidgetConfigRow | null>({
    queryKey: key,
    queryFn: async () => {
      try { return (await fetchWidgetConfigs(accountId)).configs[0] ?? null; } catch { return null; }
    },
    staleTime: 30_000,
  });
  const save = useCallback(async (body: Partial<WidgetConfigRow>) => {
    const row = query.data;
    if (!row) return false;
    try {
      qc.setQueryData(key, await updateWidgetConfig(row.id, body));
      return true;
    } catch { return false; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, accountId]);
  return { widget: query.data ?? null, loading: query.isLoading, save };
}

/**
 * Which campaign is the receptionist: the account's inbound WhatsApp campaign,
 * else the one its website widget answers from.
 */
export function receptionistCampaignId(inboundCampaignId: unknown, widget: WidgetConfigRow | null): number | null {
  const inbound = Number(inboundCampaignId);
  if (Number.isSafeInteger(inbound) && inbound > 0) return inbound;
  return widget?.campaignsId ?? null;
}

export function useChatCampaign(campaignId: number | null) {
  const qc = useQueryClient();
  const key = ["/api/campaigns", campaignId];
  const query = useQuery<ChatCampaign | null>({
    queryKey: key,
    enabled: !!campaignId,
    queryFn: async () => {
      const res = await apiFetch(`/api/campaigns/${campaignId}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to load campaign");
      return res.json();
    },
    staleTime: 30_000,
  });

  // The onSave useCampaignDetail calls after its debounce: the same PATCH the
  // Campaigns page sends. The returned row refreshes the cache for the rail.
  const onSave = useCallback(async (id: number, patch: Record<string, unknown>) => {
    const row = await updateCampaign(id, patch);
    qc.setQueryData(["/api/campaigns", id], row);
  }, [qc]);

  return { campaign: query.data ?? null, loading: !!campaignId && query.isLoading, error: query.isError, onSave };
}
