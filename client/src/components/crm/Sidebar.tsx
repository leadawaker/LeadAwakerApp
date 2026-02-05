import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Calendar, MessageSquare, LogOut, Target, ListTodo, Library } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { users } from "@/data/mocks";

export function Sidebar() {
  const [location] = useLocation();
  const { currentAccount, isAgencyView } = useWorkspace();
  const prefix = isAgencyView ? "/agency" : "/subaccount";

  // Check if current user is admin
  const currentUserEmail = localStorage.getItem("leadawaker_user_email") || "";
  const isAdmin = currentUserEmail === "leadawaker@gmail.com";

  const items = [
    { href: `${prefix}/dashboard`, label: "Dashboard", icon: LayoutDashboard, testId: "link-nav-dashboard" },
    { href: `${prefix}/leads`, label: "Contacts", icon: Users, testId: "link-nav-leads" },
    { href: `${prefix}/calendar`, label: "Calendar", icon: Calendar, testId: "link-nav-calendar" },
    { href: `${prefix}/conversations`, label: "Conversations", icon: MessageSquare, testId: "link-nav-conversations" },
    ...(isAdmin ? [
      { href: `${prefix}/automation-logs`, label: "Automations", icon: ListTodo, testId: "link-nav-automations" },
      { href: `${prefix}/prompt-library`, label: "Library", icon: Library, testId: "link-nav-library" }
    ] : []),
    { href: `${prefix}/users`, label: "Users", icon: Users, testId: "link-nav-users" }
  ];

  return (
    <aside
      className={cn(
        "hidden lg:flex shrink-0 border-r border-slate-200 duration-200 ease-in-out transition-all",
        isAgencyView ? "bg-yellow-500/10" : "bg-blue-600/10",
        "w-64 group-[[data-state=collapsed]]/sidebar-wrapper:w-[70px]"
      )}
      data-testid="sidebar-crm"
    >
      <div className="p-4 w-full flex flex-col gap-4">
        <div
          className={cn(
            "rounded-2xl border border-slate-200 p-4 duration-0 relative group",
            isAgencyView ? "bg-yellow-500/10" : "bg-blue-600/10",
          )}
        >
          <div className="text-xs text-muted-foreground" data-testid="text-workspace">
            Workspace
          </div>
          <div className="mt-1 text-sm font-semibold flex items-center justify-between group-[[data-state=collapsed]]/sidebar-wrapper:hidden" data-testid="text-workspace-name">
            {currentAccount.name}
          </div>
          <div className="mt-2 text-xs text-muted-foreground group-[[data-state=collapsed]]/sidebar-wrapper:hidden" data-testid="text-workspace-meta">
            {isAgencyView ? "Agency view" : "Client view"} • ID={currentAccount.id}
          </div>
        </div>

        <nav className="flex flex-col gap-1" data-testid="nav-crm">
          {items.map((it) => {
            const active = location === it.href;
            const Icon = it.icon;
            return (
              <div className="relative group/nav-item" key={it.href}>
                <Link
                  href={it.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all",
                    active
                      ? isAgencyView
                        ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20"
                        : "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                  )}
                  data-testid={it.testId}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", active && isAgencyView && "text-white")} />
                  <span className="truncate group-[[data-state=collapsed]]/sidebar-wrapper:hidden">{it.label}</span>
                </Link>
                <div className="absolute left-[calc(100%-8px)] top-1/2 -translate-y-1/2 px-2 py-1.5 bg-muted text-foreground text-xs rounded-r-md opacity-0 group-hover/nav-item:opacity-100 pointer-events-none transition-all z-50 whitespace-nowrap hidden group-[[data-state=collapsed]]/sidebar-wrapper:block font-bold border-y border-r border-slate-200 shadow-sm">
                  {it.label}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="mt-auto">
          <Link
            href="/login"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            data-testid="link-logout"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="group-[[data-state=collapsed]]/sidebar-wrapper:hidden">Logout</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
