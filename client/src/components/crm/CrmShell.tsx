import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ThinLeftBar } from "@/components/crm/ThinLeftBar";
import { RightSidebar } from "@/components/crm/RightSidebar";
import { SupportChat } from "@/components/crm/SupportChat";
import { SearchModal } from "@/components/crm/SearchModal";
import { NotificationsPanel } from "@/components/crm/NotificationsPanel";
import { HelpMenu } from "@/components/crm/HelpMenu";
import { useWorkspace } from "@/hooks/useWorkspace";
import { X } from "lucide-react";

function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currentAccount } = useWorkspace();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] pointer-events-none" data-testid="overlay-settings">
      <button
        type="button"
        className="absolute inset-0 bg-black/35 pointer-events-auto"
        style={{ left: '48px' }}
        onClick={onClose}
      />
      <aside className="absolute left-[48px] top-0 bottom-0 w-[400px] border-r border-border bg-background shadow-xl pointer-events-auto overflow-auto">
        <div className="h-14 px-4 flex items-center justify-between border-b border-border sticky top-0 bg-background z-10">
          <div className="font-semibold">Settings</div>
          <button onClick={onClose} className="h-9 w-9 rounded-xl hover:bg-muted/30 grid place-items-center">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6 space-y-8">
           <section>
             <h3 className="text-sm font-bold uppercase text-muted-foreground mb-4">Profile</h3>
             <div className="space-y-4">
               <div>
                 <label className="text-xs text-muted-foreground">Name</label>
                 <input className="mt-1 h-10 w-full rounded-xl border border-border bg-muted/20 px-3 text-sm" defaultValue={currentAccount.name} />
               </div>
               <div>
                 <label className="text-xs text-muted-foreground">Email</label>
                 <input className="mt-1 h-10 w-full rounded-xl border border-border bg-muted/20 px-3 text-sm" defaultValue={currentAccount.owner_email} />
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
      </aside>
    </div>
  );
}

function HelpPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] pointer-events-none" data-testid="overlay-help">
      <button
        type="button"
        className="absolute inset-0 bg-black/35 pointer-events-auto"
        style={{ left: '48px' }}
        onClick={onClose}
      />
      <aside className="absolute left-[48px] top-0 bottom-0 w-[400px] border-r border-border bg-background shadow-xl pointer-events-auto">
        <div className="h-14 px-4 border-b border-border flex items-center justify-between">
          <div className="font-semibold">Help & Resources</div>
          <button onClick={onClose} className="h-9 w-9 rounded-xl hover:bg-muted/30 grid place-items-center">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-2">
          <a href="#" className="block rounded-xl px-4 py-3 text-sm hover:bg-muted/30 transition-colors font-medium">Documentation</a>
          <a href="#" className="block rounded-xl px-4 py-3 text-sm hover:bg-muted/30 transition-colors font-medium">Social Media</a>
          <a href="#" className="block rounded-xl px-4 py-3 text-sm hover:bg-muted/30 transition-colors font-medium">What's New</a>
        </div>
      </aside>
    </div>
  );
}

export function CrmShell({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { isAgencyView, currentAccountId } = useWorkspace();
  const [supportOpen, setSupportOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
  const [helpOpen, setHelpOpen] = useState(false);

  const closeAll = () => {
    setSupportOpen(false);
    setSearchOpen(false);
    setNotificationsOpen(false);
    setSettingsOpen(false);
    setHelpOpen(false);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="shell-crm" key={`${currentAccountId}-${isAgencyView}`}>
      <ThinLeftBar
        onOpenSupport={() => { closeAll(); setSupportOpen(true); }}
        onOpenSearch={() => { closeAll(); setSearchOpen(true); }}
        onOpenNotifications={() => { closeAll(); setNotificationsOpen(true); }}
        notificationsCount={unreadCount}
        onOpenEdgeSettings={() => { closeAll(); setSettingsOpen(true); }}
        onToggleHelp={() => { closeAll(); setHelpOpen(true); }}
        onGoHome={() => setLocation("/")}
      />

      <div className="fixed left-[48px] top-0 bottom-0 z-40" data-testid="wrap-left-nav">
        <RightSidebar />
      </div>

      <SupportChat open={supportOpen} onClose={closeAll} />
      <SearchModal open={searchOpen} onOpenChange={(v) => v ? setSearchOpen(true) : closeAll()} />
      <NotificationsPanel
        open={notificationsOpen}
        onClose={closeAll}
        onMarkAllRead={() => setUnreadCount(0)}
      />
      
      <SettingsPanel open={settingsOpen} onClose={closeAll} />
      
      <HelpPanel open={helpOpen} onClose={closeAll} />

      <main className="min-h-screen bg-background" style={{ paddingLeft: 48 + 225 }} data-testid="main-crm">
        {children}
      </main>
    </div>
  );
}
