import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Megaphone, Building2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";

const items = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, testId: "link-nav-dashboard" },
  { href: "/app/leads", label: "Leads", icon: Users, testId: "link-nav-leads" },
  { href: "/app/campaigns", label: "Campaigns", icon: Megaphone, testId: "link-nav-campaigns" },
  { href: "/app/accounts", label: "Accounts", icon: Building2, testId: "link-nav-accounts" },
];

export function Sidebar() {
  const [location] = useLocation();
  const { currentAccount, isAgencyView } = useWorkspace();

  return (
    <aside
      className={cn(
        "hidden lg:flex w-64 shrink-0 border-r transition-colors duration-300",
        isAgencyView ? "bg-blue-600/5 border-blue-500/10" : "bg-yellow-500/5 border-yellow-500/10"
      )}
      data-testid="sidebar-crm"
    >
      <div className="p-4 w-full flex flex-col gap-4">
        <div className={cn(
          "rounded-2xl border p-4 transition-all duration-300",
          isAgencyView 
            ? "border-blue-500/20 bg-blue-600/10" 
            : "border-yellow-500/20 bg-yellow-500/10"
        )}>
          <div className="text-xs text-muted-foreground" data-testid="text-workspace">
            Workspace
          </div>
          <div className="mt-1 text-sm font-semibold" data-testid="text-workspace-name">
            {currentAccount.name}
          </div>
          <div className="mt-2 text-xs text-muted-foreground" data-testid="text-workspace-meta">
            {isAgencyView ? "Agency view" : "Client view"} • ID={currentAccount.id}
          </div>
        </div>

        <nav className="flex flex-col gap-1" data-testid="nav-crm">
          {items.map((it) => {
            const active = location === it.href;
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all",
                  active
                    ? isAgencyView 
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                      : "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                )}
                data-testid={it.testId}
              >
                <Icon className={cn("h-4 w-4", active && isAgencyView && "text-white")} />
                {it.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto">
          <Link
            href="/login"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            data-testid="link-logout"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Link>
        </div>
      </div>
    </aside>
  );
}
