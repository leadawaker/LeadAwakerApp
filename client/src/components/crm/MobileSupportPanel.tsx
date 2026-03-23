import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { SupportChatWidget, type FounderChatProps } from "@/components/crm/SupportChatWidget";
import type { SupportChatMessage, SupportBotConfig } from "@/hooks/useSupportChat";

interface MobileSupportPanelProps {
  open: boolean;
  onClose: () => void;
  messages: SupportChatMessage[];
  sending: boolean;
  loading: boolean;
  escalated: boolean;
  botConfig: SupportBotConfig;
  initialize: () => void;
  sendMessage: (text: string) => void;
  closeSession: () => void;
  clearContext: () => Promise<void>;
  updateBotConfig: (updates: Partial<SupportBotConfig>) => Promise<void>;
  isAdmin: boolean;
  founderChat?: FounderChatProps;
}

/**
 * Full-screen support chat panel for mobile (< 768px).
 * Slides in from the right using Framer Motion.
 * Covers full viewport (100vw × 100dvh).
 * Not a modal — no backdrop, just a full-screen page.
 */
export function MobileSupportPanel({
  open,
  onClose,
  messages,
  sending,
  loading,
  escalated,
  botConfig,
  initialize,
  sendMessage,
  closeSession,
  clearContext,
  updateBotConfig,
  isAdmin,
  founderChat,
}: MobileSupportPanelProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-support-panel"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "tween", duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
          className="md:hidden fixed inset-0 z-[300] bg-background flex flex-col"
          style={{ width: "100vw", height: "100dvh" }}
          data-testid="mobile-support-panel"
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
              aria-label="Close support chat"
              data-testid="button-mobile-support-back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="flex-1 min-w-0 text-[17px] font-semibold truncate text-foreground">
              Support
            </h2>
          </div>

          {/* ── Chat area (fills remaining space) ── */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <SupportChatWidget
              messages={messages}
              sending={sending}
              loading={loading}
              escalated={escalated}
              botConfig={botConfig}
              initialize={initialize}
              sendMessage={sendMessage}
              closeSession={closeSession}
              clearContext={clearContext}
              updateBotConfig={updateBotConfig}
              isAdmin={isAdmin}
              onClose={onClose}
              mode="inline"
              founderChat={founderChat}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
