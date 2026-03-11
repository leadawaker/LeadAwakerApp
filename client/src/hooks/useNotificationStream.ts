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
      // If the server ever adds a dedicated "notification" SSE event, handle it directly
      try {
        const notif: Notification = JSON.parse(event.data);
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
    const newOnes = notifications.filter((n) => !prevIds.has(n.id) && !n.read);

    // Only toast if this isn't the initial load
    if (prevItemsRef.current.length > 0) {
      // Limit to 3 toasts to avoid flooding
      newOnes.slice(0, 3).forEach((n) => fireNotificationToast(n));
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
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY] });
      qc.invalidateQueries({ queryKey: [...NOTIFICATIONS_COUNT_KEY] });
    },
  });

  const markAllAsRead = useCallback(() => {
    markAllAsReadMutation.mutate();
  }, [markAllAsReadMutation]);

  return {
    unreadCount,
    notifications,
    markAsRead,
    markAllAsRead,
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
