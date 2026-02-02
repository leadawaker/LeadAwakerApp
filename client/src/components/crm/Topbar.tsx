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
        "sticky top-0 z-40 backdrop-blur-xl transition-colors duration-300",
        isAgencyView ? "bg-transparent" : "bg-transparent",
      )}
      data-testid="header-crm-topbar"
    >
      <div className="h-14 px-4 md:px-6 flex items-center gap-3">
        <div className="flex-1" />

        <div className="flex items-center gap-3">
          <Link href="/subaccount/campaigns">
            <Button 
              variant="default" 
              className="h-10 px-6 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-black font-bold shadow-sm"
              data-testid="button-campaigns"
            >
              Campaigns
            </Button>
          </Link>

          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-muted/50" data-testid="button-search-top">
            <Search className="h-5 w-5" />
          </Button>

          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-muted/50" data-testid="button-notifications">
            <Bell className="h-5 w-5" />
          </Button>

          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-muted/50" data-testid="button-settings-top">
            <Settings className="h-5 w-5" />
          </Button>
          
          <Link href="/login">
            <Button variant="outline" className="h-10 rounded-xl border-border/50" data-testid="button-logout">
              <User className="h-4 w-4" />
              Logout
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
