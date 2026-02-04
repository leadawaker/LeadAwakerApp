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

export function Topbar({ onOpenPanel, collapsed }: { onOpenPanel: (panel: string) => void; collapsed: boolean }) {
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

  const titles: Record<string, string> = {
    "/agency/dashboard": "Dashboard",
    "/subaccount/dashboard": "Dashboard",
    "/agency/leads": "Contacts",
    "/subaccount/leads": "Contacts",
    "/agency/contacts": "Contacts",
    "/subaccount/contacts": "Contacts",
    "/agency/conversations": "Conversations",
    "/subaccount/conversations": "Conversations",
    "/agency/campaigns": "Campaigns",
    "/subaccount/campaigns": "Campaigns",
    "/agency/automation-logs": "Activity",
    "/subaccount/automation-logs": "Activity",
    "/agency/calendar": "Calendar",
    "/subaccount/calendar": "Calendar",
    "/agency/users": "Users",
    "/subaccount/users": "Users",
    "/agency/tags": "Tags",
    "/subaccount/tags": "Tags",
    "/agency/prompt-library": "Library",
    "/subaccount/prompt-library": "Library",
    "/agency/accounts": "Accounts",
    "/subaccount/accounts": "Accounts",
  };

  const currentTitle = titles[location] || "";

  return (
    <header
      className={cn(
        "fixed top-4 right-0 h-16 bg-[#F6F5FA]/60 backdrop-blur-md z-50 flex items-center px-10 transition-all duration-200 [mask-image:linear-gradient(to_bottom,black_80%,transparent)]",
        collapsed ? "left-[80px]" : "left-[200px]"
      )}
      data-testid="header-crm-topbar"
    >
      <div className="flex-1 flex items-center justify-start">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{currentTitle}</h1>
      </div>

      <div className="absolute right-10 flex items-center gap-6">
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className={cn(
                  "h-9 px-3 w-48 justify-between hover:bg-white border border-border bg-white rounded-xl text-xs font-semibold flex items-center gap-2",
                  isAgencyView ? "text-yellow-600" : "text-blue-600"
                )}
                data-testid="button-account-selector"
              >
                <span className="truncate">{currentAccount.name}</span>
                <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-2xl shadow-xl border-border bg-background mt-2">
              {accounts.map((acc) => (
                <DropdownMenuItem
                  key={acc.id}
                  onClick={() => handleAccountSelect(acc.id)}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer py-3 rounded-xl m-1",
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
                variant="ghost" 
                className="h-9 px-3 w-[160px] justify-between hover:bg-white border border-border bg-white rounded-xl text-xs font-semibold flex items-center gap-2"
                data-testid="select-campaign-topbar-custom"
              >
                <span className="truncate">
                  {campaignOptions.find(c => c.id === Number(localStorage.getItem("leadawaker_selected_campaign")))?.name || "All campaigns"}
                </span>
                <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-2xl shadow-xl border-border bg-background mt-2">
              <DropdownMenuItem 
                onClick={() => {
                  localStorage.setItem("leadawaker_selected_campaign", "all");
                  window.dispatchEvent(new Event("storage"));
                }}
                className="py-3 rounded-xl m-1 cursor-pointer"
              >
                All campaigns
              </DropdownMenuItem>
              {campaignOptions.map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  onClick={() => {
                    localStorage.setItem("leadawaker_selected_campaign", String(c.id));
                    window.dispatchEvent(new Event("storage"));
                  }}
                  className="py-3 rounded-xl m-1 cursor-pointer"
                >
                  {c.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>


        <div className="flex items-center gap-2">
          <button 
            onClick={() => onOpenPanel('search')}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-full transition-all relative"
            data-testid="button-search-top"
          >
            <Search className="h-[20px] w-[20px]" />
          </button>

          <button 
            onClick={() => onOpenPanel('notifications')}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-full transition-all relative"
            data-testid="button-notifications"
          >
            <Bell className="h-[20px] w-[20px]" />
            <div className="absolute top-1 right-1 h-4 w-4 bg-blue-600 rounded-full flex items-center justify-center border-2 border-[#F6F5FA]">
              <span className="text-[8px] font-bold text-white">3</span>
            </div>
          </button>

          <button 
            onClick={() => onOpenPanel('settings')}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-full transition-all relative"
            data-testid="button-settings-top"
          >
            <Settings className="h-[20px] w-[20px]" />
          </button>
        </div>
      </div>
    </header>
  );
}
