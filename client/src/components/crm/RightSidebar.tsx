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
        "fixed left-0 top-[32px] bottom-0 border-r border-border bg-muted/20 z-40 duration-0 dark:bg-muted/10",
        collapsed ? "w-[64px]" : "w-[225px]",
      )}
      data-testid="sidebar-left"
    >
      <div className="h-full flex flex-col">
        <div className={cn("h-14 border-b border-border flex items-center gap-2 px-3 relative")}> 
          <button
            type="button"
            onClick={() => setOpenSwitcher((v) => !v)}
            className={cn(
              "flex-1 min-w-0 flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 transition-colors",
              collapsed ? "px-1 py-1 justify-center" : "px-3 py-2 hover:bg-muted/30",
            )}
            data-testid="wrap-workspace"
            aria-label="Switch account"
          >
            {collapsed ? (
              <div 
                className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow-sm"
                title={currentAccount.name}
              >
                {currentAccount.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
            ) : (
              <>
                <div className="min-w-0 text-left">
                  <div className="text-sm font-semibold truncate" data-testid="text-workspace-value">
                    {currentAccount.name}
                  </div>
                </div>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", openSwitcher && "rotate-180")} />
              </>
            )}
          </button>

          {openSwitcher && (
            <div 
              className="absolute top-full left-3 right-3 mt-1 bg-background border border-border rounded-xl shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-100"
              data-testid="dropdown-switcher"
            >
              {accountsList.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => handleAccountSelect(acc.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center justify-between",
                    currentAccountId === acc.id && "text-blue-600 font-medium bg-blue-50/50"
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


          <div className={cn("mt-3 text-[11px] text-muted-foreground", collapsed && "hidden")} data-testid="text-sidebar-foot">
            MOCK CRM • NocoDB-ready
          </div>
        </div>
      </div>
    </aside>
  );
}
