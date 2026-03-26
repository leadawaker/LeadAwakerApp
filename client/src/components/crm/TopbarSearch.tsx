import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export interface SearchLeadResult {
  id: number;
  displayName: string;
  subtitle: string;
}

export interface SearchCampaignResult {
  id: number;
  name: string;
  status: string;
}

export interface SearchProspectResult {
  id: number;
  company: string;
  contact: string;
  status: string;
}

export interface SearchAccountResult {
  id: number;
  name: string;
  type: "account";
}

export interface SearchUserResult {
  id: number;
  name: string;
  role: string;
  type: "user";
}

export interface TopbarSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchQ: string;
  onSearchQChange: (q: string) => void;
  searchResults: SearchLeadResult[];
  campaignResults: SearchCampaignResult[];
  prospectResults: SearchProspectResult[];
  accountResults: SearchAccountResult[];
  userResults: SearchUserResult[];
  onLeadClick: (id: number) => void;
  onCampaignClick: (id: number) => void;
  onProspectClick: (id: number) => void;
  onAccountClick: () => void;
  onUserClick: () => void;
}

export function TopbarSearch({
  open,
  onOpenChange,
  searchQ,
  onSearchQChange,
  searchResults,
  campaignResults,
  prospectResults,
  accountResults,
  userResults,
  onLeadClick,
  onCampaignClick,
  onProspectClick,
  onAccountClick,
  onUserClick,
}: TopbarSearchProps) {
  const { t } = useTranslation("crm");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const hasResults =
    searchResults.length > 0 ||
    campaignResults.length > 0 ||
    prospectResults.length > 0 ||
    accountResults.length > 0 ||
    userResults.length > 0;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <IconBtn
              className="hidden sm:flex"
              data-testid="button-search-top"
              data-onboarding="topbar-search"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </IconBtn>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent className="bg-popover text-popover-foreground border border-border/40 shadow-sm rounded-lg text-xs font-medium">
          {t("topbar.search")}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 rounded-2xl shadow-xl border-border/60 bg-popover overflow-hidden"
      >
        <div className="p-3 border-b border-border/20">
          <input
            ref={searchInputRef}
            autoFocus
            value={searchQ}
            onChange={(e) => onSearchQChange(e.target.value)}
            placeholder={t("topbar.searchPlaceholder")}
            className="h-9 w-full rounded-xl bg-muted/40 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            data-testid="input-search"
          />
        </div>
        {!searchQ.trim() ? (
          <div className="px-4 py-3 text-xs text-muted-foreground">{t("topbar.startTyping")}</div>
        ) : !hasResults ? (
          <div className="px-4 py-3 text-sm text-muted-foreground">{t("topbar.noResults")}</div>
        ) : (
          <div className="max-h-64 overflow-y-auto divide-y divide-border/10" data-testid="list-search-results">
            {/* Leads section */}
            {searchResults.length > 0 && (
              <div>
                <div className="px-4 pt-2 pb-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("search.leads")}</div>
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onLeadClick(r.id)}
                    className="w-full text-left px-4 py-2.5 hover:bg-muted/40 flex items-baseline gap-2"
                    data-testid={`search-result-lead-${r.id}`}
                  >
                    <span className="text-sm font-medium text-foreground truncate">{r.displayName}</span>
                    {r.subtitle && (
                      <span className="text-[11px] text-muted-foreground shrink-0">{r.subtitle}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {/* Campaigns section */}
            {campaignResults.length > 0 && (
              <div>
                <div className="px-4 pt-2 pb-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("search.campaigns") || "Campaigns"}</div>
                {campaignResults.map((c) => (
                  <button
                    key={`camp-${c.id}`}
                    onClick={() => onCampaignClick(c.id)}
                    className="w-full text-left px-4 py-2.5 hover:bg-muted/40 flex items-baseline gap-2"
                  >
                    <span className="text-sm font-medium text-foreground truncate">{c.name}</span>
                    {c.status && <span className="text-[11px] text-muted-foreground shrink-0">{c.status}</span>}
                  </button>
                ))}
              </div>
            )}
            {/* Prospects section (agency only) */}
            {prospectResults.length > 0 && (
              <div>
                <div className="px-4 pt-2 pb-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("search.prospects") || "Prospects"}</div>
                {prospectResults.map((p) => (
                  <button
                    key={`prosp-${p.id}`}
                    onClick={() => onProspectClick(p.id)}
                    className="w-full text-left px-4 py-2.5 hover:bg-muted/40 flex items-baseline gap-2"
                  >
                    <span className="text-sm font-medium text-foreground truncate">{p.company}</span>
                    {p.contact && <span className="text-[11px] text-muted-foreground shrink-0">{p.contact}</span>}
                  </button>
                ))}
              </div>
            )}
            {/* Accounts section */}
            {accountResults.length > 0 && (
              <div>
                <div className="px-4 pt-2 pb-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("search.accounts")}</div>
                {accountResults.map((a) => (
                  <button key={`acc-${a.id}`} onClick={onAccountClick} className="w-full text-left px-4 py-2.5 hover:bg-muted/40 flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">{a.name}</span>
                  </button>
                ))}
              </div>
            )}
            {/* Users section */}
            {userResults.length > 0 && (
              <div>
                <div className="px-4 pt-2 pb-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("search.users")}</div>
                {userResults.map((u) => (
                  <button key={`usr-${u.id}`} onClick={onUserClick} className="w-full text-left px-4 py-2.5 hover:bg-muted/40 flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">{u.name}</span>
                    {u.role && <span className="text-xs text-muted-foreground">{u.role}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
