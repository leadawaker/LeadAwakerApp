import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Search,
  Bell,
  Settings,
  Moon,
  HelpCircle,
  Headphones,
  LayoutDashboard,
  MessageSquare,
  Megaphone,
  Building2,
  Calendar,
  ScrollText,
  Users,
  Tag,
  BookOpen,
  PanelRightClose,
  PanelRightOpen,
  BookUser,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";

function IconButton({
  label,
  onClick,
  children,
  active,
  testId,
  isAgencyView,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  active?: boolean;
  testId: string;
  isAgencyView: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative h-8 w-8 rounded-lg grid place-items-center transition-colors",
        active ? "bg-black/10 text-black" : "text-black/60 hover:bg-black/5",
        !isAgencyView && !active && "text-white/60 hover:text-white hover:bg-white/10"
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

const accountsList = [
  { id: 1, label: "LeadAwaker Agency" },
  { id: 2, label: "FitnessGym ABC" },
  { id: 3, label: "LawFirm XYZ" },
];

export function RightSidebar({ 
  collapsed, 
  onCollapse,
  onOpenSupport,
  onOpenSearch,
  onOpenNotifications,
  onOpenEdgeSettings,
  onToggleHelp,
  notificationsCount,
  onGoHome,
}: { 
  collapsed: boolean; 
  onCollapse: (v: boolean) => void;
  onOpenSupport: () => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenEdgeSettings: () => void;
  onToggleHelp: () => void;
  onGoHome: () => void;
  notificationsCount?: number;
}) {
  const [location, setLocation] = useLocation();
  const { currentAccountId, setCurrentAccountId, currentAccount, isAgencyView } = useWorkspace();
  const [openSwitcher, setOpenSwitcher] = useState(false);
  const [dark, setDark] = useState(false);
  const count = notificationsCount ?? 0;

  const prefix = isAgencyView ? "/agency" : "/subaccount";
  const navItems = [
    { href: `${prefix}/dashboard`, label: "Dashboard", icon: LayoutDashboard, testId: "nav-dashboard" },
    { href: `${prefix}/contacts`, label: "Contacts", icon: BookUser, testId: "nav-contacts" },
    { href: `${prefix}/conversations`, label: "Conversations", icon: MessageSquare, testId: "nav-conversations" },
    { href: `${prefix}/campaigns`, label: "Campaigns", icon: Megaphone, testId: "nav-campaigns" },
    { href: `${prefix}/calendar`, label: "Calendar", icon: Calendar, testId: "nav-calendar" },
    { href: `${prefix}/accounts`, label: "Accounts", icon: Building2, testId: "nav-accounts", agencyOnly: true },
    { href: `${prefix}/automation-logs`, label: "Automation Logs", icon: ScrollText, testId: "nav-automation-logs" },
    { href: `${prefix}/users`, label: "Users", icon: Users, testId: "nav-users" },
    { href: `${prefix}/tags`, label: "Tags", icon: Tag, testId: "nav-tags" },
    { href: `${prefix}/prompt-library`, label: "Prompt Library", icon: BookOpen, testId: "nav-prompt-library" },
    { href: `${prefix}/settings`, label: "Settings", icon: Settings, testId: "nav-settings" },
  ];

  const handleAccountSelect = (id: number) => {
    const prevIsAgency = currentAccountId === 1;
    const prevBase = prevIsAgency ? "/agency" : "/subaccount";

    setCurrentAccountId(id);
    setOpenSwitcher(false);

    const nextIsAgency = id === 1;
    const nextBase = nextIsAgency ? "/agency" : "/subaccount";

    // Keep the same page path, but swap the base (agency/subaccount).
    // Example: /agency/conversations -> /subaccount/conversations
    const tail = location.startsWith(prevBase)
      ? location.slice(prevBase.length)
      : location.replace(/^\/(agency|subaccount)/, "");

    const nextPath = `${nextBase}${tail || "/dashboard"}`;
    setLocation(nextPath);
  };

  return (
    <>
      <aside
        className={cn(
          "fixed left-0 top-0 right-0 h-[32px] border-b z-[100] flex items-center px-3 transition-none",
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
            <img src="/6. Favicon.svg" className="h-5 w-5 object-contain" alt="Logo" />
            <span className={cn(
              "text-xs font-bold tracking-tight",
              isAgencyView ? "text-black" : "text-white"
            )}>Lead Awaker</span>
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1" data-testid="group-leftbar-actions">
          <IconButton label="Search" testId="button-global-search" onClick={onOpenSearch} active={false} isAgencyView={isAgencyView}>
            <Search className={cn("h-4 w-4", isAgencyView ? "text-black" : "text-white")} />
          </IconButton>
          <div className="relative" data-testid="wrap-notifications">
            <IconButton label="Notifications" testId="button-notifications" onClick={onOpenNotifications} active={false} isAgencyView={isAgencyView}>
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
          <IconButton label="Settings" testId="button-settings" onClick={onOpenEdgeSettings} active={false} isAgencyView={isAgencyView}>
            <Settings className={cn("h-4 w-4", isAgencyView ? "text-black" : "text-white")} />
          </IconButton>
          <IconButton label="Help" testId="button-help" onClick={onToggleHelp} active={false} isAgencyView={isAgencyView}>
            <HelpCircle className={cn("h-4 w-4", isAgencyView ? "text-black" : "text-white")} />
          </IconButton>
          <IconButton label="Customer Support" onClick={onOpenSupport} testId="button-support" active={false} isAgencyView={isAgencyView}>
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
            isAgencyView={isAgencyView}
          >
            <Moon className={cn("h-4 w-4", isAgencyView ? "text-black" : "text-white")} />
          </IconButton>
        </div>
      </aside>

      <aside
        className={cn(
          "fixed left-0 top-[32px] bottom-0 border-r border-border bg-muted/20 z-40 transition-none dark:bg-muted/10",
          collapsed ? "w-[64px]" : "w-[225px]",
        )}
        data-testid="sidebar-left"
      >
        <div className="h-full flex flex-col">
          <div className={cn("h-auto py-3 border-b border-border flex items-center gap-2 px-3 relative")}> 
            <button
              type="button"
              onClick={() => setOpenSwitcher((v) => !v)}
              className={cn(
                "min-w-0 flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 transition-all",
                collapsed ? "h-[56px] w-full justify-center px-2" : "h-[56px] flex-1 px-3 hover:bg-muted/30",
                isAgencyView ? "text-yellow-600 font-bold" : "text-blue-600 font-bold"
              )}
              data-testid="wrap-workspace"
              aria-label="Switch account"
            >
              {collapsed ? (
                <div
                  className={cn(
                    "h-11 w-full rounded-xl flex items-center justify-center text-xs font-bold shadow-sm",
                    isAgencyView
                      ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20"
                      : "bg-blue-600 text-white shadow-lg shadow-blue-500/20",
                  )}
                  title={currentAccount.name}
                >
                  {currentAccount.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
              ) : (
                <>
                  <div className="min-w-0 text-left">
                    <div className="text-sm font-semibold truncate flex items-center gap-1.5" data-testid="text-workspace-value">
                      <span className="truncate">{currentAccount.name}</span>
                      <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", openSwitcher && "rotate-180")} />
                    </div>
                  </div>
                </>
              )}
            </button>

            {openSwitcher && (
              <div
                className={cn(
                  "absolute top-full mt-1 bg-background border border-border rounded-xl shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-100",
                  collapsed ? "left-3 w-[260px]" : "left-3 right-3",
                )}
                data-testid="dropdown-switcher"
              >
                {accountsList.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => handleAccountSelect(acc.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center justify-between",
                      currentAccountId === acc.id && "text-blue-600 font-medium bg-blue-50/50",
                    )}
                    data-testid={`button-account-${acc.id}`}
                  >
                    <span className="truncate">{acc.label}</span>
                    {acc.id === 1 && (
                      <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ml-2">
                        Agency
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <nav className={cn("p-3 space-y-1", collapsed && "px-2")} data-testid="nav-right">
            {navItems.map((it) => {
              if (it.agencyOnly && !isAgencyView) return null;
              const active = location === it.href;
              const Icon = it.icon;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-transparent transition-colors",
                    collapsed ? "h-11 justify-center" : "px-3 py-2.5",
                    active
                      ? isAgencyView
                        ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20"
                        : "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
                  )}
                  data-testid={`link-${it.testId}`}
                  title={collapsed ? it.label : undefined}
                >
                  <Icon className="h-5 w-5" />
                  {!collapsed && <span className="text-sm font-semibold">{it.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className={cn("mt-auto p-3", collapsed && "px-2")} data-testid="section-sidebar-bottom">
            <button
              type="button"
              onClick={() => onCollapse(!collapsed)}
              className={cn(
                "w-full h-11 rounded-xl border border-border bg-background/70 hover:bg-muted/30 transition-colors flex items-center gap-3",
                collapsed ? "justify-center" : "px-3",
              )}
              data-testid="button-sidebar-collapse"
              aria-label="Toggle sidebar"
              title={collapsed ? "Toggle sidebar" : undefined}
            >
              {collapsed ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
              {!collapsed && <span className="text-sm font-semibold">Collapse menu</span>}
            </button>


            <div className={cn("mt-3 text-[11px] text-muted-foreground", collapsed && "hidden")} data-testid="text-sidebar-foot">
              MOCK CRM • NocoDB-ready
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
