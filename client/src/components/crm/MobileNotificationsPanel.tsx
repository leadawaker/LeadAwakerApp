import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { NotificationCenter } from "@/components/crm/NotificationCenter";

interface MobileNotificationsPanelProps {
  open: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

/**
 * Full-screen notifications panel for mobile (< 768px).
 * Slides down from the top using Framer Motion.
 * Covers full viewport (100vw × 100dvh).
 * Not a modal — no backdrop, just a full-screen page.
 */
export function MobileNotificationsPanel({
  open,
  onClose,
  onUnreadCountChange,
}: MobileNotificationsPanelProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const handleUnreadCountChange = useCallback((count: number) => {
    onUnreadCountChange?.(count);
  }, [onUnreadCountChange]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-notifications-panel"
          initial={{ y: "-100%" }}
          animate={{ y: 0 }}
          exit={{ y: "-100%" }}
          transition={{ type: "tween", duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
          className="md:hidden fixed inset-0 z-[300] bg-background flex flex-col"
          style={{ width: "100vw", height: "100dvh" }}
          data-testid="mobile-notifications-panel"
        >
          {/* ── Header ── */}
          <div
            className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm border-b border-border/20 flex items-center gap-2 px-3 shrink-0"
            style={{
              paddingTop: "calc(0.75rem + var(--safe-top, 0px))",
              paddingBottom: "0.75rem",
            }}
          >
            <button
              onClick={onClose}
              className="flex items-center justify-center w-9 h-9 rounded-full text-foreground/70 hover:text-foreground hover:bg-muted transition-colors shrink-0"
              aria-label="Close notifications"
              data-testid="button-mobile-notifications-back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="flex-1 min-w-0 text-[17px] font-semibold truncate text-foreground">
              Notifications
            </h2>
          </div>

          {/* ── Notifications content (fills remaining space, scrollable) ── */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <NotificationCenter
              open={open}
              onClose={onClose}
              onUnreadCountChange={handleUnreadCountChange}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
