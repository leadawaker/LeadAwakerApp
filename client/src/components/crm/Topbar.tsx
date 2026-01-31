import { Link, useLocation } from "wouter";
import { Bell, Search, User, ChevronDown } from "lucide-react";
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
        "sticky top-0 z-40 backdrop-blur-xl border-b transition-colors duration-300",
        isAgencyView ? "bg-yellow-500/10 border-yellow-500/20" : "bg-blue-600/10 border-blue-500/20",
      )}
      data-testid="header-crm-topbar"
    >
      <div className="h-14 px-4 md:px-6 flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-3 px-2 h-10 hover:bg-muted/50 rounded-xl transition-all" data-testid="button-account-selector">
              <div
                className={cn(
                  "h-9 w-9 rounded-xl border flex items-center justify-center transition-colors",
                  isAgencyView ? "bg-yellow-500 text-black border-yellow-400" : "bg-blue-600 text-white border-blue-400",
                )}
              >
                <span className="font-heading font-extrabold text-xs">
                  {currentAccount.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 text-left hidden sm:block">
                <div className="text-sm font-semibold leading-tight truncate">
                  {currentAccount.name}
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight flex items-center gap-1">
                  ID: {currentAccount.id} • {currentAccount.type}
                  <ChevronDown className="h-3 w-3" />
                </div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 rounded-xl">
            <DropdownMenuLabel>Switch Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {accounts.map((acc) => (
              <DropdownMenuItem
                key={acc.id}
                onClick={() => handleAccountSelect(acc.id)}
                className={cn(
                  "flex items-center gap-2 cursor-pointer",
                  currentAccount.id === acc.id && "bg-muted font-bold"
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
                {acc.id === 1 && <span className="ml-auto text-[10px] bg-yellow-100 text-yellow-900 px-1 rounded">Agency</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

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
