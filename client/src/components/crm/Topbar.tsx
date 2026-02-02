import { Link, useLocation } from "wouter";
import { Bell, Search, User, ChevronDown, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/useWorkspace";
import { accounts } from "@/data/mocks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function Topbar() {
  const [location, setLocation] = useLocation();
  const { currentAccountId, currentAccount, setCurrentAccountId, isAgencyView } = useWorkspace();

  const handleAccountSelect = (id: number) => {
    const prevIsAgency = currentAccountId === 1;
    const prevBase = prevIsAgency ? "/agency" : "/subaccount";

    setCurrentAccountId(id);

    const nextIsAgency = id === 1;
    const nextBase = nextIsAgency ? "/agency" : "/subaccount";

    const tail = location.startsWith(prevBase)
      ? location.slice(prevBase.length)
      : location.replace(/^\/(agency|subaccount)/, "");

    const nextPath = `${nextBase}${tail || "/dashboard"}`;
    setLocation(nextPath);
  };

  return (
    <header
      className={cn(
        "fixed top-3 right-6 z-50 backdrop-blur-xl transition-colors duration-300",
        isAgencyView ? "bg-transparent" : "bg-transparent",
      )}
      data-testid="header-crm-topbar"
    >
      <div className="h-14 flex items-center gap-3">
        <div className="flex items-center gap-2 bg-background/60 backdrop-blur-md p-1.5 rounded-2xl border border-border/50 shadow-sm">
          <Link href="/subaccount/campaigns">
            <Button 
              variant="default" 
              className="h-9 px-4 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-black font-bold shadow-sm text-sm"
              data-testid="button-campaigns"
            >
              Campaigns
            </Button>
          </Link>

          <div className="h-4 w-[1px] bg-border/50 mx-1" />

          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted/50" data-testid="button-search-top">
            <Search className="h-4.5 w-4.5" />
          </Button>

          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted/50" data-testid="button-notifications">
            <Bell className="h-4.5 w-4.5" />
          </Button>

          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted/50" data-testid="button-settings-top">
            <Settings className="h-4.5 w-4.5" />
          </Button>
          
          <Link href="/login">
            <Button variant="outline" className="h-9 px-3 rounded-xl border-border/50 hover:bg-muted/50 text-xs font-semibold" data-testid="button-logout">
              <User className="h-3.5 w-3.5 mr-1" />
              Logout
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
