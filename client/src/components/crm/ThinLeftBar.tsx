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
        "group relative h-10 w-10 rounded-xl grid place-items-center transition-colors",
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
        "fixed left-0 top-0 bottom-0 w-[48px] border-r z-50 flex flex-col items-center py-3 transition-colors duration-300",
        isAgencyView 
          ? "bg-blue-600/10 border-blue-500/20" 
          : "bg-yellow-500/10 border-yellow-500/20"
      )}
      data-testid="bar-thin-left"
    >
      <button
        type="button"
        onClick={onGoHome}
        className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center duration-0",
          isAgencyView ? "bg-blue-600" : "bg-yellow-500"
        )}
        data-testid="button-leftbar-home"
        aria-label="Go to home"
      >
        <span className="text-[10px] font-bold text-white">LA</span>
      </button>

      <div className="mt-4 flex flex-col gap-2" data-testid="group-leftbar-actions">
        <IconButton label="Search" testId="button-global-search" onClick={onOpenSearch} active={false}>
          <Search className="h-5 w-5" />
        </IconButton>
        <div className="relative" data-testid="wrap-notifications">
          <IconButton label="Notifications" testId="button-notifications" onClick={onOpenNotifications} active={false}>
            <Bell className="h-5 w-5" />
          </IconButton>
          {count > 0 ? (
            <div
              className={cn(
            "h-5 min-w-5 px-1 rounded-full text-white text-[11px] font-bold grid place-items-center",
            isAgencyView ? "bg-blue-600" : "bg-yellow-500 text-black"
          )}
              data-testid="badge-notifications"
            >
              {count}
            </div>
          ) : null}
        </div>
        <IconButton label="Settings" testId="button-settings" onClick={onOpenEdgeSettings} active={location.includes('/settings')}>
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
        <IconButton label="Help" testId="button-help" onClick={onToggleHelp} active={false}>
          <HelpCircle className="h-5 w-5" />
        </IconButton>
      </div>

      <div className="mt-auto pb-2" data-testid="group-leftbar-support">
        <IconButton label="Customer Support" onClick={onOpenSupport} testId="button-support" active={false}>
          <Headphones className="h-5 w-5" />
        </IconButton>
      </div>
    </aside>
  );
}
