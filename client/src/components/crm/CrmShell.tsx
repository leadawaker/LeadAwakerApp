import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { RightSidebar } from "./RightSidebar";
import { SupportChatWidget } from "@/components/crm/SupportChatWidget";
import { FounderInbox } from "@/components/crm/FounderInbox";
import { useSupportChat } from "@/hooks/useSupportChat";
import { useFounderChat } from "@/hooks/useFounderChat";
import { PageTransition } from "@/components/crm/PageTransition";
import { CommandPalette } from "@/components/crm/CommandPalette";
import { ErrorBoundary } from "@/components/crm/ErrorBoundary";
import { ConnectionBanner } from "@/components/crm/ConnectionBanner";
import { SettingsPanel } from "@/components/crm/SettingsPanel";
import { ColorPickerWidget } from "@/components/ui/color-picker-widget";
import { useWorkspace } from "@/hooks/useWorkspace";
import { ImpersonationBanner } from "@/components/crm/ImpersonationBanner";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { logout } from "@/hooks/useSession";
import { TopbarActionsProvider } from "@/contexts/TopbarActionsContext";
import { MobileChromeProvider } from "@/contexts/MobileChromeContext";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import { PAGE_ACCENTS, PAGE_ACCENTS_DARK } from "@/lib/pageAccents";
import { useNotificationStream } from "@/hooks/useNotificationStream";
import { useAgentWidget } from "@/contexts/AgentWidgetContext";

