import { Link, useLocation } from "wouter";
import { Bell, Search, Settings, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { campaigns, accounts } from "@/data/mocks";
import { useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar({ onOpenPanel }: { onOpenPanel: (panel: string) => void }) {
  const [location, setLocation] = useLocation();
  const { currentAccountId, currentAccount, setCurrentAccountId, isAgencyView } = useWorkspace();

  const campaignOptions = useMemo(() => {
    return campaigns.filter((c) => c.account_id === currentAccountId);
  }, [currentAccountId]);

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
        "fixed top-4 right-10 z-50 transition-colors duration-300",
      )}
      data-testid="header-crm-topbar"
    >
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className={cn(
                  "h-9 px-0 hover:bg-transparent text-base font-semibold flex items-center gap-2",
                  isAgencyView ? "text-yellow-600" : "text-blue-600"
                )}
                data-testid="button-account-selector"
              >
                {currentAccount.name}
                <ChevronDown className="h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-xl shadow-xl border-border bg-background">
              {accounts.map((acc) => (
                <DropdownMenuItem
                  key={acc.id}
                  onClick={() => handleAccountSelect(acc.id)}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer py-3",
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

          <select
            value={localStorage.getItem("leadawaker_selected_campaign") || "all"}
            onChange={(e) => {
              const v = e.target.value;
              localStorage.setItem("leadawaker_selected_campaign", v);
              // Trigger a storage event so other components can sync
              window.dispatchEvent(new Event("storage"));
            }}
            className="h-9 rounded-xl border-none bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            data-testid="select-campaign-topbar"
          >
            <option value="all">All campaigns</option>
            {campaignOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>


        <div className="flex items-center gap-4">
          <button 
            onClick={() => onOpenPanel('search')}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-search-top"
          >
            <Search className="h-[24px] w-[24px]" />
          </button>

          <button 
            onClick={() => onOpenPanel('notifications')}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-notifications"
          >
            <Bell className="h-[24px] w-[24px]" />
          </button>

          <button 
            onClick={() => onOpenPanel('settings')}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-settings-top"
          >
            <Settings className="h-[24px] w-[24px]" />
          </button>
        </div>
      </div>
    </header>
  );
}
