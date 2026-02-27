import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { RightSidebar } from "./RightSidebar";
import { Topbar } from "@/components/crm/Topbar";
import { SupportChat } from "@/components/crm/SupportChat";
import { PageTransition } from "@/components/crm/PageTransition";
import { CommandPalette } from "@/components/crm/CommandPalette";
import { ErrorBoundary } from "@/components/crm/ErrorBoundary";
import { ConnectionBanner } from "@/components/crm/ConnectionBanner";
import { SettingsPanel } from "@/components/crm/SettingsPanel";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { X, Search, Bell, HelpCircle, Headphones, Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { logout } from "@/hooks/useSession";
import { TopbarActionsProvider } from "@/contexts/TopbarActionsContext";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";

export function CrmShell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { currentAccount } = useWorkspace();
  // Use reactive wouter location (not the stale useMemo in useWorkspace) so the
  // agency-mode class updates immediately when navigating between /agency and /subaccount routes.
  const isAgencyView = location.startsWith("/agency");
  const { isDark, toggleTheme } = useTheme();
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

  // ── Notifications for unread chat badge ─────────────────────────────────────
  const { data: notifData = [] } = useQuery<{ id: string; type: string; at: string }[]>({
    queryKey: ['/api/notifications'],
    queryFn: async () => {
      const res = await apiFetch('/api/notifications');
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Track last time user visited chats
  useEffect(() => {
    if (location.includes('/conversations')) {
      localStorage.setItem("leadawaker_lastChatVisitedAt", new Date().toISOString());
    }
  }, [location]);

  const unreadChatCount = useMemo(() => {
    const lastVisit = localStorage.getItem("leadawaker_lastChatVisitedAt");
    const cutoff = lastVisit ? new Date(lastVisit) : null;
    const items = Array.isArray(notifData) ? notifData : [];
    return items.filter(n => n.type === 'inbound' && (!cutoff || new Date(n.at) > cutoff)).length;
  }, [notifData]);

  // ── Color Tester: force re-render when JS-based colors change (debounced) ──
  const [, setColorTick] = useState(0);
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

  return (
    <TopbarActionsProvider>
    <div className={cn("min-h-screen bg-background", isAgencyView && "agency-mode")} data-testid="shell-crm" key={isAgencyView ? 'agency' : 'subaccount'}>
      {/* Skip to main content link — visible only on keyboard focus for accessibility */}
      <a href="#main-content" className="sr-skip-link" data-testid="skip-to-main">
        Skip to main content
      </a>
      <Topbar
        onOpenPanel={(p) => setActivePanel(p)}
        collapsed={collapsed}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen((v) => !v)}
        onLogout={handleLogout}
      />
      <div className="fixed left-0 top-0 bottom-0 z-40" data-testid="wrap-left-nav">
        <RightSidebar
          collapsed={collapsed}
          onCollapse={handleCollapse}
          onOpenSupport={() => setActivePanel('support')}
          onOpenSearch={() => setActivePanel('search')}
          onOpenNotifications={() => setActivePanel('notifications')}
          onToggleHelp={() => setActivePanel('help')}
          onOpenSettings={() => setActivePanel('settings')}
          isMobileMenuOpen={isMobileMenuOpen}
          onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
          onToggleMobileMenu={() => setIsMobileMenuOpen((v) => !v)}
          onLogout={handleLogout}
          unreadChatCount={unreadChatCount}
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
            <div className="h-[62px] px-4 flex items-center justify-between border-b border-border/30 bg-background sticky top-0 z-10 shrink-0">
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
                <div className="p-4 space-y-2 overflow-auto h-full">
                  <a href="#" className="block rounded-xl px-4 py-3 text-sm hover:bg-muted/30 transition-colors font-medium border border-transparent hover:border-border">Documentation</a>
                  <a href="#" className="block rounded-xl px-4 py-3 text-sm hover:bg-muted/30 transition-colors font-medium border border-transparent hover:border-border">Social Media</a>
                  <a href="#" className="block rounded-xl px-4 py-3 text-sm hover:bg-muted/30 transition-colors font-medium border border-transparent hover:border-border">What's New</a>
                </div>
              )}
              {activePanel === 'support' && (
                <div className="h-full">
                  <SupportChat open={true} onClose={closePanel} inline />
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      <main
        id="main-content"
        className={cn(
          "h-screen flex flex-col bg-background transition-[padding-left] duration-200 overflow-hidden",
          collapsed ? "md:pl-[78px]" : "md:pl-[225px]",
          "pb-[64px] md:pb-0 pt-[62px]"
        )}
        data-testid="main-crm"
      >
        <ConnectionBanner />
        <div className="h-full w-full px-3 md:pl-0 md:pr-5 pt-2 pb-0 overflow-y-auto">
          <ErrorBoundary>
            <PageTransition>
              {children}
            </PageTransition>
          </ErrorBoundary>
        </div>
      </main>

      {/* Global Command Palette (Cmd+K / Ctrl+K) */}
      <CommandPalette />
    </div>
    </TopbarActionsProvider>
  );
}
