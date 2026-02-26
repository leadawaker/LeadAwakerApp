import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/apiUtils";

export type ActivityItemType =
  | "message_received"
  | "message_sent"
  | "call_booked"
  | "status_change"
  | "automation"
  | "takeover";

export type ActivityIcon = "message" | "phone" | "bot" | "user" | "arrow";

export interface ActivityItem {
  type: ActivityItemType;
  title: string;
  description: string;
  leadId: number | null;
  leadName: string;
  timestamp: string | null;
  icon: ActivityIcon;
}

export interface ActivityFeedResponse {
  items: ActivityItem[];
  total: number;
  hasMore: boolean;
}

interface UseActivityFeedOptions {
  accountId?: number;
  limit?: number;
  enabled?: boolean;
}

export function useActivityFeed(options: UseActivityFeedOptions = {}) {
  const { accountId, limit = 50, enabled = true } = options;
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);

  const fetchFeed = useCallback(
    async (reset = true) => {
      if (!enabled) return;
      const currentOffset = reset ? 0 : offsetRef.current;
      if (reset) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        params.set("offset", String(currentOffset));
        if (accountId) params.set("accountId", String(accountId));

        const res = await apiFetch(`/api/activity-feed?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch activity feed: ${res.status}`);
        }
        const data: ActivityFeedResponse = await res.json();

        if (reset) {
          setItems(data.items);
          offsetRef.current = data.items.length;
        } else {
          setItems((prev) => [...prev, ...data.items]);
          offsetRef.current = currentOffset + data.items.length;
        }
        setTotal(data.total);
        setHasMore(data.hasMore);
      } catch (err: any) {
        console.error("Activity feed error:", err);
        setError(err.message || "Failed to load activity feed");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [accountId, limit, enabled],
  );

  // Initial fetch
  useEffect(() => {
    if (enabled) fetchFeed(true);
  }, [fetchFeed, enabled]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchFeed(false);
    }
  }, [fetchFeed, loadingMore, hasMore]);

  const refresh = useCallback(() => {
    fetchFeed(true);
  }, [fetchFeed]);

  return {
    items,
    total,
    hasMore,
    loading,
    loadingMore,
    error,
    loadMore,
    refresh,
  };
}
