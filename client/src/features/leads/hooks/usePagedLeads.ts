// Paged leads for the Chats and Leads pages (GET /api/leads/page). Loads one
// page, appends the next on loadMore(), and keeps the server's counts (total,
// group headers, channel tabs, quick views). Search, filters and sort all run
// on the server, so they cover every lead, not only the loaded ones.
//
// Two shapes:
//  - list (default): one ordered list, limit/offset paging.
//  - perGroup: the first N leads of every group (Kanban columns), and
//    loadMoreGroup(key) fetches the next N of one column.
//
// Background refreshes (SSE leads_changed, AI bot edits) re-fetch the rows
// already loaded and swap them in place, so the list never jumps back to a
// skeleton or loses its scroll position.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiUtils";

export interface PagedLeadsQuery {
  accountId?: number;
  search?: string;
  sort?: string;
  groupBy?: string;
  groupDir?: "asc" | "desc";
  status?: string[];
  campaign?: string | number;
  account?: string | number;
  service?: string[];
  source?: string[];
  tags?: string[];
  type?: string[];
  chatChannel?: string;
  /** Chats page: only leads that have a website or WhatsApp chat. */
  chatsOnly?: boolean;
  channel?: string;
  needsReply?: boolean;
  upcoming?: boolean;
  hasPhone?: boolean;
  hasEmail?: boolean;
}

export interface LeadsFacets {
  accounts: { id: number; name: string }[];
  campaigns: { id: number; name: string; accountId: number | null }[];
  services: string[];
  sources: string[];
}

interface PageResponse {
  data: Record<string, any>[];
  total: number;
  groups: { key: string; count: number }[];
  chatChannelCounts: Record<string, number>;
  channelCounts: Record<string, number>;
  viewCounts: { needsReply: number; upcoming: number };
  facets?: LeadsFacets;
}

const EMPTY_COUNTS = { all: 0, website: 0, whatsapp: 0, phone: 0 };

export function buildLeadsPageUrl(q: PagedLeadsQuery, extra: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  const set = (k: string, v: unknown) => {
    if (v === undefined || v === null || v === "" || v === false) return;
    if (Array.isArray(v)) { if (v.length) p.set(k, v.join(",")); return; }
    p.set(k, v === true ? "1" : String(v));
  };
  Object.entries(q).forEach(([k, v]) => set(k, v));
  Object.entries(extra).forEach(([k, v]) => set(k, v));
  return `/api/leads/page?${p.toString()}`;
}

async function fetchPage(q: PagedLeadsQuery, extra: Record<string, string | number | undefined>): Promise<PageResponse> {
  const res = await apiFetch(buildLeadsPageUrl(q, extra));
  if (!res.ok) throw new Error(`Failed to load leads (${res.status})`);
  return res.json();
}

const idOf = (l: Record<string, any>) => Number(l.Id ?? l.id);