export function CrmShell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { currentAccount, currentAccountId, isImpersonating, impersonation, isAgencyUser } = useWorkspace();

  const { dockMode, dockWidth, isWideViewport, isOpen: agentOpen, toggleWidget: toggleAiWidget } = useAgentWidget();
  const dockActive = dockMode && isWideViewport && agentOpen;

  const [viewportW, setViewportW] = useState(() => document.documentElement.clientWidth);
  useEffect(() => {
    const onResize = () => setViewportW(document.documentElement.clientWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [prospectsFullWidth, setProspectsFullWidth] = useState(() => {
    try { return localStorage.getItem("prospects-full-width") === "true"; } catch { return false; }
  });
  useEffect(() => {
    const handler = () => {
      try { setProspectsFullWidth(localStorage.getItem("prospects-full-width") === "true"); } catch {}
    };
    window.addEventListener("prospects-fullwidth-change", handler);
    return () => window.removeEventListener("prospects-fullwidth-change", handler);
  }, []);

  const [leadsFullWidth, setLeadsFullWidth] = useState(() => {
    // Default ON: Leads renders full-width (toolbar flush to nav, panels expand)
    // unless the user has explicitly opted out.
    try { return localStorage.getItem("leads-full-width") !== "false"; } catch { return true; }
  });
  useEffect(() => {
    const handler = () => {
      try { setLeadsFullWidth(localStorage.getItem("leads-full-width") !== "false"); } catch {}
    };
    window.addEventListener("leads-fullwidth-change", handler);
    return () => window.removeEventListener("leads-fullwidth-change", handler);
  }, []);

  const isProspectsFullWidth = prospectsFullWidth && location.includes("/prospects");
  const isLeadsFullWidth = leadsFullWidth && location.includes("/leads");
  const isCampaignsFullWidth = location.includes("/campaigns");
  const isAccountsFullWidth = location.includes("/accounts");
  const isTasksFullWidth = location.includes("/tasks");
  const isAnyFullWidth = isProspectsFullWidth || isLeadsFullWidth || isCampaignsFullWidth || isAccountsFullWidth || isTasksFullWidth;
  const isContactsPage = location.includes("/contacts");
  // The redesigned desktop calendar is full-bleed: flush to the navbar and all
  // screen edges (no centered max-width, no top/bottom/side gaps). Mobile keeps
  // the normal padded layout.
  const isCalendarFlush = location.includes("/calendar") && viewportW >= 1024;
  // Agency view (all-accounts mode) is now role-derived, not URL-derived.
  const isAgencyView = isAgencyUser;
  const { isDark, toggleTheme } = useTheme();
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [founderChatOpen, setFounderChatOpen] = useState(false);
  const supportChat = useSupportChat();
  const founderChat = useFounderChat();
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // History sentinel: push a state entry when More opens so the phone Back
  // button closes the drawer instead of navigating away from the app.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const id = Date.now();
    window.history.pushState({ __moreMenu: id }, "");
    const onPop = () => {
      // Back pressed — sentinel was popped by the browser; just close the drawer.
      setIsMobileMenuOpen(false);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Do NOT call history.back() here — it fires popstate asynchronously,
      // which other sentinels (AgentChatWidget) hear before their own cleanup
      // runs, causing the widget to close immediately after opening.
      // The orphaned sentinel entry is harmless once the listener is removed.
    };
  }, [isMobileMenuOpen]);

  // Paint button (nav) dispatches this to open the CRM color customization tool
  useEffect(() => {
    const handler = () => setColorPickerOpen(prev => !prev);
    window.addEventListener("toggle-color-picker", handler);
    return () => window.removeEventListener("toggle-color-picker", handler);
  }, []);

  // Any page can dispatch "open-founder-chat" to open the founder chat panel
  // Any footer nav tap or button can dispatch "close-founder-chat" to close it
  useEffect(() => {
    const openHandler = () => setFounderChatOpen(true);
    const closeHandler = () => setFounderChatOpen(false);
    window.addEventListener("open-founder-chat", openHandler);
    window.addEventListener("close-founder-chat", closeHandler);
    return () => {
      window.removeEventListener("open-founder-chat", openHandler);
      window.removeEventListener("close-founder-chat", closeHandler);
    };
  }, []);
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    return saved === "true";
  });

  const handleCollapse = (val: boolean) => {
    setCollapsed(val);
    localStorage.setItem("sidebar-collapsed", String(val));
  };

  const closePanel = () => setActivePanel(null);

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  // ── Real-time notification stream (SSE + toasts) ──────────────────────────
  // Connects to the SSE interactions stream and fires toasts for new
  // notifications.  Also keeps /api/notifications/count cache fresh so the
  // Topbar badge updates instantly.
  useNotificationStream({
    enabled: true,
    accountId: currentAccountId > 0 ? currentAccountId : undefined,
  });

  // ── Legacy notification data for unread chat badge ──────────────────────────
  // Uses the legacy endpoint that returns a plain array (the main /api/notifications
  // now returns { items, unreadCount, totalCount } for the new notification system).
  const { data: notifData = [] } = useQuery<{ id: string; type: string; at: string }[]>({
    queryKey: ['/api/notifications/legacy'],
    queryFn: async () => {
      const res = await apiFetch('/api/notifications/legacy');
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Track last time user visited chats — use a ref so it updates synchronously
  // during render (before the memo runs), avoiding all async state timing issues.
  const onConversations = location.includes('/conversations');
  const lastChatVisitRef = useRef<string | null>(localStorage.getItem("leadawaker_lastChatVisitedAt"));
  // Initialize to false so the transition always fires on mount (even when page loads directly
  // on /conversations), ensuring the cutoff is set to "now" rather than a stale localStorage value.
  const prevOnConversations = useRef(false);

  if (prevOnConversations.current !== onConversations) {
    prevOnConversations.current = onConversations;
    if (onConversations) {
      // Only update cutoff when entering conversations — marks messages as seen
      const ts = new Date().toISOString();
      lastChatVisitRef.current = ts;
      localStorage.setItem("leadawaker_lastChatVisitedAt", ts);
    }
  }

  const unreadChatCount = useMemo(() => {
    // If the user is currently viewing conversations, there's nothing to alert them to.
    if (onConversations) return 0;
    const cutoff = lastChatVisitRef.current ? new Date(lastChatVisitRef.current) : null;
    const items = Array.isArray(notifData) ? notifData : [];
    return items.filter(n => n.type === 'inbound' && (!cutoff || new Date(n.at) > cutoff)).length;
  }, [notifData, onConversations]);

  // ── Color Tester: force re-render when JS-based colors change (debounced) ──
  const [colorTick, setColorTick] = useState(0);

  // ── Per-page accent colors (hue shifts along yellow → blue spectrum) ──────
  // PAGE_ACCENTS is a mutable module-level object; colorTick dep ensures re-read
  // whenever the Color Tester widget mutates it and dispatches "color-tester-update".
  const pageAccent = useMemo(() => {
    const seg = location.split("/").filter(Boolean)[1] ?? "";
    const map = isDark ? PAGE_ACCENTS_DARK : PAGE_ACCENTS;
    return map[seg] ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, colorTick, isDark]);
  const rafRef = useRef(0);
  const bumpColors = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setColorTick((n) => n + 1));
  }, []);
  useEffect(() => {
    window.addEventListener("color-tester-update", bumpColors);
    return () => {
      window.removeEventListener("color-tester-update", bumpColors);
      cancelAnimationFrame(rafRef.current);
    };
  }, [bumpColors]);

  const BANNER_H = 28;

  return (
    <TopbarActionsProvider>
    <MobileChromeProvider>
    <div
      className={cn("min-h-svh bg-background", isAgencyView && "agency-mode", isMobileMenuOpen && "mobile-scroll-lock")}
      data-testid="shell-crm"
      key={isAgencyView ? 'agency' : 'subaccount'}
      style={{
        "--banner-h": isImpersonating ? `${BANNER_H}px` : "0px",
        ...(pageAccent ? {
          "--highlight-active": pageAccent.active,
          "--highlight-selected": pageAccent.selected,
        } : {}),
      } as React.CSSProperties}
    >
      {/* Skip to main content link — visible only on keyboard focus for accessibility */}
      <a href="#main-content" className="sr-skip-link" data-testid="skip-to-main">
        Skip to main content
      </a>
      {/* Impersonation banner — fixed above the topbar; pushes topbar + sidebar down via --banner-h */}
      {isImpersonating && impersonation && (
        <ImpersonationBanner
          role={impersonation.role}
          onStop={async () => {
            try {
              const { apiFetch } = await import("@/lib/apiUtils");
              const { queryClient } = await import("@/lib/queryClient");
              await apiFetch("/api/auth/impersonate/stop", { method: "POST" });
              await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
            } catch (err) {
              console.error("Failed to stop impersonation", err);
            }
          }}
        />
      )}
      <div className="fixed left-0 bottom-0 z-40" style={{ top: "var(--banner-h, 0px)" }} data-testid="wrap-left-nav">
        <RightSidebar
          collapsed={false}
          onCollapse={handleCollapse}
          onOpenAi={toggleAiWidget}
          onOpenNotifications={() => setActivePanel('notifications')}
          onToggleHelp={() => setActivePanel('help')}
          onOpenFounderChat={() => setFounderChatOpen(true)}
          onOpenFounderInbox={() => setActivePanel('founder-inbox')}
          onOpenSettings={() => setActivePanel('settings')}
          isMobileMenuOpen={isMobileMenuOpen}
          onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
          onToggleMobileMenu={() => setIsMobileMenuOpen((v) => !v)}
          onLogout={handleLogout}
          unreadChatCount={unreadChatCount}
          isDark={isDark}
          onToggleTheme={toggleTheme}
        />
      </div>

      {activePanel && (
        <div className="fixed inset-0 z-[70] pointer-events-none" data-testid="unified-overlay">
          <button
            type="button"
            className="absolute inset-0 bg-black/25 pointer-events-auto"
            onClick={closePanel}
          />
          <aside className={cn(
            "absolute right-0 top-0 bottom-0 w-full sm:right-4 sm:top-8 sm:bottom-4 border border-border/60 bg-background shadow-sm sm:rounded-2xl pointer-events-auto flex flex-col overflow-hidden",
            activePanel === 'settings' ? "sm:w-[540px]" : "sm:w-[400px]"
          )}>
            <div className="h-[40px] px-4 flex items-center justify-between border-b border-border/30 bg-background sticky top-0 z-10 shrink-0">
              <div className="font-bold text-base capitalize pl-1">
                {activePanel === 'settings' ? 'Settings' : activePanel.replace('-', ' ')}
              </div>
              <button
                onClick={closePanel}
                className="icon-circle-lg icon-circle-base"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-grow overflow-hidden h-full">
              {activePanel === 'settings' && <SettingsPanel />}
              {activePanel === 'help' && (
                <HelpPanelContent
                  onNavigate={(path) => { closePanel(); setLocation(path); }}
                  prefix="/platform"
                  onOpenFounderChat={() => { closePanel(); setFounderChatOpen(true); }}
                />
              )}
              {activePanel === 'founder-inbox' && (
                <div className="h-full">
                  <FounderInbox />
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      <main
        id="main-content"
        className={cn(
          "h-svh flex flex-col transition-[padding-left] duration-150",
          "md:pl-[188px]",
          // Global mobile topbar removed: each list page renders its own MobileListHeader.
          "pt-[var(--banner-h,_0px)]"
        )}
        style={{
          background: "var(--surface)",
          paddingBottom: viewportW >= 1024 ? 0 : "var(--bottombar-h)",
          paddingRight: (() => {
            if (!dockActive) return undefined;
            if (isAnyFullWidth) return `${dockWidth - 1.5}px`;
            const sidebar = 188;
            const mainArea = viewportW - sidebar;
            const freeRight = Math.max(0, (mainArea - 1729) / 2) + 20;
            return dockWidth > freeRight ? `${dockWidth - freeRight}px` : undefined;
          })(),
          transition: "padding-right 150ms ease-out",
        }}
        data-testid="main-crm"
      >
        <ConnectionBanner />
        <div id="crm-content-wrapper" className="h-full w-full">
          <ErrorBoundary key={location}>
            <PageTransition>
              {children}
            </PageTransition>
          </ErrorBoundary>
        </div>
      </main>

      {/* Floating "Talk to Gabriel" chat — founder direct messages, no AI */}
      {founderChatOpen && (
        <SupportChatWidget
          mode="floating"
          founderOnly
          founderChat={{
            messages: founderChat.messages,
            sending: founderChat.sending,
            loading: founderChat.loading,
            initialize: founderChat.initialize,
            sendMessage: founderChat.sendMessage,
            closeSession: founderChat.closeSession,
            clearContext: founderChat.clearContext,
          }}
          messages={supportChat.messages}
          sending={supportChat.sending}
          loading={supportChat.loading}
          escalated={supportChat.escalated}
          botConfig={supportChat.botConfig}
          initialize={supportChat.initialize}
          sendMessage={supportChat.sendMessage}
          closeSession={supportChat.closeSession}
          clearContext={supportChat.clearContext}
          updateBotConfig={supportChat.updateBotConfig}
          isAdmin={isAgencyUser}
          onClose={() => setFounderChatOpen(false)}
        />
      )}

      {/* Global Command Palette (Cmd+K / Ctrl+K) */}
      <CommandPalette />

      {/* CRM color customization tool — dev only, opened by the nav Paint button */}
      {import.meta.env.DEV && <ColorPickerWidget open={colorPickerOpen} onClose={() => setColorPickerOpen(false)} />}
    </div>
    </MobileChromeProvider>
    </TopbarActionsProvider>
  );
}

/* ─── Help Panel Content (mobile help slide-in) ─────────────────────────── */

function HelpPanelContent({ onNavigate, prefix, onOpenFounderChat }: { onNavigate: (path: string) => void; prefix: string; onOpenFounderChat: () => void }) {
  return (
    <div className="p-4 space-y-2 overflow-auto h-full">
      <button
        onClick={() => onNavigate(`${prefix}/docs`)}
        className="w-full text-left block rounded-xl px-4 py-3 text-sm hover:bg-muted/30 transition-colors font-medium border border-transparent hover:border-border"
      >
        Documentation
      </button>

      <button
        onClick={onOpenFounderChat}
        className="w-full text-left block rounded-xl px-4 py-3 text-sm hover:bg-muted/30 transition-colors font-medium border border-transparent hover:border-border"
      >
        Message Gabriel
      </button>
    </div>
  );
}
