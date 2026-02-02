import { Link, useLocation } from "wouter";
import { Bell, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { campaigns } from "@/data/mocks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar({ onOpenPanel }: { onOpenPanel: (panel: string) => void }) {
  const [location] = useLocation();
  const { isAgencyView } = useWorkspace();

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
                className="h-10 px-4 rounded-xl border-border/50 bg-background/50 hover:bg-muted/50 text-sm font-semibold flex items-center gap-2"
                data-testid="button-campaign-selector"
              >
                All campaigns
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
