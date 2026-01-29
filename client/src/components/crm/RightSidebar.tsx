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
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";

const navItems = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, testId: "nav-dashboard" },
  { href: "/app/leads", label: "Leads", icon: Users, testId: "nav-leads" },
  { href: "/app/conversations", label: "Conversations", icon: MessageSquare, testId: "nav-conversations" },
  { href: "/app/campaigns", label: "Campaigns", icon: Megaphone, testId: "nav-campaigns" },
  { href: "/app/accounts", label: "Accounts", icon: Building2, testId: "nav-accounts" },
  { href: "/app/calendar", label: "Calendar", icon: Calendar, testId: "nav-calendar" },
  { href: "/app/automation-logs", label: "Automation Logs", icon: ScrollText, testId: "nav-automation-logs" },
  { href: "/app/users", label: "Users", icon: Users, testId: "nav-users" },
  { href: "/app/tags", label: "Tags", icon: Tag, testId: "nav-tags" },
  { href: "/app/prompt-library", label: "Prompt Library", icon: BookOpen, testId: "nav-prompt-library" },
  { href: "/app/settings", label: "Settings", icon: Settings, testId: "nav-settings" },
];

export function RightSidebar() {
  const [location] = useLocation();
  const { currentAccountId, setCurrentAccountId, currentAccount, isAgencyView } = useWorkspace();
  const [collapsed, setCollapsed] = useState(false);
  const [openSwitcher, setOpenSwitcher] = useState(false);

  const accounts = useMemo(
    () => [
      { id: 1, label: "LeadAwaker Agency" },
      { id: 2, label: "FitnessGym ABC" },
      { id: 3, label: "LawFirm XYZ" },
    ],
    [],
  );

  return (
    <aside
      className={cn(
        "fixed right-0 top-0 bottom-0 border-l border-border bg-background z-40 transition-all",
        collapsed ? "w-[64px]" : "w-[300px]",
      )}
      data-testid="sidebar-right"
    >
      <div className="h-full flex flex-col">
        <div className={cn("h-14 border-b border-border flex items-center gap-2 px-3", collapsed && "justify-center")}>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setOpenSwitcher((v) => !v)}
              className="flex-1 min-w-0 flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2 hover:bg-muted/30"
              data-testid="button-workspace-switch"
              disabled={!isAgencyView}
              title={isAgencyView ? "Switch workspace" : "Workspace locked for clients"}
            >
              <div className="min-w-0 text-left">
                <div className="text-[11px] text-muted-foreground" data-testid="text-workspace-label">
                  Workspace
                </div>
                <div className="text-sm font-semibold truncate" data-testid="text-workspace-value">
                  {currentAccount.name}
                </div>
              </div>
              {isAgencyView && <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setCollapsed((v) => !v);
              setOpenSwitcher(false);
            }}
            className="h-10 w-10 rounded-xl hover:bg-muted/30 grid place-items-center"
            data-testid="button-sidebar-collapse"
          >
            {collapsed ? <PanelRightOpen className="h-5 w-5" /> : <PanelRightClose className="h-5 w-5" />}
          </button>
        </div>

        {!collapsed && openSwitcher && isAgencyView && (
          <div className="px-3 pt-3" data-testid="menu-workspace">
            <div className="rounded-2xl border border-border bg-background overflow-hidden">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setCurrentAccountId(a.id);
                    setOpenSwitcher(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-muted/30",
                    currentAccountId === a.id && "bg-primary/5",
                  )}
                  data-testid={`button-workspace-${a.id}`}
                >
                  <div className="font-semibold">{a.label}</div>
                  <div className="text-xs text-muted-foreground">account_id={a.id}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <nav className={cn("p-3 space-y-1", collapsed && "px-2")} data-testid="nav-right">
          {navItems.map((it) => {
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
                    ? "bg-primary text-primary-foreground"
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

        <div className="mt-auto p-3 text-[11px] text-muted-foreground" data-testid="text-sidebar-foot">
          MOCK CRM • NocoDB-ready
        </div>
      </div>
    </aside>
  );
}
