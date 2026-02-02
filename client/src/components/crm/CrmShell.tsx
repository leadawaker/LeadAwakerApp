import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { RightSidebar } from "@/components/crm/RightSidebar";
import { SupportChat } from "@/components/crm/SupportChat";
import { SearchModal } from "@/components/crm/SearchModal";
import { NotificationsPanel } from "@/components/crm/NotificationsPanel";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { X, Search, Bell, HelpCircle, Headphones, Moon, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { campaigns } from "@/data/mocks";

export function CrmShell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { isAgencyView, currentAccountId, currentAccount } = useWorkspace();
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(3);
  const [collapsed, setCollapsed] = useState(false);
  const [campaignId, setCampaignId] = useState<number | "all">("all");

  const closePanel = () => setActivePanel(null);

  const campaignOptions = useMemo(() => {
    return campaigns.filter(c => c.account_id === currentAccountId);
  }, [currentAccountId]);

  const handleCampaignChange = (v: string) => {
    const id = v === "all" ? "all" : Number(v);
    setCampaignId(id);
    // Dispatch custom event so pages can listen to it if they don't use the shell state
    window.dispatchEvent(new CustomEvent('campaignChange', { detail: id }));
  };

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
            <img src="/favicon.svg" alt="Lead Awaker" className="h-5 w-5" />
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

      {/* Main Sidebar Structure */}
      <div 
        className={cn(
          "fixed left-0 top-8 bottom-0 z-40 bg-background border-r border-border transition-all duration-200 flex flex-col",
          collapsed ? "w-[64px]" : "w-[225px]"
        )}
      >
        <div className="flex-1 overflow-y-auto pt-4 flex flex-col">
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
            hideStandardSidebar={true}
          />

          {/* New Campaign Selector in Sidebar */}
          {!collapsed && !isAgencyView && (
            <div className="px-4 mt-6">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">Campaign</label>
              <select
                value={campaignId}
                onChange={(e) => handleCampaignChange(e.target.value)}
                className="w-full h-9 rounded-xl border border-border bg-muted/20 px-3 text-xs focus:ring-1 focus:ring-primary outline-none"
                data-testid="sidebar-campaign-select"
              >
                <option value="all">All Campaigns</option>
                {campaignOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-border space-y-2 relative">
          <button
            onClick={() => {
              const nextId = currentAccountId === 1 ? 2 : 1;
              const nextBase = nextId === 1 ? "/agency" : "/subaccount";
              const currentPrefix = isAgencyView ? "/agency" : "/subaccount";
              const locString = typeof location === 'string' ? location : window.location.pathname;
              const tail = locString.startsWith(currentPrefix)
                ? locString.slice(currentPrefix.length)
                : locString.replace(/^\/(agency|subaccount)/, "");
              
              window.location.href = `${nextBase}${tail || "/dashboard"}`;
            }}
            className={cn(
              "w-full flex items-center gap-3 h-10 px-3 rounded-xl hover:bg-muted/50 transition-colors text-primary",
              collapsed && "justify-center px-0"
            )}
            title="Switch Workspace"
          >
            <div className={cn(
              "h-5 w-5 rounded flex items-center justify-center text-[10px] font-bold",
              isAgencyView ? "bg-blue-600 text-white" : "bg-yellow-500 text-black"
            )}>
              {isAgencyView ? "C" : "A"}
            </div>
            {!collapsed && <span className="text-sm font-bold">Switch to {isAgencyView ? "Client" : "Agency"}</span>}
          </button>

          <button
            onClick={() => setActivePanel('settings')}
            className={cn(
              "w-full flex items-center gap-3 h-10 px-3 rounded-xl hover:bg-muted/50 transition-colors",
              collapsed && "justify-center px-0"
            )}
            title="Settings"
          >
            <Settings className="h-5 w-5 text-muted-foreground" />
            {!collapsed && <span className="text-sm font-semibold">Settings</span>}
          </button>
          
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute right-0 bottom-6 translate-x-1/2 h-6 w-6 rounded-full border border-border bg-background shadow-sm hover:bg-muted grid place-items-center z-50"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </button>
        </div>
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
