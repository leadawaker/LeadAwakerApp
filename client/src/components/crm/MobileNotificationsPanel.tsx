import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { MobileSheet } from "@/components/crm/mobile/MobileSheet";
import { NotificationCenter } from "@/components/crm/NotificationCenter";

interface MobileNotificationsPanelProps {
  open: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

/**
 * Full-screen notifications panel for mobile (< 768px).
 * Slides up from the bottom using MobileSheet (the established drag-to-dismiss primitive).
 * Pull down to close. Covers full viewport above the bottom bar.
 */
export function MobileNotificationsPanel({
  open,
  onClose,
  onUnreadCountChange,
}: MobileNotificationsPanelProps) {
  const { t } = useTranslation("crm");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const handleUnreadCountChange = useCallback((count: number) => {
    onUnreadCountChange?.(count);
  }, [onUnreadCountChange]);

  if (!mounted) return null;

  return (
    <MobileSheet
      open={open}
      onClose={onClose}
      topGap={0}
      zIndex={300}
      data-testid="mobile-notifications-panel"
    >
      {/* ── Header ── */}
      <div
        style={{
          flexShrink: 0,
          background: "var(--bg)",
          borderBottom: "1px solid var(--line)",
          padding: "4px 18px 12px",
          paddingTop: "max(env(safe-area-inset-top, 0px), 4px)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <h2
          style={{
            flex: 1,
            fontSize: 22,
            fontWeight: 700,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
            margin: 0,
          }}
        >
          {t("notifications.title")}
        </h2>
      </div>

      {/* ── Notifications content (fills remaining space, scrollable) ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <NotificationCenter
          open={open}
          onClose={onClose}
          onUnreadCountChange={handleUnreadCountChange}
        />
      </div>
    </MobileSheet>
  );
}
