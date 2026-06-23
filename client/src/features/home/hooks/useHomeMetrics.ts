import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import { useWorkspace } from "@/hooks/useWorkspace";

/** Normalize the various shapes the list endpoints can return into an array. */
function toArray(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.list)) return d.list;
    if (Array.isArray(d.data)) return d.data;
  }
  return [];
}

const BOOKED = new Set(["booked", "call booked"]);
const RESPONDED = new Set(["responded", "multiple responses"]);
const REPLIED = new Set(["responded", "multiple responses", "qualified", "booked", "call booked"]);

export interface HomeMetrics {
  isLoading: boolean;
  /** Live Reactivation service numbers. */
  reactivation: { booked: string; responseRate: string; activeCampaigns: string };
  /** Pulse strip (at-a-glance) numbers. */
  pulse: { leads: string; booked: string; responded: string; campaigns: string };
}

/**
 * Reactivation is the only live service, so the hub's real metrics all derive
 * from the leads + campaigns endpoints scoped to the current account (agency view
 * = all accounts). Reputation/Speed-to-Lead stay on sample data until they ship.
 */
export function useHomeMetrics(): HomeMetrics {
  const { currentAccountId } = useWorkspace();
  const accountQs = currentAccountId > 0 ? `?accountId=${currentAccountId}` : "";

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["/api/leads", "home-metrics", currentAccountId],
    queryFn: async () => {
      const res = await apiFetch(`/api/leads${accountQs}`);
      if (!res.ok) return [];
      return toArray(await res.json());
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ["/api/campaigns", "home-metrics", currentAccountId],
    queryFn: async () => {
      const res = await apiFetch(`/api/campaigns${accountQs}`);
      if (!res.ok) return [];
      return toArray(await res.json());
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const statusOf = (l: any): string =>
    String(l.conversion_status ?? l.Conversion_Status ?? "").trim().toLowerCase();

  const total = leads.length;
  const booked = leads.filter((l) => BOOKED.has(statusOf(l))).length;
  const responded = leads.filter((l) => RESPONDED.has(statusOf(l))).length;
  const replied = leads.filter((l) => REPLIED.has(statusOf(l))).length;
  const responseRate = total > 0 ? Math.round((replied / total) * 100) : 0;

  const activeCampaigns = campaigns.filter((c) => {
    const s = String(c.status ?? c.Status ?? "").trim().toLowerCase();
    return s === "active";
  }).length;

  return {
    isLoading: leadsLoading || campaignsLoading,
    reactivation: {
      booked: String(booked),
      responseRate: `${responseRate}%`,
      activeCampaigns: String(activeCampaigns),
    },
    pulse: {
      leads: String(total),
      booked: String(booked),
      responded: String(responded),
      campaigns: String(activeCampaigns),
    },
  };
}
