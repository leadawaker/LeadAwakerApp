import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import type {
  HomeOverview, HomePeriod, HomePhone, HomeReactivation, HomeReputation, HomeServices, HomeSocial,
  HomeWebsite, HomeWhatsapp,
} from "@shared/homeTypes";

export interface HomeScope { accountId: number; period: HomePeriod; campaignId?: number | null }

async function getJson<T>(path: string, params: Record<string, string | number | null | undefined>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "") qs.set(k, String(v));
  const res = await apiFetch(`/api/home/${path}?${qs.toString()}`);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

// The app's default staleTime is Infinity, so every dashboard query sets its own.
const STALE = 60 * 1000;

function useHome<T>(path: string, s: HomeScope, enabled = true) {
  return useQuery<T>({
    enabled,
    queryKey: ["/api/home", path, s.accountId, s.period, s.campaignId ?? null],
    queryFn: () => getJson<T>(path, { accountId: s.accountId, period: s.period, campaignId: s.campaignId }),
    staleTime: STALE,
    // Keep the old numbers while a new campaign or period loads, but never across accounts.
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[2] === s.accountId ? prev : undefined),
  });
}

export function useHomeServices(accountId: number) {
  return useQuery<HomeServices>({
    queryKey: ["/api/home", "services", accountId],
    queryFn: () => getJson<HomeServices>("services", { accountId }),
    staleTime: 5 * STALE,
  });
}
export const useHomeOverview = (s: HomeScope) => useHome<HomeOverview>("overview", s);
export const useHomePhone = (s: HomeScope, enabled = true) => useHome<HomePhone>("phone", s, enabled);
export const useHomeWhatsapp = (s: HomeScope, enabled = true) => useHome<HomeWhatsapp>("whatsapp", s, enabled);
export const useHomeWebsite = (s: HomeScope, enabled = true) => useHome<HomeWebsite>("website", s, enabled);
export const useHomeReactivation = (s: HomeScope) => useHome<HomeReactivation>("reactivation", s);
export const useHomeReputation = (s: HomeScope) => useHome<HomeReputation>("reputation", s);
export const useHomeSocial = (s: HomeScope) => useHome<HomeSocial>("social", s);
