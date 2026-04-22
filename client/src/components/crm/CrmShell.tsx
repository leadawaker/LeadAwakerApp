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
import { X, Search, Bell, HelpCircle, Headphones, Moon, Sun, Instagram, Facebook, Mail, Phone, ChevronDown, Sparkles, Tag, BarChart3 } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { logout } from "@/hooks/useSession";
import { TopbarActionsProvider } from "@/contexts/TopbarActionsContext";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import { PAGE_ACCENTS, PAGE_ACCENTS_DARK } from "@/lib/pageAccents";
import { useNotificationStream } from "@/hooks/useNotificationStream";
import { useAgentWidget } from "@/contexts/AgentWidgetContext";

export function CrmShell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { currentAccount, currentAccountId } = useWorkspace();
  const { dockMode, dockWidth, isWideViewport, isOpen: agentOpen } = useAgentWidget();
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
    try { return localStorage.getItem("leads-full-width") === "true"; } catch { return false; }
  });
  useEffect(() => {
    const handler = () => {
      try { setLeadsFullWidth(localStorage.getItem("leads-full-width") === "true"); } catch {}
    };
    window.addEventListener("leads-fullwidth-change", handler);
    return () => window.removeEventListener("leads-fullwidth-change", handler);
  }, []);

  const isProspectsFullWidth = prospectsFullWidth && location.includes("/prospects");
  const isLeadsFullWidth = leadsFullWidth && location.includes("/leads");
  const isCampaignsFullWidth = location.includes("/campaigns");
  const isAccountsFullWidth = location.includes("/accounts");
  const isAnyFullWidth = isProspectsFullWidth || isLeadsFullWidth || isCampaignsFullWidth || isAccountsFullWidth;
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

  return (
    <TopbarActionsProvider>
    <div
      className={cn("min-h-svh bg-background", isAgencyView && "agency-mode", isMobileMenuOpen && "mobile-scroll-lock")}
      data-testid="shell-crm"
      key={isAgencyView ? 'agency' : 'subaccount'}
      style={pageAccent ? {
        "--highlight-active": pageAccent.active,
        "--highlight-selected": pageAccent.selected,
      } as React.CSSProperties : undefined}
    >
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
                <HelpPanelContent onNavigate={(path) => { closePanel(); setLocation(path); }} prefix={location.startsWith("/agency") ? "/agency" : "/subaccount"} />
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
          "h-svh flex flex-col bg-background transition-[padding-left] duration-200 overflow-hidden",
          collapsed ? "md:pl-[56px]" : "md:pl-[225px]"
        )}
        style={{
          paddingTop: "var(--topbar-h)",
          paddingBottom: "var(--bottombar-h)",
          paddingRight: (() => {
            if (!dockActive) return undefined;
            if (isAnyFullWidth) return `${dockWidth - 1.5}px`;
            const sidebar = collapsed ? 56 : 225;
            const mainArea = viewportW - sidebar;
            const freeRight = Math.max(0, (mainArea - 1729) / 2) + 20;
            return dockWidth > freeRight ? `${dockWidth - freeRight}px` : undefined;
          })(),
          transition: "padding-right 150ms ease-out",
        }}
        data-testid="main-crm"
      >
        <ConnectionBanner />
        <div id="crm-content-wrapper" className={cn("h-full w-full mx-auto pt-2 pb-0 overflow-y-auto", isAnyFullWidth ? "px-1 md:px-1" : "px-3 md:pl-0 md:pr-5 max-w-[1729px]")}>
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

/* ─── Help Panel Content (social media expandable) ──────────────────────── */

const SOCIAL_LINKS = [
  { label: "Instagram", handle: "@leadawaker", href: "https://www.instagram.com/leadawaker/", icon: Instagram, color: "text-pink-600" },
  { label: "Facebook", handle: "Lead Awaker", href: "https://www.facebook.com/profile.php?id=61552291063345", icon: Facebook, color: "text-blue-600" },
  { label: "Email", handle: "gabriel@leadawaker.com", href: "mailto:gabriel@leadawaker.com", icon: Mail, color: "text-foreground/70" },
  { label: "WhatsApp", handle: "+(55) 47 9740-02162", href: "https://wa.me/5547974002162", icon: Phone, color: "text-emerald-600" },
];

const HELP_UPDATES = [
  {
    id: "update-pipeline-donut",
    Icon: BarChart3,
    iconColor: "text-amber-600",
    title: "Pipeline Donut Chart",
    description: "Interactive funnel visualization with click-to-filter stages.",
    date: "Mar 2026",
  },
  {
    id: "update-ai-analysis",
    Icon: Sparkles,
    iconColor: "text-violet-600",
    title: "AI Campaign Analysis",
    description: "Get instant AI-generated summaries of campaign performance.",
    date: "Feb 2026",
  },
  {
    id: "update-campaign-tags",
    Icon: Tag,
    iconColor: "text-indigo-500",
    title: "Campaign Tags",
    description: "Organize campaigns with custom tag categories and colors.",
    date: "Feb 2026",
  },
];

function HelpPanelContent({ onNavigate, prefix }: { onNavigate: (path: string) => void; prefix: string }) {
  const [socialOpen, setSocialOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);

  return (
    <div className="p-4 space-y-2 overflow-auto h-full">
      <button
        onClick={() => onNavigate(`${prefix}/docs`)}
        className="w-full text-left block rounded-xl px-4 py-3 text-sm hover:bg-muted/30 transition-colors font-medium border border-transparent hover:border-border"
      >
        Documentation
      </button>

      {/* Social Media — expandable */}
      <div>
        <button
          type="button"
          onClick={() => setSocialOpen((v) => !v)}
          className="w-full rounded-xl px-4 py-3 text-sm hover:bg-muted/30 transition-colors font-medium border border-transparent hover:border-border flex items-center justify-between"
        >
          Social Media
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", socialOpen && "rotate-180")} />
        </button>
        {socialOpen && (
          <div className="mt-1 ml-2 space-y-0.5">
            {SOCIAL_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={link.href.startsWith("mailto:") ? undefined : "_blank"}
                rel={link.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted/30 transition-colors"
              >
                <link.icon className={cn("h-4 w-4 shrink-0", link.color)} />
                <div className="min-w-0">
                  <span className="font-medium text-foreground">{link.label}</span>
                  <span className="block text-[12px] text-muted-foreground truncate">{link.handle}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* What's New — expandable */}
      <div>
        <button
          type="button"
          onClick={() => setWhatsNewOpen((v) => !v)}
          className="w-full rounded-xl px-4 py-3 text-sm hover:bg-muted/30 transition-colors font-medium border border-transparent hover:border-border flex items-center justify-between"
        >
          What's New
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", whatsNewOpen && "rotate-180")} />
        </button>
        {whatsNewOpen && (
          <div className="mt-1 ml-2 space-y-0.5">
            {HELP_UPDATES.map((update) => (
              <div key={update.id} className="flex items-start gap-3 rounded-lg px-3 py-2.5">
                <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center border border-black/[0.125] bg-transparent mt-0.5">
                  <update.Icon className={cn("h-4 w-4", update.iconColor)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium text-foreground text-sm">{update.title}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">{update.date}</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">{update.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
