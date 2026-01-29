import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Megaphone, Building2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, testId: "link-nav-dashboard" },
  { href: "/app/leads", label: "Leads", icon: Users, testId: "link-nav-leads" },
  { href: "/app/campaigns", label: "Campaigns", icon: Megaphone, testId: "link-nav-campaigns" },
  { href: "/app/accounts", label: "Accounts", icon: Building2, testId: "link-nav-accounts" },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <aside
      className="hidden lg:flex w-64 shrink-0 border-r border-border bg-muted/10"
      data-testid="sidebar-crm"
    >
      <div className="p-4 w-full flex flex-col gap-4">
        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="text-xs text-muted-foreground" data-testid="text-workspace">
            Workspace
          </div>
          <div className="mt-1 text-sm font-semibold" data-testid="text-workspace-name">
            LeadAwaker
          </div>
          <div className="mt-2 text-xs text-muted-foreground" data-testid="text-workspace-meta">
            Agency view • account_id=1
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
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                )}
                data-testid={it.testId}
              >
                <Icon className="h-4 w-4" />
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
