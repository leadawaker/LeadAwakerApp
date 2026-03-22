/**
 * Real-time notification hook.
 *
 * Connects to the existing SSE interactions stream and polls the lightweight
 * /api/notifications/count endpoint to keep the unread badge in sync.
 * When a new_interaction SSE event arrives, we immediately re-fetch the count
 * and prepend any new notifications to the local list.
 *
 * Exports everything the UI needs: unreadCount, notifications list, and
 * mutation helpers (markAsRead, markAllAsRead, refetch).
 */
import { useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import { toast } from "@/hooks/use-toast";

/* ─── Types ──────────────────────────────────────────────────────── */

export type NotificationType =
  | "message"
  | "takeover"
  | "booking"
  | "campaign"
  | "task"
  | "system"
  | "task_assigned"
  | "task_due_soon"
  | "task_overdue"
  | "booking_confirmed"
  | "lead_responded"
  | "lead_manual_takeover"
  | "critical_automation_failure"
  | "campaign_finished";

export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  leadId: number | null;
  userId: number;
  accountId: number | null;
  read: boolean;
  link: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  items: Notification[];
  unreadCount: number;
  totalCount: number;
}

interface CountResponse {
  unreadCount: number;
}

/* ─── Toast icon mapping ─────────────────────────────────────────── */

const NOTIFICATION_VARIANT: Record<string, "default" | "destructive" | "success" | "info"> = {
  booking: "success",
  booking_confirmed: "success",
  campaign: "info",
  campaign_finished: "info",
  task: "default",
  task_assigned: "default",
  task_due_soon: "info",
  task_overdue: "destructive",
  takeover: "destructive",
  lead_manual_takeover: "destructive",
  critical_automation_failure: "destructive",
  message: "default",
  lead_responded: "default",
  system: "info",
};

/* ─── Query keys ─────────────────────────────────────────────────── */

// Match the query keys used by Topbar and NotificationCenter so SSE
// invalidation automatically updates their cached data.
const NOTIFICATIONS_KEY = ["/api/notifications"] as const;
const NOTIFICATIONS_COUNT_KEY = ["/api/notifications/count"] as const;

/* ─── Hook ───────────────────────────────────────────────────────── */

