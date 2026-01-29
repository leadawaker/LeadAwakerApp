import { useState } from "react";
import { ThinLeftBar } from "@/components/crm/ThinLeftBar";
import { RightSidebar } from "@/components/crm/RightSidebar";
import { SupportChat } from "@/components/crm/SupportChat";

export function CrmShell({ children }: { children: React.ReactNode }) {
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background" data-testid="shell-crm">
      <ThinLeftBar onOpenSupport={() => setSupportOpen(true)} />
      <RightSidebar />
      <SupportChat open={supportOpen} onClose={() => setSupportOpen(false)} />

      <main
        className="min-h-screen"
        style={{ paddingLeft: 60, paddingRight: 300 }}
        data-testid="main-crm"
      >
        {children}
      </main>
    </div>
  );
}
