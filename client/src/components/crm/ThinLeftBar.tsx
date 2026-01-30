import { useState } from "react";
import { useLocation } from "wouter";
import {
  Search,
  Bell,
  Settings,
  Moon,
  HelpCircle,
  Headphones,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";

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
        "group relative h-8 w-8 rounded-lg grid place-items-center transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
      )}
      data-testid={testId}
    >
      {children}
      <div
        className="pointer-events-none absolute top-full mt-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-[100]"
        data-testid={`${testId}-tooltip`}
      >
        <div className="rounded-md border border-border bg-background px-2 py-0.5 text-[10px] shadow-md whitespace-nowrap">
          {label}
        </div>
      </div>
    </button>
  );
}

export function ThinLeftBar({
  onOpenSupport,
  onOpenSearch,
  onOpenNotifications,
  onOpenEdgeSettings,
  onToggleHelp,
  onGoHome,
  notificationsCount,
}: {
  onOpenSupport: () => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenEdgeSettings: () => void;
  onToggleHelp: () => void;
  onGoHome: () => void;
  notificationsCount?: number;
}) {
  const [location] = useLocation();
  const [dark, setDark] = useState(false);
  const count = notificationsCount ?? 0;
  const { isAgencyView } = useWorkspace();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 right-0 h-[32px] border-b z-50 flex items-center px-3 duration-0",
        isAgencyView
          ? "bg-yellow-500/20 border-yellow-500/30 shadow-[0_2px_12px_-2px_rgba(234,179,8,0.1)]"
          : "bg-blue-600/20 border-blue-500/30 shadow-[0_2px_12px_-2px_rgba(37,99,235,0.1)]"
      )}
      data-testid="bar-thin-left"
    >
      <div className="ml-auto flex items-center gap-1" data-testid="group-leftbar-actions">
        <IconButton label="Search" testId="button-global-search" onClick={onOpenSearch} active={false}>
          <Search className="h-4 w-4" />
        </IconButton>
        <div className="relative" data-testid="wrap-notifications">
          <IconButton label="Notifications" testId="button-notifications" onClick={onOpenNotifications} active={false}>
            <Bell className="h-4 w-4" />
          </IconButton>
          {count > 0 ? (
            <div
              className={cn(
                "absolute top-0 right-0 h-4 w-4 rounded-full text-white text-[9px] font-bold grid place-items-center",
                isAgencyView ? "bg-yellow-500 text-black" : "bg-blue-600"
              )}
              data-testid="badge-notifications"
            >
              {count}
            </div>
          ) : null}
        </div>
        <IconButton label="Settings" testId="button-settings" onClick={onOpenEdgeSettings} active={false}>
          <Settings className="h-4 w-4" />
        </IconButton>
        <IconButton label="Help" testId="button-help" onClick={onToggleHelp} active={false}>
          <HelpCircle className="h-4 w-4" />
        </IconButton>
        <IconButton label="Customer Support" onClick={onOpenSupport} testId="button-support" active={false}>
          <Headphones className="h-4 w-4" />
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
          <Moon className="h-4 w-4" />
        </IconButton>
      </div>
    </aside>
  );
}
