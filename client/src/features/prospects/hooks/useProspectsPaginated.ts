import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { fetchProspectsPage, type ProspectsListParams, type ProspectsPage } from "../api/prospectsApi";
import { getProspectId, type ProspectRow } from "../components/prospectTypes";

const PAGE_SIZE = 100;

export interface UseProspectsPaginatedParams {
  search?: string;
  niche?: string[];
  status?: string[];
  country?: string[];
  priority?: string[];
  source?: string[];
  overdue?: boolean;
  sortBy?: string;
  groupBy?: string;
  groupDirection?: "asc" | "desc";
  enabled?: boolean;
}

export function useProspectsPaginated(params: UseProspectsPaginatedParams) {
  const queryClient = useQueryClient();

  const queryParams: ProspectsListParams = useMemo(() => ({
    limit: PAGE_SIZE,
    search: params.search,
    niche: params.niche,
    status: params.status,
    country: params.country,
    priority: params.priority,
    source: params.source,
    overdue: params.overdue,
    sortBy: params.sortBy,
    groupBy: params.groupBy,
    groupDirection: params.groupDirection,
  }), [params.search, params.niche, params.status, params.country, params.priority, params.source, params.overdue, params.sortBy, params.groupBy, params.groupDirection]);

  // Query key: include all filter/sort/group state so changes invalidate cache
  const queryKey = useMemo(() => ["/api/prospects", "paginated", queryParams] as const, [queryParams]);

  const query = useInfiniteQuery<ProspectsPage>({
    queryKey,
    enabled: params.enabled !== false,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchProspectsPage({ ...queryParams, offset: pageParam as number }),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return loaded;
    },
  });

  const items: ProspectRow[] = useMemo(() => {
    const pages = query.data?.pages ?? [];
    return pages.flatMap(p => p.items as ProspectRow[]);
  }, [query.data]);

  const total = query.data?.pages[0]?.total ?? 0;

  // Ensure a given prospect id is in the loaded slice; fetch more pages if needed.
  const ensureProspectLoaded = useCallback(async (id: number): Promise<boolean> => {
    let loaded = items;
    if (loaded.some(p => getProspectId(p) === id)) return true;
    // Keep fetching next page until found or exhausted
    // Guard: max 20 iterations (2000 prospects) to prevent infinite loops
    for (let i = 0; i < 20; i++) {
      if (!query.hasNextPage) return false;
      const next = await query.fetchNextPage();
      const pages = (next.data?.pages ?? []) as ProspectsPage[];
      loaded = pages.flatMap(p => p.items as ProspectRow[]);
      if (loaded.some(p => getProspectId(p) === id)) return true;
    }
    return false;
  }, [items, query]);

  const refetch = useCallback(() => query.refetch(), [query]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "/api/prospects",
    });
  }, [queryClient]);

  return {
    items,
    total,
    hasMore: !!query.hasNextPage,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    ensureProspectLoaded,
    refetch,
    invalidate,
    error: query.error,
  };
}
