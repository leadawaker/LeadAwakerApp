import { useState, useEffect } from "react";
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
  pageSize?: number;
  enabled?: boolean;
}

export function useActivityFeed(options: UseActivityFeedOptions = {}) {
  const { accountId, pageSize = 25, enabled = true } = options;
  const [page, setPageRaw] = useState(1);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const offset = (page - 1) * pageSize;
    const params = new URLSearchParams();
    params.set("limit", String(pageSize));
    params.set("offset", String(offset));
    if (accountId) params.set("accountId", String(accountId));

    apiFetch(`/api/activity-feed?${params}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        return res.json() as Promise<ActivityFeedResponse>;
      })
      .then((data) => {
        if (!cancelled) {
          setItems(data.items);
          setTotal(data.total);
        }
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message || "Failed to load activity feed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, pageSize, accountId, enabled]);

  const goToPage = (n: number) =>
    setPageRaw(Math.max(1, Math.min(n, totalPages)));
  const nextPage = () => goToPage(page + 1);
  const prevPage = () => goToPage(page - 1);

  return { items, total, totalPages, page, loading, error, goToPage, nextPage, prevPage };
}
