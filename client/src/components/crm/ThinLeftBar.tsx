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
        active ? "bg-black/10 text-black" : "text-black/60 hover:bg-black/5 hover:text-black",
      )}
      data-testid={testId}
    >
      {children}
      <div
        className="pointer-events-none absolute top-full mt-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-[110]"
        data-testid={`${testId}-tooltip`}
      >
        <div className="rounded-md border border-border bg-popover text-popover-foreground px-2 py-0.5 text-[10px] shadow-md whitespace-nowrap">
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
        "fixed left-0 top-0 right-0 h-[32px] border-b z-[100] flex items-center px-3 duration-0 transition-all",
        isAgencyView
          ? "bg-yellow-500 border-yellow-600 shadow-[0_1px_12px_rgba(234,179,8,0.4)]"
          : "bg-blue-600 border-blue-700 shadow-[0_1px_12px_rgba(37,99,235,0.4)]"
      )}
      data-testid="bar-thin-left"
    >
      <div className="flex items-center gap-2">
        <button
          onClick={onGoHome}
          className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-black/10 transition-colors group"
          data-testid="button-home-logo"
        >
          <img src="/6.Favicon.svg" className="h-5 w-5 object-contain" alt="Logo" />
          <span className={cn(
            "text-xs font-bold tracking-tight",
            isAgencyView ? "text-black" : "text-white"
          )}>Lead Awaker</span>
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1" data-testid="group-leftbar-actions">
        <IconButton label="Search" testId="button-global-search" onClick={onOpenSearch} active={false}>
          <Search className={cn("h-4 w-4", isAgencyView ? "text-black" : "text-white")} />
        </IconButton>
        <div className="relative" data-testid="wrap-notifications">
          <IconButton label="Notifications" testId="button-notifications" onClick={onOpenNotifications} active={false}>
            <Bell className={cn("h-4 w-4", isAgencyView ? "text-black" : "text-white")} />
          </IconButton>
          {count > 0 ? (
            <div
              className={cn(
                "absolute top-0 right-0 h-4 w-4 rounded-full text-white text-[9px] font-bold grid place-items-center",
                "bg-red-500 border border-black/10"
              )}
              data-testid="badge-notifications"
            >
              {count}
            </div>
          ) : null}
        </div>
        <IconButton label="Settings" testId="button-settings" onClick={onOpenEdgeSettings} active={false}>
          <Settings className={cn("h-4 w-4", isAgencyView ? "text-black" : "text-white")} />
        </IconButton>
        <IconButton label="Help" testId="button-help" onClick={onToggleHelp} active={false}>
          <HelpCircle className={cn("h-4 w-4", isAgencyView ? "text-black" : "text-white")} />
        </IconButton>
        <IconButton label="Customer Support" onClick={onOpenSupport} testId="button-support" active={false}>
          <Headphones className={cn("h-4 w-4", isAgencyView ? "text-black" : "text-white")} />
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
          <Moon className={cn("h-4 w-4", isAgencyView ? "text-black" : "text-white")} />
        </IconButton>
      </div>
    </aside>
  );
}