export function usePagedLeads(
  query: PagedLeadsQuery,
  opts: { enabled?: boolean; pageSize?: number; perGroup?: number } = {},
) {
  const { enabled = true, pageSize = 50, perGroup } = opts;
  const key = useMemo(() => JSON.stringify({ query, perGroup }), [query, perGroup]);

  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [meta, setMeta] = useState<Omit<PageResponse, "data" | "facets">>({
    total: 0, groups: [], chatChannelCounts: EMPTY_COUNTS, channelCounts: EMPTY_COUNTS,
    viewCounts: { needsReply: 0, upcoming: 0 },
  });
  const [facets, setFacets] = useState<LeadsFacets | null>(null);
  const [loading, setLoading] = useState(true);        // first load only
  const [fetching, setFetching] = useState(false);     // any query change
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const reqSeq = useRef(0);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const queryRef = useRef(query);
  queryRef.current = query;
  const facetsKey = String(query.accountId ?? "");
  const lastFacetsKey = useRef<string | null>(null);
  const loadPending = useRef(false);
  const refreshQueued = useRef(false);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  const applyMeta = (r: PageResponse) => {
    setMeta({
      total: r.total, groups: r.groups || [], chatChannelCounts: r.chatChannelCounts || EMPTY_COUNTS,
      channelCounts: r.channelCounts || EMPTY_COUNTS, viewCounts: r.viewCounts || { needsReply: 0, upcoming: 0 },
    });
    if (r.facets) setFacets(r.facets);
  };

  // Fresh load whenever the query changes.
  useEffect(() => {
    if (!enabled) return;
    const seq = ++reqSeq.current;
    const wantFacets = lastFacetsKey.current !== facetsKey;
    loadPending.current = true;
    refreshQueued.current = false; // this load already sees any earlier change
    setFetching(true);
    const extra = perGroup
      ? { perGroup, facets: wantFacets ? 1 : undefined }
      : { limit: pageSize, offset: 0, facets: wantFacets ? 1 : undefined };
    fetchPage(query, extra)
      .then((r) => {
        if (seq !== reqSeq.current) return;
        if (wantFacets) lastFacetsKey.current = facetsKey;
        setRows(r.data || []);
        applyMeta(r);
        setError(null);
      })
      .catch((e) => { if (seq === reqSeq.current) setError(e instanceof Error ? e : new Error(String(e))); })
      .finally(() => {
        if (seq !== reqSeq.current) return;
        loadPending.current = false;
        setLoading(false);
        setFetching(false);
        if (refreshQueued.current) {
          refreshQueued.current = false;
          void refreshRef.current();
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  const hasMore = !perGroup && rows.length < meta.total;

  const loadMore = useCallback(async () => {
    if (perGroup || loadingMore || fetching || rowsRef.current.length >= meta.total) return;
    const seq = reqSeq.current;
    setLoadingMore(true);
    try {
      const r = await fetchPage(queryRef.current, { limit: pageSize, offset: rowsRef.current.length });
      if (seq !== reqSeq.current) return;
      setRows((prev) => {
        const seen = new Set(prev.map(idOf));
        return [...prev, ...(r.data || []).filter((l) => !seen.has(idOf(l)))];
      });
      applyMeta(r);
    } catch (e) {
      console.error("[usePagedLeads] loadMore failed", e);
    } finally {
      setLoadingMore(false);
    }
  }, [perGroup, loadingMore, fetching, meta.total, pageSize]);

  /** Kanban: fetch the next page of one column (group key = stage). */
  const loadMoreGroup = useCallback(async (groupKey: string) => {
    if (!perGroup) return;
    const seq = reqSeq.current;
    const loadedInGroup = rowsRef.current.filter((l) => (l.group_key ?? "") === groupKey).length;
    try {
      const r = await fetchPage(
        { ...queryRef.current, status: [groupKey] },
        { limit: perGroup, offset: loadedInGroup },
      );
      if (seq !== reqSeq.current) return;
      setRows((prev) => {
        const seen = new Set(prev.map(idOf));
        return [...prev, ...(r.data || []).filter((l) => !seen.has(idOf(l)))];
      });
    } catch (e) {
      console.error("[usePagedLeads] loadMoreGroup failed", e);
    }
  }, [perGroup]);

  /** Re-fetch what is loaded (same range) and swap it in place. */
  const refresh = useCallback(async () => {
    if (!enabled) return;
    // A fresh load still running would be cancelled by this one and never end
    // its loading state: run once it has answered instead.
    if (loadPending.current) { refreshQueued.current = true; return; }
    const seq = ++reqSeq.current;
    try {
      let r: PageResponse;
      if (perGroup) {
        const deepest = Math.max(perGroup, ...countByGroup(rowsRef.current));
        r = await fetchPage(queryRef.current, { perGroup: Math.min(deepest, 200) });
      } else {
        const want = Math.max(pageSize, rowsRef.current.length);
        const chunks: Promise<PageResponse>[] = [];
        for (let off = 0; off < want; off += 200) {
          chunks.push(fetchPage(queryRef.current, { limit: Math.min(200, want - off), offset: off }));
        }
        const parts = await Promise.all(chunks);
        r = { ...parts[0], data: parts.flatMap((x) => x.data || []) };
      }
      if (seq !== reqSeq.current) return;
      setRows(r.data || []);
      applyMeta(r);
    } catch (e) {
      console.error("[usePagedLeads] refresh failed", e);
    }
  }, [enabled, perGroup, pageSize]);
  refreshRef.current = refresh;

  /** Optimistic local edit of one loaded lead. */
  const patchLead = useCallback((id: number | string, patch: Record<string, any>) => {
    setRows((prev) => prev.map((l) => (idOf(l) === Number(id) ? { ...l, ...patch } : l)));
  }, []);

  // Live updates: AI bot edits + SSE leads_changed (same triggers as useLeadsData).
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const debounced = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => refresh(), 400); };
    window.addEventListener("crm-data-changed", debounced);
    const params = new URLSearchParams();
    if (query.accountId && query.accountId > 0) params.set("accountId", String(query.accountId));
    const es = new EventSource(`/api/interactions/stream${params.toString() ? `?${params}` : ""}`, { withCredentials: true });
    es.addEventListener("leads_changed", debounced);
    return () => {
      window.removeEventListener("crm-data-changed", debounced);
      es.close();
      if (timer) clearTimeout(timer);
    };
  }, [enabled, refresh, query.accountId]);

  return {
    leads: rows,
    total: meta.total,
    groups: meta.groups,
    chatChannelCounts: meta.chatChannelCounts,
    channelCounts: meta.channelCounts,
    viewCounts: meta.viewCounts,
    facets,
    loading: enabled && loading,
    fetching,
    loadingMore,
    hasMore,
    error,
    loadMore,
    loadMoreGroup,
    refresh,
    patchLead,
  };
}

function countByGroup(rows: Record<string, any>[]): number[] {
  const m = new Map<string, number>();
  rows.forEach((l) => m.set(l.group_key ?? "", (m.get(l.group_key ?? "") ?? 0) + 1));
  return Array.from(m.values());
}

/** One lead by id, enriched like the page rows (deep links to a lead not loaded yet). */
export async function fetchLeadsByIds(ids: number[], accountId?: number): Promise<Record<string, any>[]> {
  if (!ids.length) return [];
  const r = await fetchPage({ accountId }, { ids: ids.join(",") });
  return r.data || [];
}

/** Every lead matching a query, 200 per request (CSV export). */
export async function fetchAllLeads(q: PagedLeadsQuery): Promise<Record<string, any>[]> {
  const out: Record<string, any>[] = [];
  for (let offset = 0; offset < 20000; offset += 200) {
    const r = await fetchPage(q, { limit: 200, offset });
    out.push(...(r.data || []));
    if (out.length >= r.total || !(r.data || []).length) break;
  }
  return out;
}

/** Value that only updates after `ms` without changes (search boxes). */
export function useDebouncedValue<V>(value: V, ms = 300): V {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}
