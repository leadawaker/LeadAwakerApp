import { useState } from "react";
import { useLocation } from "wouter";
import { ThinLeftBar } from "@/components/crm/ThinLeftBar";
import { RightSidebar } from "@/components/crm/RightSidebar";
import { SupportChat } from "@/components/crm/SupportChat";
import { SearchModal } from "@/components/crm/SearchModal";
import { NotificationsPanel } from "@/components/crm/NotificationsPanel";
import { useWorkspace } from "@/hooks/useWorkspace";
import { X } from "lucide-react";

export function CrmShell({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { isAgencyView, currentAccountId, currentAccount } = useWorkspace();
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(3);

  const closePanel = () => setActivePanel(null);

  return (
    <div className="min-h-screen bg-background" data-testid="shell-crm" key={`${currentAccountId}-${isAgencyView}`}>
      <ThinLeftBar
        onOpenSupport={() => setActivePanel('support')}
        onOpenSearch={() => setActivePanel('search')}
        onOpenNotifications={() => setActivePanel('notifications')}
        notificationsCount={unreadCount}
        onOpenEdgeSettings={() => setActivePanel('settings')}
        onToggleHelp={() => setActivePanel('help')}
        onGoHome={() => setLocation("/")}
      />

      <div className="fixed left-[48px] top-0 bottom-0 z-40" data-testid="wrap-left-nav">
        <RightSidebar />
      </div>

      {activePanel && (
        <div className="fixed inset-0 z-[70] pointer-events-none" data-testid="unified-overlay">
          <button
            type="button"
            className="absolute inset-0 bg-black/35 pointer-events-auto"
            style={{ left: '48px' }}
            onClick={closePanel}
          />
          <aside className="absolute left-[48px] top-0 bottom-0 w-[400px] border-r border-border bg-background shadow-xl pointer-events-auto flex flex-col overflow-hidden">
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
                    <h3 className="text-sm font-bold uppercase text-muted-foreground mb-4">Profile</h3>
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
                <SupportChat open={true} onClose={closePanel} inline />
              )}
            </div>
          </aside>
        </div>
      )}

      <main className="h-screen flex flex-col bg-background md:pl-[273px]" data-testid="main-crm">
        <div className="flex-1 min-h-0">
          {children}
        </div>
      </main>
    </div>
  );
}
