import { keepPreviousData, useQuery, type QueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import type { IndexResponse, SearchResponse, TrafficDays, VisitsResponse } from "@shared/trafficTypes";

async function getJson<T>(url: string): Promise<T> {
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

const visitsKey = (days: TrafficDays) => ["/api/traffic/visits", days];
const searchKey = (days: TrafficDays) => ["/api/traffic/search", days];
const INDEX_KEY = ["/api/traffic/index"];

/** The site's own visit counter. Live, so it goes stale after a minute. */
export function useVisits(days: TrafficDays) {
  return useQuery<VisitsResponse>({
    queryKey: visitsKey(days),
    queryFn: () => getJson(`/api/traffic/visits?days=${days}`),
    staleTime: 60_000,
    // Switching period keeps the old numbers on screen until the new ones arrive.
    placeholderData: keepPreviousData,
  });
}

/** Search Console numbers. The server keeps them for a few hours. */
export function useSearch(days: TrafficDays) {
  return useQuery<SearchResponse>({
    queryKey: searchKey(days),
    queryFn: () => getJson(`/api/traffic/search?days=${days}`),
    staleTime: 30 * 60_000,
    placeholderData: keepPreviousData,
  });
}

/** Index status per sitemap page. Slow the first time (Google is asked page by page). */
export function useIndexStatus() {
  return useQuery<IndexResponse>({
    queryKey: INDEX_KEY,
    queryFn: () => getJson("/api/traffic/index"),
    staleTime: 30 * 60_000,
  });
}

/** The Refresh button: asks the server to skip its own cache as well. */
export async function refreshTraffic(client: QueryClient, days: TrafficDays): Promise<void> {
  await Promise.all([
    client.fetchQuery({ queryKey: visitsKey(days), queryFn: () => getJson<VisitsResponse>(`/api/traffic/visits?days=${days}`), staleTime: 0 }),
    client.fetchQuery({ queryKey: searchKey(days), queryFn: () => getJson<SearchResponse>(`/api/traffic/search?days=${days}&fresh=1`), staleTime: 0 }),
    client.fetchQuery({ queryKey: INDEX_KEY, queryFn: () => getJson<IndexResponse>("/api/traffic/index?fresh=1"), staleTime: 0 }),
  ]);
}
