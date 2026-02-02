import { Link, useLocation } from "wouter";
import { Bell, Search, Settings, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { campaigns, accounts } from "@/data/mocks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar({ onOpenPanel }: { onOpenPanel: (panel: string) => void }) {
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
        "fixed top-4 right-6 z-50 transition-colors duration-300",
      )}
      data-testid="header-crm-topbar"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 bg-background/60 backdrop-blur-xl p-2 rounded-2xl border border-border/50 shadow-lg">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className={cn(
                  "h-10 px-4 rounded-xl border-border/50 bg-background/50 hover:bg-muted/50 text-sm font-bold flex items-center gap-2",
                  isAgencyView ? "text-yellow-600" : "text-blue-600"
                )}
                data-testid="button-account-selector"
              >
                {currentAccount.name}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-xl">
              {accounts.map((acc) => (
                <DropdownMenuItem
                  key={acc.id}
                  onClick={() => handleAccountSelect(acc.id)}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer",
                    currentAccountId === acc.id && "bg-muted font-bold"
                  )}
                >
                  <div
                    className={cn(
                      "h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold",
                      acc.id === 1 ? "bg-yellow-500 text-black" : "bg-blue-600 text-white",
                    )}
                  >
                    {acc.name[0]}
                  </div>
                  {acc.name}
                  {acc.id === 1 && <span className="ml-auto text-[10px] bg-yellow-100 text-yellow-900 px-1 rounded uppercase font-bold tracking-tighter">Agency</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className="h-10 px-4 rounded-xl border-border/50 bg-background/50 hover:bg-muted/50 text-sm font-semibold flex items-center gap-2"
                data-testid="button-campaign-selector"
              >
                All campaigns
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl">
              <DropdownMenuItem className="font-semibold">All campaigns</DropdownMenuItem>
              {campaigns.map(c => (
                <DropdownMenuItem key={c.id}>{c.name}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-6 w-[1px] bg-border/50 mx-1" />

          <button 
            onClick={() => onOpenPanel('search')}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-search-top"
          >
            <Search className="h-5 w-5" />
          </button>

          <button 
            onClick={() => onOpenPanel('notifications')}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-notifications"
          >
            <Bell className="h-5 w-5" />
          </button>

          <button 
            onClick={() => onOpenPanel('settings')}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-settings-top"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
