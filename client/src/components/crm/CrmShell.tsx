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
    <div className="flex flex-col min-h-screen">
      <header className="h-16 border-b border-border bg-background flex items-center px-4 shrink-0 relative z-50">
        <RightSidebar />
      </header>
      <main className="flex-1 min-h-0 bg-background" data-testid="main-crm">
        {children}
      </main>
    </div>
  );
}
