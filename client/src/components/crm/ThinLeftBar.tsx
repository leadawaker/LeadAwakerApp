import { useState } from "react";
import {
  Search,
  Bell,
  Settings,
  Moon,
  HelpCircle,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

function IconButton({
  label,
  onClick,
  children,
  active,
  testId,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  active?: boolean;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative h-11 w-11 rounded-xl grid place-items-center transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
      )}
      data-testid={testId}
    >
      {children}
      <div
        className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
        data-testid={`${testId}-tooltip`}
      >
        <div className="rounded-md border border-border bg-background px-2 py-1 text-xs shadow-sm whitespace-nowrap">
          {label}
        </div>
      </div>
    </button>
  );
}

export function ThinLeftBar({
  onOpenSupport,
}: {
  onOpenSupport: () => void;
}) {
  const [dark, setDark] = useState(false);

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 w-[60px] border-r border-border bg-background z-50 flex flex-col items-center py-3"
      data-testid="bar-thin-left"
    >
      <div className="h-11 w-11 rounded-xl grid place-items-center border border-border bg-muted/20 overflow-hidden" data-testid="logo-leftbar">
        <img src="/favicon.svg" alt="LeadAwaker" className="h-7 w-7" />
      </div>

      <div className="mt-4 flex flex-col gap-2" data-testid="group-leftbar-actions">
        <IconButton label="Search" testId="button-global-search">
          <Search className="h-5 w-5" />
        </IconButton>
        <IconButton label="Notifications" testId="button-notifications">
          <Bell className="h-5 w-5" />
        </IconButton>
        <IconButton label="Settings" testId="button-settings">
          <Settings className="h-5 w-5" />
        </IconButton>
        <IconButton
          label="Night mode"
          onClick={() => {
            setDark((v) => !v);
            document.documentElement.classList.toggle("dark");
          }}
          testId="button-nightmode"
          active={dark}
        >
          <Moon className="h-5 w-5" />
        </IconButton>
        <IconButton label="Help" testId="button-help">
          <HelpCircle className="h-5 w-5" />
        </IconButton>
      </div>

      <div className="mt-auto pb-2" data-testid="group-leftbar-support">
        <IconButton label="LeadAwaker Support" onClick={onOpenSupport} testId="button-support">
          <MessageSquare className="h-5 w-5" />
        </IconButton>
      </div>
    </aside>
  );
}
