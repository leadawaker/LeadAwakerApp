import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Megaphone,
  Building2,
  Calendar,
  ScrollText,
  Tag,
  BookOpen,
  Settings,
  ChevronDown,
  PanelRightClose,
  PanelRightOpen,
  BookUser,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";

const navItems = []; // Moved inside component for dynamic prefixing

const accountsList = [
  { id: 1, label: "LeadAwaker Agency" },
  { id: 2, label: "FitnessGym ABC" },
  { id: 3, label: "LawFirm XYZ" },
];

export function RightSidebar() {
  const [location, setLocation] = useLocation();
  const { currentAccountId, setCurrentAccountId, currentAccount, isAgencyView } = useWorkspace();
  const [collapsed, setCollapsed] = useState(false);
  const [openSwitcher, setOpenSwitcher] = useState(false);

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
    setCurrentAccountId(id);
    setOpenSwitcher(false);
    
    // Switch between agency and subaccount while preserving page
    const isTargetAgency = id === 1;
    const currentPath = location.split('/').slice(2).join('/'); // get everything after /agency or /subaccount
    const newBase = isTargetAgency ? "/agency" : "/subaccount";
    setLocation(`${newBase}/${currentPath || 'dashboard'}`);
  };

  return (
    <aside
      className={cn(
        "fixed left-[48px] top-0 bottom-0 border-r border-border bg-muted/20 z-40 duration-0 dark:bg-muted/10",
        collapsed ? "w-[64px]" : "w-[225px]",
      )}
      data-testid="sidebar-left"
    >
      <div className="h-full flex flex-col">
        <div className={cn("h-14 border-b border-border flex items-center gap-2 px-3")}> 
          <button
            type="button"
            onClick={() => setOpenSwitcher((v) => !v)}
            className={cn(
              "flex-1 min-w-0 flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2 hover:bg-muted/30 transition-colors",
              collapsed && "hidden",
            )}
            data-testid="wrap-workspace"
            aria-label="Switch account"
          >
            <div className="min-w-0 text-left">
              <div className="text-sm font-semibold truncate" data-testid="text-workspace-value">
                {currentAccount.name}
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
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
            onClick={() => setCollapsed((v) => !v)}
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

          {!collapsed && (
            <div className="mt-3" data-testid="wrap-workspace-bottom">
              <button
                type="button"
                onClick={() => setOpenSwitcher((v) => !v)}
                className="w-full h-11 rounded-xl border border-border bg-background/70 hover:bg-muted/30 transition-colors flex items-center gap-3 px-3"
                data-testid="button-workspace-open-bottom"
                aria-label="Switch account"
              >
                <div className="h-8 w-8 rounded-lg border border-border bg-muted/20 grid place-items-center">
                  <span className="text-[10px] font-extrabold">
                    {currentAccount.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .substring(0, 2)
                      .toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="text-sm font-semibold truncate" data-testid="text-workspace-bottom-value">
                    {currentAccount.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground">Switch account</div>
                </div>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", openSwitcher && "rotate-180")} />
              </button>

              {openSwitcher && (
                <div className="mt-2 rounded-2xl border border-border bg-background overflow-hidden" data-testid="menu-workspace">
                  {accountsList.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => handleAccountSelect(a.id)}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm hover:bg-muted/30",
                        currentAccountId === a.id && (isAgencyView ? "bg-yellow-500/15" : "bg-blue-600/10"),
                      )}
                      data-testid={`button-workspace-${a.id}`}
                    >
                      <div className="font-semibold">{a.label}</div>
                      <div className="text-xs text-muted-foreground">account_id={a.id}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={cn("mt-3 text-[11px] text-muted-foreground", collapsed && "hidden")} data-testid="text-sidebar-foot">
            MOCK CRM • NocoDB-ready
          </div>
        </div>
      </div>
    </aside>
  );
}
