import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import { MobileNotificationsPanel } from "@/components/crm/MobileNotificationsPanel";

/**
 * Mobile chrome shared between the per-page `MobileListHeader` and the shell.
 *
 * After the global mobile topbar was removed, each list page renders its own
 * header. The notification bell lives in that header, but the notification
 * panel itself stays mounted once at the shell level. This context exposes the
 * opener + unread count so any mobile header can trigger it.
 */
interface MobileChromeValue {
  openNotifications: () => void;
  unreadCount: number;
}

const MobileChromeContext = createContext<MobileChromeValue>({
  openNotifications: () => {},
  unreadCount: 0,
});

export function useMobileChrome() {
  return useContext(MobileChromeContext);
}

export function MobileChromeProvider({ children }: { children: React.ReactNode }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Lightweight poll for the badge count (shared react-query cache with the
  // desktop topbar bell, so this does not double-fetch).
  const { data: countData } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/notifications/count"],
    queryFn: async () => {
      const res = await apiFetch("/api/notifications/count");
      if (!res.ok) return { unreadCount: 0 };
      return res.json() as Promise<{ unreadCount: number }>;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (countData) setUnreadCount(countData.unreadCount);
  }, [countData]);

  const openNotifications = useCallback(() => setNotifOpen(true), []);
  const handleUnreadCountChange = useCallback((count: number) => setUnreadCount(count), []);

  return (
    <MobileChromeContext.Provider value={{ openNotifications, unreadCount }}>
      {children}
      {/* Mounted once for the whole app; opened from any mobile header bell. */}
      <MobileNotificationsPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onUnreadCountChange={handleUnreadCountChange}
      />
    </MobileChromeContext.Provider>
  );
}