export function useNotificationStream(options?: {
  /** Whether the hook is active (default: true). Set false when not authenticated. */
  enabled?: boolean;
  /** Account ID for scoping the SSE stream (agency users can pass specific account). */
  accountId?: number;
}) {
  const enabled = options?.enabled !== false;
  const accountId = options?.accountId;
  const qc = useQueryClient();
  const sseRef = useRef<EventSource | null>(null);
  const lastNotifIdRef = useRef<number>(0);
  // Track notification IDs that already triggered a toast via SSE to avoid duplicates
  const sseToastedIdsRef = useRef<Set<number>>(new Set());

  /* ── Unread count (lightweight poll every 30s) ──────────────── */
  const { data: countData } = useQuery<CountResponse>({
    queryKey: [...NOTIFICATIONS_COUNT_KEY],
    queryFn: async () => {
      const res = await apiFetch("/api/notifications/count");
      if (!res.ok) return { unreadCount: 0 };
      return res.json();
    },
    enabled,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const unreadCount = countData?.unreadCount ?? 0;

  /* ── Full notification list (fetched on demand / on mount) ──── */
  const { data: notifData, refetch: refetchNotifications } = useQuery<NotificationsResponse>({
    queryKey: [...NOTIFICATIONS_KEY],
    queryFn: async () => {
      const res = await apiFetch("/api/notifications?limit=50");
      if (!res.ok) return { items: [], unreadCount: 0, totalCount: 0 };
      return res.json();
    },
    enabled,
    staleTime: 30_000,
  });

  const notifications = useMemo(() => notifData?.items ?? [], [notifData]);

  // Track highest notification ID so we can detect truly new ones from SSE refetch
  useEffect(() => {
    if (notifications.length > 0) {
      lastNotifIdRef.current = Math.max(lastNotifIdRef.current, notifications[0].id);
    }
  }, [notifications]);

  /* ── SSE connection (existing interactions stream) ──────────── */
  useEffect(() => {
    if (!enabled) return;

    const params = new URLSearchParams();
    if (accountId && accountId > 0) {
      params.set("accountId", String(accountId));
    }
    const url = `/api/interactions/stream${params.toString() ? `?${params}` : ""}`;

    const es = new EventSource(url, { withCredentials: true });
    sseRef.current = es;

    es.addEventListener("new_interaction", () => {
      // A new interaction often creates a notification — refetch both
      qc.invalidateQueries({ queryKey: [...NOTIFICATIONS_COUNT_KEY] });
      qc.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY] });
    });

    // When we get fresh data after SSE trigger, show toast for any new notifications
    // This is handled via the onSuccess in the query above — we compare IDs

    es.addEventListener("notification", (event: MessageEvent) => {
      // Handle dedicated "notification" SSE events from the server
      try {
        const notif: Notification = JSON.parse(event.data);
        // Track this ID so the refetch-based toast effect skips it
        sseToastedIdsRef.current.add(notif.id);
        fireNotificationToast(notif);
        // Optimistically prepend to cache
        qc.setQueryData<NotificationsResponse>([...NOTIFICATIONS_KEY], (old) => {
          if (!old) return { items: [notif], unreadCount: 1, totalCount: 1 };
          return {
            items: [notif, ...old.items.filter((n) => n.id !== notif.id)].slice(0, 50),
            unreadCount: old.unreadCount + 1,
            totalCount: old.totalCount + 1,
          };
        });
        qc.setQueryData<CountResponse>([...NOTIFICATIONS_COUNT_KEY], (old) => ({
          unreadCount: (old?.unreadCount ?? 0) + 1,
        }));
      } catch {
        // Ignore malformed events
      }
    });

    es.onerror = () => {
      // EventSource auto-reconnects — no manual retry needed
    };

    return () => {
      es.close();
      sseRef.current = null;
    };
  }, [enabled, accountId, qc]);

  /* ── Show toast when new notifications appear after refetch ──── */
  const prevItemsRef = useRef<Notification[]>([]);

  useEffect(() => {
    if (!notifications.length) return;
    const prevIds = new Set(prevItemsRef.current.map((n) => n.id));
    const newOnes = notifications.filter(
      (n) => !prevIds.has(n.id) && !n.read && !sseToastedIdsRef.current.has(n.id)
    );

    // Only toast if this isn't the initial load
    if (prevItemsRef.current.length > 0) {
      // Limit to 3 toasts to avoid flooding
      newOnes.slice(0, 3).forEach((n) => fireNotificationToast(n));
    }

    // Clean up SSE-toasted IDs that are now in the list (no longer needed)
    for (const id of sseToastedIdsRef.current) {
      if (notifications.some((n) => n.id === id)) {
        sseToastedIdsRef.current.delete(id);
      }
    }

    prevItemsRef.current = notifications;
  }, [notifications]);

  /* ── Mark single notification as read ──────────────────────── */
  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/notifications/${id}`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to mark notification as read");
    },
    onMutate: async (id) => {
      // Cancel outgoing refetches so they don't overwrite optimistic update
      await qc.cancelQueries({ queryKey: [...NOTIFICATIONS_KEY] });
      await qc.cancelQueries({ queryKey: [...NOTIFICATIONS_COUNT_KEY] });

      // Snapshot previous values for rollback
      const previousNotifs = qc.getQueryData<NotificationsResponse>([...NOTIFICATIONS_KEY]);
      const previousCount = qc.getQueryData<CountResponse>([...NOTIFICATIONS_COUNT_KEY]);

      // Optimistic update
      qc.setQueryData<NotificationsResponse>([...NOTIFICATIONS_KEY], (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
          unreadCount: Math.max(0, old.unreadCount - 1),
        };
      });
      qc.setQueryData<CountResponse>([...NOTIFICATIONS_COUNT_KEY], (old) => ({
        unreadCount: Math.max(0, (old?.unreadCount ?? 1) - 1),
      }));

      return { previousNotifs, previousCount };
    },
    onError: (_err, _id, context) => {
      // Rollback on failure
      if (context?.previousNotifs) {
        qc.setQueryData<NotificationsResponse>([...NOTIFICATIONS_KEY], context.previousNotifs);
      }
      if (context?.previousCount) {
        qc.setQueryData<CountResponse>([...NOTIFICATIONS_COUNT_KEY], context.previousCount);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [...NOTIFICATIONS_COUNT_KEY] });
    },
  });

  const markAsRead = useCallback((id: number) => {
    markAsReadMutation.mutate(id);
  }, [markAsReadMutation]);

  /* ── Mark all as read ──────────────────────────────────────── */
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/notifications/mark-all-read", { method: "POST" });
      if (!res.ok) throw new Error("Failed to mark all as read");
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: [...NOTIFICATIONS_KEY] });
      await qc.cancelQueries({ queryKey: [...NOTIFICATIONS_COUNT_KEY] });

      const previousNotifs = qc.getQueryData<NotificationsResponse>([...NOTIFICATIONS_KEY]);
      const previousCount = qc.getQueryData<CountResponse>([...NOTIFICATIONS_COUNT_KEY]);

      qc.setQueryData<NotificationsResponse>([...NOTIFICATIONS_KEY], (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        };
      });
      qc.setQueryData<CountResponse>([...NOTIFICATIONS_COUNT_KEY], () => ({
        unreadCount: 0,
      }));

      return { previousNotifs, previousCount };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousNotifs) {
        qc.setQueryData<NotificationsResponse>([...NOTIFICATIONS_KEY], context.previousNotifs);
      }
      if (context?.previousCount) {
        qc.setQueryData<CountResponse>([...NOTIFICATIONS_COUNT_KEY], context.previousCount);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY] });
      qc.invalidateQueries({ queryKey: [...NOTIFICATIONS_COUNT_KEY] });
    },
  });

  const markAllAsRead = useCallback(() => {
    markAllAsReadMutation.mutate();
  }, [markAllAsReadMutation]);

  /* ── Delete single notification ────────────────────────────── */
  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/notifications/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete notification");
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: [...NOTIFICATIONS_KEY] });
      await qc.cancelQueries({ queryKey: [...NOTIFICATIONS_COUNT_KEY] });

      const previousNotifs = qc.getQueryData<NotificationsResponse>([...NOTIFICATIONS_KEY]);
      const previousCount = qc.getQueryData<CountResponse>([...NOTIFICATIONS_COUNT_KEY]);

      // Optimistic: remove from list and adjust counts
      qc.setQueryData<NotificationsResponse>([...NOTIFICATIONS_KEY], (old) => {
        if (!old) return old;
        const target = old.items.find((n) => n.id === id);
        const wasUnread = target ? !target.read : false;
        return {
          ...old,
          items: old.items.filter((n) => n.id !== id),
          unreadCount: wasUnread ? Math.max(0, old.unreadCount - 1) : old.unreadCount,
          totalCount: Math.max(0, old.totalCount - 1),
        };
      });
      qc.setQueryData<CountResponse>([...NOTIFICATIONS_COUNT_KEY], (old) => {
        const target = previousNotifs?.items.find((n) => n.id === id);
        const wasUnread = target ? !target.read : false;
        return {
          unreadCount: wasUnread ? Math.max(0, (old?.unreadCount ?? 1) - 1) : (old?.unreadCount ?? 0),
        };
      });

      return { previousNotifs, previousCount };
    },
    onError: (_err, _id, context) => {
      if (context?.previousNotifs) {
        qc.setQueryData<NotificationsResponse>([...NOTIFICATIONS_KEY], context.previousNotifs);
      }
      if (context?.previousCount) {
        qc.setQueryData<CountResponse>([...NOTIFICATIONS_COUNT_KEY], context.previousCount);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY] });
      qc.invalidateQueries({ queryKey: [...NOTIFICATIONS_COUNT_KEY] });
    },
  });

  const deleteNotification = useCallback((id: number) => {
    deleteNotificationMutation.mutate(id);
  }, [deleteNotificationMutation]);

  /* ── Delete all notifications ────────────────────────────── */
  const deleteAllNotificationsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/notifications/all", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete all notifications");
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: [...NOTIFICATIONS_KEY] });
      await qc.cancelQueries({ queryKey: [...NOTIFICATIONS_COUNT_KEY] });

      const previousNotifs = qc.getQueryData<NotificationsResponse>([...NOTIFICATIONS_KEY]);
      const previousCount = qc.getQueryData<CountResponse>([...NOTIFICATIONS_COUNT_KEY]);

      qc.setQueryData<NotificationsResponse>([...NOTIFICATIONS_KEY], () => ({
        items: [],
        unreadCount: 0,
        totalCount: 0,
      }));
      qc.setQueryData<CountResponse>([...NOTIFICATIONS_COUNT_KEY], () => ({
        unreadCount: 0,
      }));

      return { previousNotifs, previousCount };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousNotifs) {
        qc.setQueryData<NotificationsResponse>([...NOTIFICATIONS_KEY], context.previousNotifs);
      }
      if (context?.previousCount) {
        qc.setQueryData<CountResponse>([...NOTIFICATIONS_COUNT_KEY], context.previousCount);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY] });
      qc.invalidateQueries({ queryKey: [...NOTIFICATIONS_COUNT_KEY] });
    },
  });

  const deleteAllNotifications = useCallback(() => {
    deleteAllNotificationsMutation.mutate();
  }, [deleteAllNotificationsMutation]);

  return {
    unreadCount,
    notifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    refetchNotifications,
  };
}

/* ─── Toast helper ───────────────────────────────────────────────── */

function fireNotificationToast(notif: Notification) {
  const variant = NOTIFICATION_VARIANT[notif.type] ?? "default";

  toast({
    title: notif.title,
    description: notif.body ?? undefined,
    variant,
    duration: 5000,
  });
}
