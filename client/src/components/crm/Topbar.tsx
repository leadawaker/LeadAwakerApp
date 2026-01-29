import { Link } from "wouter";
import { Bell, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Topbar() {
  return (
    <header
      className="sticky top-0 z-40 bg-background/70 backdrop-blur-xl border-b border-border"
      data-testid="header-crm-topbar"
    >
      <div className="h-14 px-4 md:px-6 flex items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center"
            data-testid="badge-account"
          >
            <span className="font-heading font-extrabold text-primary">LA</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight truncate" data-testid="text-account-name">
              LeadAwaker (Agency)
            </div>
            <div className="text-xs text-muted-foreground leading-tight" data-testid="text-account-sub">
              account_id=1 • isAgency=true
            </div>
          </div>
        </div>

        <div className="flex-1" />

        <div className="hidden md:flex items-center gap-2 max-w-[28rem] w-full">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full h-10 rounded-xl bg-muted/40 border border-border pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Search leads, phone, status…"
              data-testid="input-search"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" data-testid="button-notifications">
            <Bell className="h-4 w-4" />
          </Button>
          <Link href="/login">
            <Button variant="outline" className="h-10 rounded-xl" data-testid="button-logout">
              <User className="h-4 w-4" />
              Logout
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
