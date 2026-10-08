import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
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
import { setPersistedSelection } from "@/hooks/usePersistedSelection";
import { isNavItemVisible, useNavGateContext, type NavGate } from "@/components/crm/navVisibility";
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
  Home,
  AudioLines,
  ClipboardList,
  Settings,
  Receipt,
  MonitorPlay,
  UserSearch,
  PhoneCall,
  Send,
  Star,
  PhoneMissed,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Gates mirror RightSidebar's navItems (see navVisibility.ts) so the palette lists what the nav shows. */
type NavItem = NavGate & {
  href: string;
  /** i18n key in the crm namespace */
  labelKey: string;
  icon: LucideIcon;
  keywords: string;
};

type SearchResult = {
  id: number;
  type: "lead" | "campaign" | "account";
  title: string;
  subtitle: string;
  href: string;
  /** Persisted-selection key the target page reads to open this record. */
  selectionKey?: string;
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [, setLocation] = useLocation();
  const { t } = useTranslation("crm");
  const { isAgencyUser, currentAccountId } = useWorkspace();
  const navGates = useNavGateContext();
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefix = "/platform";

  // Navigation items
  const allNavItems: NavItem[] = useMemo(() => [
    { href: `${prefix}/home`, labelKey: "sidebar.home", icon: Home, keywords: "home hub dashboard services", ownerOnly: true },
    { href: `${prefix}/campaigns`, labelKey: "sidebar.reactivation", icon: Megaphone, keywords: "campaigns messages outreach drip reactivation" },
    // Speed to Lead links only for agency users (clients see it as "Soon" in the nav).
    { href: `${prefix}/speed-to-lead`, labelKey: "sidebar.speedToLead", icon: Send, keywords: "speed to lead fast response new leads", serviceKey: "speed", agencyOnly: true },
    { href: `${prefix}/reputation`, labelKey: "sidebar.reputation", icon: Star, keywords: "reputation reviews google ratings", serviceKey: "reputation" },
    { href: `${prefix}/missed-calls`, labelKey: "sidebar.missedCalls", icon: PhoneMissed, keywords: "missed calls text back phone", serviceKey: "missedcall" },
    { href: `${prefix}/voice-calls`, labelKey: "sidebar.voiceCalls", icon: AudioLines, keywords: "voice calls phone receptionist recordings transcripts callers", voiceCallsOnly: true },
    // /chat redirects client users to /contacts, so only agency users get this entry.
    { href: `${prefix}/chat`, labelKey: "sidebar.conversations", icon: MessageSquare, keywords: "conversations chats interactions whatsapp threads leads messages inbox", agencyOnly: true },
    { href: `${prefix}/calendar`, labelKey: "sidebar.calendar", icon: Calendar, keywords: "events schedule appointments bookings" },
    { href: `${prefix}/contacts`, labelKey: "sidebar.leads", icon: BookUser, keywords: "leads contacts people directory table pipeline" },
    { href: `${prefix}/tasks`, labelKey: "sidebar.tasks", icon: ClipboardList, keywords: "tasks todo kanban gantt", agencyOnly: true },
    { href: `${prefix}/accounts`, labelKey: "sidebar.accounts", icon: Building2, keywords: "clients organizations" },
    { href: `${prefix}/billing`, labelKey: "sidebar.billing", icon: Receipt, keywords: "billing invoices payments subscription plan" },
    { href: `${prefix}/prompt-library`, labelKey: "sidebar.promptLibrary", icon: BookOpen, keywords: "ai templates prompts", agencyOnly: true },
    { href: `${prefix}/outreach-inbox`, labelKey: "sidebar.inbox", icon: MessageSquare, keywords: "prospect inbox messages whatsapp prospects outreach chats", ownerOnly: true, outreachOnly: true },
    { href: `${prefix}/prospects`, labelKey: "sidebar.prospects", icon: UserSearch, keywords: "prospects outreach pipeline", ownerOnly: true, outreachOnly: true },
    { href: `${prefix}/cadence`, labelKey: "sidebar.cadence", icon: PhoneCall, keywords: "cadence cold calls outreach", ownerOnly: true, outreachOnly: true },
    { href: `${prefix}/automation-logs`, labelKey: "sidebar.automations", icon: ScrollText, keywords: "automation logs n8n workflows automations health engine", ownerOnly: true },
    { href: `${prefix}/demos`, labelKey: "sidebar.demos", icon: MonitorPlay, keywords: "demos browser demo sessions links", ownerOnly: true },
    { href: `${prefix}/settings`, labelKey: "sidebar.settings", icon: Settings, keywords: "settings preferences profile account" },
    { href: `${prefix}/settings?tab=team`, labelKey: "commandPalette.team", icon: Users, keywords: "users team members roles", agencyOnly: true },
  ], [prefix]);

  const visibleNavItems = useMemo(() =>
    allNavItems.filter((item) => isNavItemVisible(item, navGates)),
    [allNavItems, navGates]
  );

  // Filter nav items based on query (manual filtering since we use shouldFilter={false})
  const filteredNavItems = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return visibleNavItems;
    return visibleNavItems.filter((item) => {
      const searchable = `${t(item.labelKey)} ${item.keywords}`.toLowerCase();
      return searchable.includes(trimmed);
    });
  }, [query, visibleNavItems, t]);

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
                  const name = l.full_name_1 || l.full_name || t("commandPalette.fallbackLead", { id: l.id });
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
            // Match the Campaigns page scope so the selected campaign is in its list.
            const campaignsUrl = isAgencyUser && currentAccountId <= 0
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
                    title: c.name || t("commandPalette.fallbackCampaign", { id: c.id }),
                    subtitle: `${c.Status || c.status || t("commandPalette.unknownStatus")} \u2022 ${c.Campaign_Type || c.type || t("commandPalette.resultTypes.campaign")}`,
                    // No /campaigns/:id route: open the Campaigns page with this campaign selected.
                    href: `${prefix}/campaigns`,
                    selectionKey: "selected-campaign-id",
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
                      title: a.name || t("commandPalette.fallbackAccount", { id: a.id }),
                      subtitle: a.owner_email || "",
                      href: `${prefix}/accounts`,
                      selectionKey: "selected-account-id",
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
    [currentAccountId, isAgencyUser, prefix, t],
  );

  const handleSelect = (href: string, selection?: { key: string; id: number }) => {
    setOpen(false);
    if (selection) setPersistedSelection(selection.key, selection.id);
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

  const getResultLabel = (type: string) =>
    t(`commandPalette.resultTypes.${type}`, { defaultValue: t("commandPalette.resultTypes.result") });

  const hasResults = filteredNavItems.length > 0 || searchResults.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 max-w-[520px]">
        <VisuallyHidden>
          <DialogTitle>{t("commandPalette.title")}</DialogTitle>
          <DialogDescription>{t("commandPalette.description")}</DialogDescription>
        </VisuallyHidden>
        <Command
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
          <CommandInput
            placeholder={t("commandPalette.placeholder")}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {!hasResults && !isSearching && (
              <CommandEmpty>{t("commandPalette.noResults")}</CommandEmpty>
            )}
            {!hasResults && isSearching && (
              <CommandEmpty>{t("commandPalette.searching")}</CommandEmpty>
            )}

            {/* Navigation Pages */}
            {filteredNavItems.length > 0 && (
              <CommandGroup heading={t("commandPalette.pages")}>
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
                      <span>{t(item.labelKey)}</span>
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
                <CommandGroup heading={t("commandPalette.searchResults")}>
                  {searchResults.map((result) => {
                    const Icon = getResultIcon(result.type);
                    return (
                      <CommandItem
                        key={`${result.type}-${result.id}`}
                        value={`${result.type}-${result.id}`}
                        onSelect={() => handleSelect(result.href, result.selectionKey ? { key: result.selectionKey, id: result.id } : undefined)}
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
              <span>{t("commandPalette.navigate")}</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">{"↵"}</kbd>
              <span>{t("commandPalette.select")}</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Esc</kbd>
              <span>{t("commandPalette.close")}</span>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
