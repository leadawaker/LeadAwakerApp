import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiFetch } from "@/lib/apiUtils";
import {
  Megaphone,
  BookUser,
  MessageSquare,
  Calendar,
  BookOpen,
  Users,
  ScrollText,
  Building2,
  User,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  keywords: string;
  agencyOnly?: boolean;
};

type SearchResult = {
  id: number;
  type: "lead" | "campaign" | "account";
  title: string;
  subtitle: string;
  href: string;
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [, setLocation] = useLocation();
  const { isAgencyView, isAgencyUser, currentAccountId } = useWorkspace();
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefix = isAgencyView ? "/agency" : "/subaccount";

  // Navigation items
  const allNavItems: NavItem[] = useMemo(() => [
    { href: `${prefix}/accounts`, label: "Accounts", icon: Building2, keywords: "clients organizations", agencyOnly: true },
    { href: `${prefix}/campaigns`, label: "Campaigns", icon: Megaphone, keywords: "messages outreach drip" },
    { href: `${prefix}/contacts`, label: "Contacts", icon: BookUser, keywords: "leads people prospects" },
    { href: `${prefix}/conversations`, label: "Chats", icon: MessageSquare, keywords: "inbox messages whatsapp" },
    { href: `${prefix}/calendar`, label: "Calendar", icon: Calendar, keywords: "events schedule bookings" },
    { href: `${prefix}/prompt-library`, label: "Prompt Library", icon: BookOpen, keywords: "ai templates prompts", agencyOnly: true },
    { href: `${prefix}/users`, label: "Users", icon: Users, keywords: "team members roles", agencyOnly: true },
    { href: `${prefix}/automation-logs`, label: "Automation Logs", icon: ScrollText, keywords: "n8n workflows automations", agencyOnly: true },
  ], [prefix]);

  const visibleNavItems = useMemo(() =>
    allNavItems.filter((item) => !item.agencyOnly || isAgencyUser),
    [allNavItems, isAgencyUser]
  );

  // Filter nav items based on query (manual filtering since we use shouldFilter={false})
  const filteredNavItems = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return visibleNavItems;
    return visibleNavItems.filter((item) => {
      const searchable = `${item.label} ${item.keywords}`.toLowerCase();
      return searchable.includes(trimmed);
    });
  }, [query, visibleNavItems]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [open]);

  // Debounced search when query changes
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await performSearch(trimmed);
        setSearchResults(results);
      } catch (err) {
        console.error("Command palette search error:", err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, currentAccountId, isAgencyUser, prefix]);

  // Perform API search for leads, campaigns, and accounts
  const performSearch = useCallback(
    async (searchTerm: string): Promise<SearchResult[]> => {
      const results: SearchResult[] = [];
      const lowerTerm = searchTerm.toLowerCase();

      // Run searches in parallel
      const promises: Promise<void>[] = [];

      // Search leads (non-paginated to get all, then filter client-side)
      promises.push(
        (async () => {
          try {
            const leadsUrl = isAgencyUser
              ? `/api/leads`
              : `/api/leads?accountId=${currentAccountId}`;
            const leadsRes = await apiFetch(leadsUrl);
            if (leadsRes.ok) {
              const leadsData = await leadsRes.json();
              const leadsArr = Array.isArray(leadsData) ? leadsData : leadsData.data || [];
              leadsArr
                .filter((l: any) => {
                  const name = (l.full_name_1 || l.full_name || "").toLowerCase();
                  const phone = (l.phone_1 || l.phone || "").toLowerCase();
                  const email = (l.email_1 || l.email || "").toLowerCase();
                  return name.includes(lowerTerm) || phone.includes(lowerTerm) || email.includes(lowerTerm);
                })
                .slice(0, 5)
                .forEach((l: any) => {
                  const name = l.full_name_1 || l.full_name || `Lead #${l.id}`;
                  const phone = l.phone_1 || l.phone || "";
                  const email = l.email_1 || l.email || "";
                  results.push({
                    id: l.id,
                    type: "lead",
                    title: name,
                    subtitle: [phone, email].filter(Boolean).join(" \u2022 "),
                    href: `${prefix}/contacts/${l.id}`,
                  });
                });
            }
          } catch {
            // Silently fail
          }
        })()
      );

      // Search campaigns
      promises.push(
        (async () => {
          try {
            const campaignsUrl = isAgencyUser
              ? `/api/campaigns`
              : `/api/campaigns?accountId=${currentAccountId}`;
            const campaignsRes = await apiFetch(campaignsUrl);
            if (campaignsRes.ok) {
              const campaignsData = await campaignsRes.json();
              const campaignsArr = Array.isArray(campaignsData) ? campaignsData : campaignsData.data || [];
              campaignsArr
                .filter((c: any) => {
                  const name = (c.name || "").toLowerCase();
                  return name.includes(lowerTerm);
                })
                .slice(0, 5)
                .forEach((c: any) => {
                  results.push({
                    id: c.id,
                    type: "campaign",
                    title: c.name || `Campaign #${c.id}`,
                    subtitle: `${c.Status || c.status || "Unknown"} \u2022 ${c.Campaign_Type || c.type || "Campaign"}`,
                    href: `${prefix}/campaigns/${c.id}`,
                  });
                });
            }
          } catch {
            // Silently fail
          }
        })()
      );

      // Search accounts (agency only)
      if (isAgencyUser) {
        promises.push(
          (async () => {
            try {
              const accountsRes = await apiFetch(`/api/accounts`);
              if (accountsRes.ok) {
                const accountsData = await accountsRes.json();
                const accountsArr = Array.isArray(accountsData) ? accountsData : accountsData.data || [];
                accountsArr
                  .filter((a: any) => {
                    const name = (a.name || "").toLowerCase();
                    const email = (a.owner_email || "").toLowerCase();
                    return name.includes(lowerTerm) || email.includes(lowerTerm);
                  })
                  .slice(0, 3)
                  .forEach((a: any) => {
                    results.push({
                      id: a.id,
                      type: "account",
                      title: a.name || `Account #${a.id}`,
                      subtitle: a.owner_email || "",
                      href: `${prefix}/accounts`,
                    });
                  });
              }
            } catch {
              // Silently fail
            }
          })()
        );
      }

      await Promise.all(promises);
      return results;
    },
    [currentAccountId, isAgencyUser, prefix],
  );

  const handleSelect = (href: string) => {
    setOpen(false);
    setLocation(href);
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case "lead":
        return User;
      case "campaign":
        return Megaphone;
      case "account":
        return Building2;
      default:
        return User;
    }
  };

  const getResultLabel = (type: string) => {
    switch (type) {
      case "lead":
        return "Lead";
      case "campaign":
        return "Campaign";
      case "account":
        return "Account";
      default:
        return "Result";
    }
  };

  const hasResults = filteredNavItems.length > 0 || searchResults.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 max-w-[520px]">
        <VisuallyHidden>
          <DialogTitle>Command Palette</DialogTitle>
          <DialogDescription>
            Search for pages, leads, campaigns, or accounts. Use arrow keys to navigate and Enter to select.
          </DialogDescription>
        </VisuallyHidden>
        <Command
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
          <CommandInput
            placeholder="Search pages, leads, campaigns..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {!hasResults && !isSearching && (
              <CommandEmpty>No results found.</CommandEmpty>
            )}
            {!hasResults && isSearching && (
              <CommandEmpty>Searching...</CommandEmpty>
            )}

            {/* Navigation Pages */}
            {filteredNavItems.length > 0 && (
              <CommandGroup heading="Pages">
                {filteredNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.href}
                      value={item.href}
                      onSelect={() => handleSelect(item.href)}
                      className="cursor-pointer"
                    >
                      <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>{item.label}</span>
                      <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground opacity-50" />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <>
                {filteredNavItems.length > 0 && <CommandSeparator />}
                <CommandGroup heading="Search Results">
                  {searchResults.map((result) => {
                    const Icon = getResultIcon(result.type);
                    return (
                      <CommandItem
                        key={`${result.type}-${result.id}`}
                        value={`${result.type}-${result.id}`}
                        onSelect={() => handleSelect(result.href)}
                        className="cursor-pointer"
                      >
                        <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="truncate">{result.title}</span>
                          {result.subtitle && (
                            <span className="text-xs text-muted-foreground truncate">
                              {result.subtitle}
                            </span>
                          )}
                        </div>
                        <span className="ml-auto text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                          {getResultLabel(result.type)}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>

          {/* Footer with shortcut hints */}
          <div className="border-t border-border px-3 py-2 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">{"↑↓"}</kbd>
              <span>Navigate</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">{"↵"}</kbd>
              <span>Select</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Esc</kbd>
              <span>Close</span>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
