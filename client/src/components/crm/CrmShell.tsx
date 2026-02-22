import { useState } from "react";
import { useLocation } from "wouter";
import { RightSidebar } from "./RightSidebar";
import { Topbar } from "@/components/crm/Topbar";
import { SupportChat } from "@/components/crm/SupportChat";
import { SearchModal } from "@/components/crm/SearchModal";
import { NotificationsPanel } from "@/components/crm/NotificationsPanel";
import { PageTransition } from "@/components/crm/PageTransition";
import { CommandPalette } from "@/components/crm/CommandPalette";
import { ErrorBoundary } from "@/components/crm/ErrorBoundary";
import { ConnectionBanner } from "@/components/crm/ConnectionBanner";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { X, Search, Bell, HelpCircle, Headphones, Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { logout } from "@/hooks/useSession";
import { TopbarActionsProvider } from "@/contexts/TopbarActionsContext";

export function CrmShell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { currentAccount } = useWorkspace();
  // Use reactive wouter location (not the stale useMemo in useWorkspace) so the
  // agency-mode class updates immediately when navigating between /agency and /subaccount routes.
  const isAgencyView = location.startsWith("/agency");
  const { isDark, toggleTheme } = useTheme();
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(3);
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
        notificationsCount={unreadCount}
        onLogout={handleLogout}
      />
      <div className="fixed left-0 top-0 bottom-0 z-40" data-testid="wrap-left-nav">
        <RightSidebar
          collapsed={collapsed}
          onCollapse={handleCollapse}
          onOpenSupport={() => setActivePanel('support')}
          onOpenSearch={() => setActivePanel('search')}
          onOpenNotifications={() => setActivePanel('notifications')}
          notificationsCount={unreadCount}
          onToggleHelp={() => setActivePanel('help')}
          isMobileMenuOpen={isMobileMenuOpen}
          onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
          onToggleMobileMenu={() => setIsMobileMenuOpen((v) => !v)}
          onLogout={handleLogout}
        />
      </div>

      {activePanel && (
        <div className="fixed inset-0 z-[70] pointer-events-none" data-testid="unified-overlay">
          <button
            type="button"
            className="absolute inset-0 bg-black/25 glass-overlay pointer-events-auto"
            onClick={closePanel}
          />
          <aside className="absolute right-0 top-0 bottom-0 w-full sm:right-4 sm:top-8 sm:bottom-4 sm:w-[400px] border border-border/60 bg-background/90 dark:bg-background/85 glass-accent shadow-sm sm:rounded-2xl pointer-events-auto flex flex-col overflow-hidden">
            <div className="h-14 px-6 flex items-center justify-between border-b border-border/50 bg-background/80 glass-divider sticky top-0 z-10 shrink-0">
              <div className="font-bold text-lg capitalize">{activePanel.replace('-', ' ')}</div>
              <button onClick={closePanel} className="h-9 w-9 rounded-xl hover:bg-muted/30 grid place-items-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="flex-grow overflow-hidden h-full">
              {activePanel === 'search' && (
                <SearchModal open={true} onOpenChange={(open) => !open && closePanel()} inline />
              )}
              {activePanel === 'notifications' && (
                <NotificationsPanel open={true} onClose={closePanel} onMarkAllRead={() => setUnreadCount(0)} inline />
              )}
              {activePanel === 'settings' && (
                <div className="p-6 space-y-8 overflow-auto h-full">
                  <section className="bg-card rounded-2xl p-6 shadow-sm border border-border">
                    <h3 className="text-xs font-bold uppercase text-muted-foreground mb-4 tracking-widest">System Actions</h3>
                    <div className="grid grid-cols-2 gap-3 mb-8">
                      <button onClick={() => { setActivePanel('search'); }} className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 transition-colors">
                        <Search className="h-5 w-5 text-muted-foreground" />
                        <span className="text-xs font-semibold">Search</span>
                      </button>
                      <button onClick={() => { setActivePanel('notifications'); }} className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 transition-colors">
                        <Bell className="h-5 w-5 text-muted-foreground" />
                        <span className="text-xs font-semibold">Alerts</span>
                      </button>
                      <button onClick={() => { setActivePanel('help'); }} className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 transition-colors">
                        <HelpCircle className="h-5 w-5 text-muted-foreground" />
                        <span className="text-xs font-semibold">Help</span>
                      </button>
                      <button onClick={() => { setActivePanel('support'); }} className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 transition-colors">
                        <Headphones className="h-5 w-5 text-muted-foreground" />
                        <span className="text-xs font-semibold">Support</span>
                      </button>
                      <button
                        onClick={toggleTheme}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 transition-colors"
                      >
                        {isDark ? <Sun className="h-5 w-5 text-muted-foreground" /> : <Moon className="h-5 w-5 text-muted-foreground" />}
                        <span className="text-xs font-semibold">{isDark ? "Light Mode" : "Dark Mode"}</span>
                      </button>
                      <button
                        onClick={handleLogout}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-red-500/10 hover:bg-red-500/20 transition-colors col-span-2 mt-2"
                      >
                        <span className="text-xs font-bold text-red-600">Logout</span>
                      </button>
                    </div>

                    <h3 className="text-xs font-bold uppercase text-muted-foreground mb-4 tracking-widest">Profile</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs text-muted-foreground">Name</label>
                        <input className="mt-1 h-10 w-full rounded-xl border border-border bg-muted/20 px-3 text-sm" defaultValue={currentAccount?.name || ''} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Email</label>
                        <input className="mt-1 h-10 w-full rounded-xl border border-border bg-muted/20 px-3 text-sm" defaultValue={currentAccount?.owner_email || ''} />
                      </div>
                    </div>
                  </section>
                  <section className="bg-card rounded-2xl p-6 shadow-sm border border-border">
                    <h3 className="text-sm font-bold uppercase text-muted-foreground mb-4 tracking-widest">Security</h3>
                    <button className="h-10 w-full rounded-xl border border-border bg-muted/20 hover:bg-muted/30 text-sm font-semibold">
                      Send reset email
                    </button>
                  </section>
                  <section className="bg-card rounded-2xl p-6 shadow-sm border border-border">
                    <h3 className="text-sm font-bold uppercase text-muted-foreground mb-4 tracking-widest">Users</h3>
                    <div className="space-y-2">
                      <button className="h-10 w-full rounded-xl border border-border bg-muted/20 hover:bg-muted/30 text-sm font-semibold text-left px-4">Invite user</button>
                      <button className="h-10 w-full rounded-xl border border-border bg-muted/20 hover:bg-muted/30 text-sm font-semibold text-left px-4">Manage roles</button>
                    </div>
                  </section>
                </div>
              )}
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
          "h-screen flex flex-col bg-stone-200 dark:bg-stone-900 transition-all duration-200 overflow-hidden",
          collapsed ? "md:pl-[60px]" : "md:pl-[180px]",
          "pb-[64px] md:pb-0 pt-[56px]"
        )}
        data-testid="main-crm"
      >
        <ConnectionBanner />
        <div className="h-full w-full px-4 md:pl-10 md:pr-10 pt-4 pb-0 overflow-y-auto">
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
