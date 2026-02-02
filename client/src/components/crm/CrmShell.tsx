import { useState } from "react";
import { useLocation } from "wouter";
import { RightSidebar } from "@/components/crm/RightSidebar";
import { SupportChat } from "@/components/crm/SupportChat";
import { SearchModal } from "@/components/crm/SearchModal";
import { NotificationsPanel } from "@/components/crm/NotificationsPanel";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { X, Search, Bell, HelpCircle, Headphones, Moon } from "lucide-react";

export function CrmShell({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { isAgencyView, currentAccountId, currentAccount } = useWorkspace();
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(3);
  const [collapsed, setCollapsed] = useState(false);

  const closePanel = () => setActivePanel(null);

  return (
    <div className="min-h-screen bg-background" data-testid="shell-crm" key={isAgencyView ? 'agency' : 'subaccount'}>
      {/* Slim Top Bar */}
      <div className={cn(
        "fixed top-0 left-0 right-0 h-8 z-[60] flex items-center justify-between px-4 transition-colors duration-300",
        isAgencyView ? "bg-yellow-500 shadow-[0_1px_12px_rgba(234,179,8,0.4)]" : "bg-blue-600 shadow-[0_1px_12px_rgba(37,99,235,0.4)]"
      )}>
        <div className="flex items-center gap-2 group relative">
          <button 
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            data-testid="button-home-logo"
          >
            <img src="/6.Favicon.svg" alt="Lead Awaker" className="h-5 w-5" />
            <span className={cn("text-xs font-bold tracking-tight", isAgencyView ? "text-black" : "text-white")}>
              Lead Awaker
            </span>
          </button>
          <div className="absolute left-0 top-full mt-1 hidden group-hover:block bg-black/80 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap z-[70]">
            v.0.5
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => setActivePanel('search')} className="p-1 hover:bg-black/10 rounded transition-colors" title="Search">
            <Search className={cn("h-4 w-4", isAgencyView ? "text-black" : "text-white")} />
          </button>
          <button onClick={() => setActivePanel('notifications')} className="p-1 hover:bg-black/10 rounded transition-colors relative" title="Alerts">
            <Bell className={cn("h-4 w-4", isAgencyView ? "text-black" : "text-white")} />
            {unreadCount > 0 && <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full border border-white" />}
          </button>
          <button 
            onClick={() => {
              const isDark = document.documentElement.classList.toggle("dark");
              localStorage.setItem("theme", isDark ? "dark" : "light");
            }} 
            className="p-1 hover:bg-black/10 rounded transition-colors" 
            title="Night Mode"
          >
            <Moon className={cn("h-4 w-4", isAgencyView ? "text-black" : "text-white")} />
          </button>
          <button onClick={() => setActivePanel('help')} className="p-1 hover:bg-black/10 rounded transition-colors" title="Help">
            <HelpCircle className={cn("h-4 w-4", isAgencyView ? "text-black" : "text-white")} />
          </button>
          <button onClick={() => setActivePanel('support')} className="p-1 hover:bg-black/10 rounded transition-colors" title="Customer Service">
            <Headphones className={cn("h-4 w-4", isAgencyView ? "text-black" : "text-white")} />
          </button>
        </div>
      </div>

      <div className="fixed left-0 top-0 bottom-0 z-40" data-testid="wrap-left-nav">
        <RightSidebar 
          collapsed={collapsed} 
          onCollapse={setCollapsed}
          onOpenSupport={() => setActivePanel('support')}
          onOpenSearch={() => setActivePanel('search')}
          onOpenNotifications={() => setActivePanel('notifications')}
          notificationsCount={unreadCount}
          onOpenEdgeSettings={() => setActivePanel('settings')}
          onToggleHelp={() => setActivePanel('help')}
          onGoHome={() => setLocation("/")}
        />
      </div>

      {activePanel && (
        <div className="fixed inset-0 z-[70] pointer-events-none" data-testid="unified-overlay">
          <button
            type="button"
            className="absolute inset-0 bg-black/35 pointer-events-auto"
            onClick={closePanel}
          />
          <aside className="absolute right-0 top-0 bottom-0 w-full md:w-[400px] border-l border-border bg-background shadow-xl pointer-events-auto flex flex-col overflow-hidden">
            <div className="h-14 px-4 flex items-center justify-between border-b border-border bg-background sticky top-0 z-10 shrink-0">
              <div className="font-semibold capitalize">{activePanel.replace('-', ' ')}</div>
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
                  <section>
                    <h3 className="text-xs font-bold uppercase text-muted-foreground mb-4">System Actions</h3>
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
                        onClick={() => {
                          const isDark = document.documentElement.classList.toggle("dark");
                          localStorage.setItem("theme", isDark ? "dark" : "light");
                        }}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 transition-colors"
                      >
                        <Moon className="h-5 w-5 text-muted-foreground" />
                        <span className="text-xs font-semibold">Dark Mode</span>
                      </button>
                    </div>

                    <h3 className="text-xs font-bold uppercase text-muted-foreground mb-4">Profile</h3>
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
                  <section>
                    <h3 className="text-sm font-bold uppercase text-muted-foreground mb-4">Security</h3>
                    <button className="h-10 w-full rounded-xl border border-border bg-muted/20 hover:bg-muted/30 text-sm font-semibold">
                      Send reset email
                    </button>
                  </section>
                  <section>
                    <h3 className="text-sm font-bold uppercase text-muted-foreground mb-4">Users</h3>
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
        className={cn(
          "h-screen flex flex-col bg-background transition-all duration-200",
          collapsed ? "md:pl-[64px]" : "md:pl-[225px]",
          "pb-[64px] md:pb-0 pt-[32px] md:pt-[40px]"
        )} 
        data-testid="main-crm"
      >
        <div className="flex-1 min-h-0">
          {children}
        </div>
      </main>
    </div>
  );
}
