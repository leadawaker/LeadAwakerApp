import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useLeadsData } from "../hooks/useLeadsData";
import { useAccounts, useCampaigns } from "@/hooks/useApiData";
import { LeadsKanban } from "../components/LeadsKanban";
import { KanbanDetailPanel, getLeadId } from "../components/LeadsCardView";
import { LeadDetailPanel } from "../components/LeadDetailPanel";
import { updateLead } from "../api/leadsApi";
import { apiFetch } from "@/lib/apiUtils";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { cn } from "@/lib/utils";
import {
  Building2,
  Megaphone,
  ChevronsUpDown,
  Check,
  Columns3,
  Search,
  X,
  Flame,
  SlidersHorizontal,
  ArrowUpDown,
  Phone,
  Mail,
  Tag,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type SortBy = "score-desc" | "recency" | "alpha" | null;

export function OpportunitiesPage() {
  const { currentAccountId, isAgencyView, isAgencyUser } = useWorkspace();
  const { accounts } = useAccounts();

  /* ── Account / Campaign filtering (persisted) ──────────────────────────── */
  const [selectedAccountId, setSelectedAccountId] = useState<number | "all">(() => {
    try {
      const stored = localStorage.getItem("opp_account_id");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed === "all" || typeof parsed === "number") return parsed;
      }
    } catch {}
    return isAgencyView && currentAccountId === 1 ? "all" : (currentAccountId ?? "all");
  });
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | "all">(() => {
    try {
      const stored = localStorage.getItem("opp_campaign_id");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed === "all" || typeof parsed === "number") return parsed;
      }
    } catch {}
    return "all";
  });

  /* ── Tags always-visible toggle (persisted) ─────────────────────────────── */
  const [showTagsAlways, setShowTagsAlways] = useState<boolean>(() => {
    try {
      return localStorage.getItem("kanban_tags_always_show") === "true";
    } catch {}
    return false;
  });

  const accountFilterId = selectedAccountId === "all" ? undefined : selectedAccountId;
  const { campaigns } = useCampaigns(accountFilterId);

  /* Persist account/campaign selections */
  useEffect(() => {
    try { localStorage.setItem("opp_account_id", JSON.stringify(selectedAccountId)); } catch {}
  }, [selectedAccountId]);

  useEffect(() => {
    try { localStorage.setItem("opp_campaign_id", JSON.stringify(selectedCampaignId)); } catch {}
  }, [selectedCampaignId]);

  /* Persist tags toggle */
  useEffect(() => {
    try { localStorage.setItem("kanban_tags_always_show", String(showTagsAlways)); } catch {}
  }, [showTagsAlways]);

  /* Reset campaign when account switches to a different account */
  const prevAccountIdRef = useRef<number | "all">(selectedAccountId);
  useEffect(() => {
    if (prevAccountIdRef.current !== selectedAccountId) {
      prevAccountIdRef.current = selectedAccountId;
      setSelectedCampaignId("all");
      try { localStorage.removeItem("opp_campaign_id"); } catch {}
    }
  }, [selectedAccountId]);

  const filterAccountId =
    isAgencyView && selectedAccountId === "all"
      ? undefined
      : selectedAccountId === "all"
      ? undefined
      : selectedAccountId;
  const { leads: rawLeads, loading, error, handleRefresh, setLeads } = useLeadsData(filterAccountId);

  const [searchQuery, setSearchQuery] = useState("");

  /* ── Filters ───────────────────────────────────────────────────────────── */
  const [showHighScore, setShowHighScore] = useState(false);
  const [filterHasPhone, setFilterHasPhone] = useState(false);
  const [filterHasEmail, setFilterHasEmail] = useState(false);

  /* ── Sort ──────────────────────────────────────────────────────────────── */
  const [sortBy, setSortBy] = useState<SortBy>(null);

  const leads = useMemo(() => {
    let filtered: any[] =
      selectedCampaignId === "all"
        ? rawLeads
        : rawLeads.filter((l: any) => {
            const cid = l.campaign_id || l.Campaign_id || l.Campaigns_id;
            return cid === selectedCampaignId;
          });

    if (showHighScore) {
      filtered = filtered.filter(
        (l: any) => Number(l.lead_score ?? l.leadScore ?? l.Lead_Score ?? 0) >= 70
      );
    }
    if (filterHasPhone) {
      filtered = filtered.filter((l: any) => Boolean(l.phone || l.Phone));
    }
    if (filterHasEmail) {
      filtered = filtered.filter((l: any) => Boolean(l.email || l.Email));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((l: any) => {
        const name = (
          l.full_name ||
          [l.first_name, l.last_name].filter(Boolean).join(" ") ||
          ""
        ).toLowerCase();
        const phone = (l.phone || l.Phone || "").toLowerCase();
        const email = (l.email || l.Email || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || email.includes(q);
      });
    }

    if (sortBy === "score-desc") {
      filtered = [...filtered].sort(
        (a, b) =>
          Number(b.lead_score ?? b.leadScore ?? b.Lead_Score ?? 0) -
          Number(a.lead_score ?? a.leadScore ?? a.Lead_Score ?? 0)
      );
    } else if (sortBy === "recency") {
      filtered = [...filtered].sort((a, b) => {
        const aDate = new Date(
          a.last_interaction_at || a.last_message_received_at || a.created_at || 0
        ).getTime();
        const bDate = new Date(
          b.last_interaction_at || b.last_message_received_at || b.created_at || 0
        ).getTime();
        return bDate - aDate;
      });
    } else if (sortBy === "alpha") {
      filtered = [...filtered].sort((a, b) => {
        const na = (
          a.full_name ||
          [a.first_name, a.last_name].filter(Boolean).join(" ") ||
          ""
        ).toLowerCase();
        const nb = (
          b.full_name ||
          [b.first_name, b.last_name].filter(Boolean).join(" ") ||
          ""
        ).toLowerCase();
        return na.localeCompare(nb);
      });
    }

    return filtered;
  }, [rawLeads, selectedCampaignId, showHighScore, filterHasPhone, filterHasEmail, searchQuery, sortBy]);

  const totalLeads = leads.length;

  const [selectedLead, setSelectedLead] = useState<Record<string, any> | null>(null);
  const [fullProfileLead, setFullProfileLead] = useState<Record<string, any> | null>(null);

  /* ── Fold / unfold trigger ─────────────────────────────────────────────── */
  const [foldAction, setFoldAction] = useState<{
    type: "expand-all" | "fold-threshold";
    threshold?: number;
    seq: number;
  }>({ type: "expand-all", seq: 0 });
  const [hasAnyCollapsed, setHasAnyCollapsed] = useState(false);
  const [foldThresholdInput, setFoldThresholdInput] = useState("0");
  const [foldPopoverOpen, setFoldPopoverOpen] = useState(false);

  const applyFold = useCallback(() => {
    const threshold = parseInt(foldThresholdInput, 10);
    if (isNaN(threshold) || threshold < 0) return;
    setFoldAction((prev) => ({ type: "fold-threshold", threshold, seq: prev.seq + 1 }));
    setFoldPopoverOpen(false);
  }, [foldThresholdInput]);

  /* ── Tag data ──────────────────────────────────────────────────────────── */
  const [leadTagsInfo, setLeadTagsInfo] = useState<Map<number, { name: string; color: string }[]>>(
    new Map()
  );
  const [allTagsById, setAllTagsById] = useState<Map<number, { name: string; color: string }>>(
    new Map()
  );
  const [leadTagMap, setLeadTagMap] = useState<Map<number, number[]>>(new Map());

  useEffect(() => {
    apiFetch("/api/tags")
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data?.list || [];
          const byId = new Map<number, { name: string; color: string }>();
          list.forEach((t: any) =>
            byId.set(t.id, { name: t.name || `Tag ${t.id}`, color: t.color || "gray" })
          );
          setAllTagsById(byId);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (leads.length === 0) return;
    const fetchLeadTags = async () => {
      try {
        const batchSize = 10;
        const batches: Promise<{ leadId: number; tagIds: number[] }[]>[] = [];
        for (let i = 0; i < leads.length; i += batchSize) {
          const batch = leads.slice(i, i + batchSize);
          batches.push(
            Promise.allSettled(
              batch.map(async (lead) => {
                const leadId = lead.Id || lead.id;
                const res = await apiFetch(`/api/leads/${leadId}/tags`);
                if (res.ok) {
                  const data = await res.json();
                  const tagIds = Array.isArray(data)
                    ? data.map((t: any) => t.Tags_id || t.tags_id || t.id)
                    : [];
                  return { leadId, tagIds };
                }
                return { leadId, tagIds: [] as number[] };
              })
            ).then((results) =>
              results
                .filter(
                  (r): r is PromiseFulfilledResult<{ leadId: number; tagIds: number[] }> =>
                    r.status === "fulfilled"
                )
                .map((r) => r.value)
            )
          );
        }
        const allBatchResults = await Promise.all(batches);
        const tagMap = new Map<number, number[]>();
        allBatchResults.flat().forEach(({ leadId, tagIds }) => tagMap.set(leadId, tagIds));
        setLeadTagMap(tagMap);
      } catch {}
    };
    fetchLeadTags();
  }, [leads]);

  useEffect(() => {
    if (allTagsById.size === 0) return;
    const info = new Map<number, { name: string; color: string }[]>();
    leadTagMap.forEach((tagIds, leadId) => {
      const tagDetails = tagIds
        .map((id) => allTagsById.get(id))
        .filter((t): t is { name: string; color: string } => !!t);
      info.set(leadId, tagDetails);
    });
    setLeadTagsInfo(info);
  }, [leadTagMap, allTagsById]);

  /* ── Kanban drag handler ───────────────────────────────────────────────── */
  const handleKanbanLeadMove = useCallback(
    async (leadId: number | string, newStage: string) => {
      setLeads((prev) =>
        prev.map((l) =>
          l.Id === leadId || l.id === leadId
            ? { ...l, conversion_status: newStage, Conversion_Status: newStage }
            : l
        )
      );
      try {
        await updateLead(leadId, { Conversion_Status: newStage });
      } catch (err) {
        handleRefresh();
        throw err;
      }
    },
    [setLeads, handleRefresh]
  );

  const handleClosePanel = () => setSelectedLead(null);

  /* ── Selector helpers ── */
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const selectedCampaign = campaigns.find((c: any) => c.id === selectedCampaignId);

  const filteredCampaigns =
    selectedAccountId === "all"
      ? campaigns
      : campaigns.filter((c: any) => (c.account_id || c.Accounts_id) === selectedAccountId);

  const activeFilterCount =
    (showHighScore ? 1 : 0) + (filterHasPhone ? 1 : 0) + (filterHasEmail ? 1 : 0);
  const isFilterActive = activeFilterCount > 0;
  const isSortActive = sortBy !== null;

  const clearAllFilters = () => {
    setShowHighScore(false);
    setFilterHasPhone(false);
    setFilterHasEmail(false);
  };

  if (error && leads.length === 0 && !loading) {
    return <ApiErrorFallback error={error} onRetry={handleRefresh} isRetrying={loading} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Full-height bg panel wrapping title + kanban ── */}
      <div className="flex-1 min-h-0 flex gap-[3px] overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden bg-muted rounded-[var(--radius)]">

          {/* ── Title bar ── */}
          <div className="px-3.5 pt-5 pb-8 shrink-0 flex items-center gap-3 flex-wrap">

            {/* Title + lead count */}
            <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight mr-6">
              Opportunities
            </h2>
            <span className="h-10 w-10 rounded-full border border-border/50 flex items-center justify-center text-[10px] font-semibold text-foreground tabular-nums shrink-0">
              {totalLeads}
            </span>

            {/* Account selector — agency users only */}
            {isAgencyUser && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "h-10 px-4 rounded-full flex items-center gap-2 text-sm font-medium transition-colors",
                      selectedAccountId === "all"
                        ? "border border-border/60 text-muted-foreground hover:bg-card hover:text-foreground"
                        : "bg-brand-blue/10 text-brand-blue border border-brand-blue/20"
                    )}
                  >
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span className="truncate max-w-[120px]">
                      {selectedAccountId === "all"
                        ? "All Accounts"
                        : selectedAccount?.name || "Account"}
                    </span>
                    <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 rounded-2xl">
                  <DropdownMenuItem
                    onClick={() => setSelectedAccountId("all")}
                    className={cn(
                      "flex items-center gap-2 cursor-pointer rounded-xl",
                      selectedAccountId === "all" && "font-bold bg-muted"
                    )}
                  >
                    <span className="text-sm flex-1">All Accounts</span>
                    {selectedAccountId === "all" && (
                      <Check className="h-4 w-4 text-brand-blue shrink-0" />
                    )}
                  </DropdownMenuItem>
                  {accounts
                    .filter((a) => a.id !== 1)
                    .map((acc) => (
                      <DropdownMenuItem
                        key={acc.id}
                        onClick={() => setSelectedAccountId(acc.id)}
                        className={cn(
                          "flex items-center gap-2 cursor-pointer rounded-xl",
                          selectedAccountId === acc.id && "font-bold bg-muted"
                        )}
                      >
                        <span className="text-sm truncate flex-1">{acc.name}</span>
                        {selectedAccountId === acc.id && (
                          <Check className="h-4 w-4 text-brand-blue shrink-0" />
                        )}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Campaign selector — only when a specific account is chosen */}
            {selectedAccountId !== "all" && filteredCampaigns.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "h-10 px-4 rounded-full flex items-center gap-2 text-sm font-medium transition-colors",
                      selectedCampaignId === "all"
                        ? "border border-border/60 text-muted-foreground hover:bg-card hover:text-foreground"
                        : "bg-brand-yellow/10 text-foreground border border-brand-yellow/30"
                    )}
                  >
                    <Megaphone className="h-4 w-4 shrink-0" />
                    <span className="truncate max-w-[120px]">
                      {selectedCampaignId === "all"
                        ? "All Campaigns"
                        : selectedCampaign?.name || "Campaign"}
                    </span>
                    <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 rounded-2xl">
                  <DropdownMenuItem
                    onClick={() => setSelectedCampaignId("all")}
                    className={cn(
                      "flex items-center gap-2 cursor-pointer rounded-xl",
                      selectedCampaignId === "all" && "font-bold bg-muted"
                    )}
                  >
                    <span className="text-sm flex-1">All Campaigns</span>
                    {selectedCampaignId === "all" && (
                      <Check className="h-4 w-4 text-brand-blue shrink-0" />
                    )}
                  </DropdownMenuItem>
                  {filteredCampaigns.map((c: any) => (
                    <DropdownMenuItem
                      key={c.id}
                      onClick={() => setSelectedCampaignId(c.id)}
                      className={cn(
                        "flex items-center gap-2 cursor-pointer rounded-xl",
                        selectedCampaignId === c.id && "font-bold bg-muted"
                      )}
                    >
                      <span className="text-sm truncate flex-1">{c.name}</span>
                      {selectedCampaignId === c.id && (
                        <Check className="h-4 w-4 text-brand-blue shrink-0" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Search input */}
            <div
              className={cn(
                "h-10 flex items-center gap-2 px-3 rounded-full border transition-colors",
                searchQuery
                  ? "bg-brand-blue/5 border-brand-blue/30"
                  : "bg-card border-border/60"
              )}
            >
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search leads…"
                className="bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground/60 w-[140px]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-muted-foreground/60 hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "h-10 px-4 rounded-full flex items-center gap-2 text-sm font-medium transition-colors",
                    isFilterActive
                      ? "bg-brand-blue/10 text-brand-blue border border-brand-blue/20"
                      : "border border-border/60 text-muted-foreground hover:bg-card hover:text-foreground"
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4 shrink-0" />
                  <span>Filter</span>
                  {isFilterActive && (
                    <span className="h-4 w-4 rounded-full bg-brand-blue text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60 rounded-2xl">
                <DropdownMenuItem
                  onClick={() => setShowHighScore((v) => !v)}
                  className="flex items-center gap-2 cursor-pointer rounded-xl"
                >
                  <Flame
                    className={cn(
                      "h-4 w-4 shrink-0",
                      showHighScore ? "text-[#FCB803]" : "text-muted-foreground"
                    )}
                  />
                  <span className={cn("text-sm flex-1", showHighScore && "font-semibold")}>
                    High Score (70+)
                  </span>
                  {showHighScore && <Check className="h-4 w-4 text-brand-blue shrink-0" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setFilterHasPhone((v) => !v)}
                  className="flex items-center gap-2 cursor-pointer rounded-xl"
                >
                  <Phone
                    className={cn(
                      "h-4 w-4 shrink-0",
                      filterHasPhone ? "text-brand-blue" : "text-muted-foreground"
                    )}
                  />
                  <span className={cn("text-sm flex-1", filterHasPhone && "font-semibold")}>
                    Has Phone
                  </span>
                  {filterHasPhone && <Check className="h-4 w-4 text-brand-blue shrink-0" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setFilterHasEmail((v) => !v)}
                  className="flex items-center gap-2 cursor-pointer rounded-xl"
                >
                  <Mail
                    className={cn(
                      "h-4 w-4 shrink-0",
                      filterHasEmail ? "text-brand-blue" : "text-muted-foreground"
                    )}
                  />
                  <span className={cn("text-sm flex-1", filterHasEmail && "font-semibold")}>
                    Has Email
                  </span>
                  {filterHasEmail && <Check className="h-4 w-4 text-brand-blue shrink-0" />}
                </DropdownMenuItem>

                {isFilterActive && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={clearAllFilters}
                      className="flex items-center gap-2 cursor-pointer rounded-xl text-muted-foreground"
                    >
                      <X className="h-4 w-4 shrink-0" />
                      <span className="text-sm">Clear all</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort button — separate from Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "h-10 px-4 rounded-full flex items-center gap-2 text-sm font-medium transition-colors",
                    isSortActive
                      ? "bg-brand-blue/10 text-brand-blue border border-brand-blue/20"
                      : "border border-border/60 text-muted-foreground hover:bg-card hover:text-foreground"
                  )}
                >
                  <ArrowUpDown className="h-4 w-4 shrink-0" />
                  <span>Sort</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 rounded-2xl">
                <DropdownMenuItem
                  onClick={() => setSortBy(null)}
                  className="flex items-center gap-2 cursor-pointer rounded-xl"
                >
                  <span className={cn("text-sm flex-1", sortBy === null && "font-semibold")}>
                    Default
                  </span>
                  {sortBy === null && <Check className="h-4 w-4 text-brand-blue shrink-0" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSortBy("score-desc")}
                  className="flex items-center gap-2 cursor-pointer rounded-xl"
                >
                  <span
                    className={cn("text-sm flex-1", sortBy === "score-desc" && "font-semibold")}
                  >
                    Score (High → Low)
                  </span>
                  {sortBy === "score-desc" && (
                    <Check className="h-4 w-4 text-brand-blue shrink-0" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSortBy("recency")}
                  className="flex items-center gap-2 cursor-pointer rounded-xl"
                >
                  <span
                    className={cn("text-sm flex-1", sortBy === "recency" && "font-semibold")}
                  >
                    Recency (Newest first)
                  </span>
                  {sortBy === "recency" && <Check className="h-4 w-4 text-brand-blue shrink-0" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSortBy("alpha")}
                  className="flex items-center gap-2 cursor-pointer rounded-xl"
                >
                  <span className={cn("text-sm flex-1", sortBy === "alpha" && "font-semibold")}>
                    Alphabetical (A → Z)
                  </span>
                  {sortBy === "alpha" && <Check className="h-4 w-4 text-brand-blue shrink-0" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Fold / Unfold button */}
            {hasAnyCollapsed ? (
              <button
                onClick={() =>
                  setFoldAction((prev) => ({ type: "expand-all", seq: prev.seq + 1 }))
                }
                className="h-10 px-4 rounded-full flex items-center gap-2 text-sm font-medium bg-black text-[#FFE35B] border border-black hover:opacity-85 transition-opacity"
              >
                <Columns3 className="h-4 w-4 shrink-0" />
                <span>Unfold</span>
              </button>
            ) : (
              <Popover open={foldPopoverOpen} onOpenChange={setFoldPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "h-10 px-4 rounded-full flex items-center gap-2 text-sm font-medium transition-colors",
                      foldPopoverOpen
                        ? "bg-black text-[#FFE35B] border border-black"
                        : "border border-border/60 text-muted-foreground hover:bg-card hover:text-foreground"
                    )}
                  >
                    <Columns3 className="h-4 w-4 shrink-0" />
                    <span>Fold</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 rounded-2xl p-4">
                  <p className="text-sm font-semibold mb-1">Fold columns</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Fold columns with this many leads or fewer.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={foldThresholdInput}
                      onChange={(e) => setFoldThresholdInput(e.target.value)}
                      min="0"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") applyFold();
                      }}
                      className="h-9 w-20 rounded-xl border border-border bg-background px-3 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                    />
                    <span className="text-sm text-muted-foreground flex-1">leads</span>
                    <button
                      onClick={applyFold}
                      className="h-9 px-4 rounded-xl bg-brand-blue text-white text-sm font-semibold hover:bg-brand-blue/90 transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Tags always-show toggle — next to Fold/Unfold */}
            <button
              onClick={() => setShowTagsAlways((v) => !v)}
              title={showTagsAlways ? "Tags always visible — click to hover-only" : "Show tags on hover only — click to always show"}
              className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-colors",
                showTagsAlways
                  ? "bg-black text-[#FFE35B] border border-black hover:opacity-85"
                  : "border border-border/60 text-muted-foreground hover:bg-card hover:text-foreground"
              )}
            >
              <Tag className="h-4 w-4" />
            </button>
          </div>

          {/* ── Kanban pipeline columns ── */}
          <div className="flex-1 min-h-0 overflow-hidden p-[6px] pt-0">
            <LeadsKanban
              leads={leads}
              loading={loading}
              leadTagsMap={leadTagsInfo}
              onLeadMove={handleKanbanLeadMove}
              onCardClick={setSelectedLead}
              selectedLeadId={selectedLead?.Id ?? selectedLead?.id}
              foldAction={foldAction}
              onCollapsedChange={setHasAnyCollapsed}
              showTagsAlways={showTagsAlways}
            />
          </div>
        </div>

        {selectedLead && (
          <div className="w-[380px] flex-shrink-0 flex flex-col min-w-0 overflow-hidden bg-card rounded-lg">
            <KanbanDetailPanel
              lead={selectedLead}
              onClose={handleClosePanel}
              leadTags={leadTagsInfo.get(getLeadId(selectedLead)) || []}
              onOpenFullProfile={() => setFullProfileLead(selectedLead)}
            />
          </div>
        )}
      </div>

      {/* Full lead profile sheet */}
      <LeadDetailPanel
        lead={fullProfileLead ?? {}}
        open={!!fullProfileLead}
        onClose={() => setFullProfileLead(null)}
      />
    </div>
  );
}
