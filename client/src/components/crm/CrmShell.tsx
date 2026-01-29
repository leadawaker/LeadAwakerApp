import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ThinLeftBar } from "@/components/crm/ThinLeftBar";
import { RightSidebar } from "@/components/crm/RightSidebar";
import { SupportChat } from "@/components/crm/SupportChat";
import { SearchModal } from "@/components/crm/SearchModal";
import { NotificationsPanel } from "@/components/crm/NotificationsPanel";
import { HelpMenu } from "@/components/crm/HelpMenu";

export function CrmShell({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const [supportOpen, setSupportOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if (!helpOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHelpOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpOpen]);

  return (
    <div className="min-h-screen bg-background" data-testid="shell-crm">
      <ThinLeftBar
        onOpenSupport={() => setSupportOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenNotifications={() => setNotificationsOpen(true)}
        onOpenEdgeSettings={() => setLocation("/app/settings")}
        onToggleHelp={() => setHelpOpen((v) => !v)}
        onGoHome={() => setLocation("/")}
      />

      <div className="fixed left-[48px] top-0 bottom-0 z-40" data-testid="wrap-left-nav">
        <RightSidebar />
      </div>

      <SupportChat open={supportOpen} onClose={() => setSupportOpen(false)} />
      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
      <NotificationsPanel open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />

      {/* Help menu anchored near the help icon area */}
      <div className="fixed left-[48px] top-[220px] z-[90]" data-testid="anchor-help">
        <HelpMenu open={helpOpen} onOpenChange={setHelpOpen} />
      </div>

      <main className="min-h-screen" style={{ paddingLeft: 48 + 300 }} data-testid="main-crm">
        {children}
      </main>
    </div>
  );
}
