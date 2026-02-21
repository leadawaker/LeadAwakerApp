import { useMemo, useState, useEffect, useCallback } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { apiFetch } from "@/lib/apiUtils";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SkeletonCardGrid } from "@/components/ui/skeleton";
import { DataEmptyState } from "@/components/crm/DataEmptyState";

// Map color name strings (from DB) to hex values
const COLOR_MAP: Record<string, string> = {
  blue:   "#3B82F6",
  green:  "#22C55E",
  red:    "#EF4444",
  yellow: "#EAB308",
  orange: "#F97316",
  purple: "#A855F7",
  gray:   "#64748B",
  grey:   "#64748B",
  pink:   "#EC4899",
  teal:   "#14B8A6",
  cyan:   "#06B6D4",
  indigo: "#6366F1",
};

function resolveColor(color: string | null | undefined): string {
  if (!color) return "#64748B";
  // Already a hex value
  if (color.startsWith("#")) return color;
  // Named color
  return COLOR_MAP[color.toLowerCase()] ?? "#64748B";
}

interface Tag {
  id: number;
  name: string;
  color: string | null;
  category: string | null;
  description: string | null;
  auto_applied?: boolean;
  account_id?: number | null;
  Accounts_id?: number | null;
  count?: number;
}

interface GroupedCategory {
  type: string;
  tags: (Tag & { count: number; hexColor: string })[];
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [q, setQ] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [campaignId, setCampaignId] = useState<string>("all");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tagsRes, leadsRes, campaignsRes, accountsRes] = await Promise.all([
        apiFetch("/api/tags"),
        apiFetch("/api/leads"),
        apiFetch("/api/campaigns"),
        apiFetch("/api/accounts"),
      ]);

      if (!tagsRes.ok) {
        throw new Error(`${tagsRes.status}: Failed to fetch tags`);
      }

      const tagsData = await tagsRes.json();
      const leadsData = leadsRes.ok ? await leadsRes.json() : [];
      const campaignsData = campaignsRes.ok ? await campaignsRes.json() : [];
      const accountsData = accountsRes.ok ? await accountsRes.json() : [];

      setTags(Array.isArray(tagsData) ? tagsData.filter((t: Tag) => t.name) : []);
      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setCampaigns(Array.isArray(campaignsData) ? campaignsData : []);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
    } catch (err) {
      console.error("Failed to fetch tags data:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter leads by account and campaign
  const filteredLeads = useMemo(() => {
    return leads
      .filter((l: any) => {
        if (selectedAccountId === "all") return true;
        const accountId = l.account_id ?? l.accounts_id ?? l.Accounts_id;
        return String(accountId) === selectedAccountId;
      })
      .filter((l: any) => {
        if (campaignId === "all") return true;
        const cId = l.campaign_id ?? l.campaigns_id ?? l.Campaigns_id;
        return String(cId) === campaignId;
      });
  }, [leads, selectedAccountId, campaignId]);

  // Campaign options scoped to selected account
  const campaignOptions = useMemo(() => {
    return campaigns.filter((c: any) => {
      if (selectedAccountId === "all") return true;
      const accountId = c.account_id ?? c.accounts_id ?? c.Accounts_id;
      return String(accountId) === selectedAccountId;
    });
  }, [campaigns, selectedAccountId]);

  // Count leads per tag name
  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    filteredLeads.forEach((l: any) => {
      const rawTags = l.tags ?? l.Tags ?? [];
      if (Array.isArray(rawTags)) {
        rawTags.forEach((t: string) => {
          if (t) map.set(t, (map.get(t) ?? 0) + 1);
        });
      }
    });
    return map;
  }, [filteredLeads]);

  // Group real API tags by category
  const groupedCategories = useMemo((): GroupedCategory[] => {
    const categoryMap = new Map<string, (Tag & { count: number; hexColor: string })[]>();

    tags.forEach((tag) => {
      const categoryKey = tag.category
        ? tag.category.charAt(0).toUpperCase() + tag.category.slice(1)
        : "Uncategorized";

      // Apply search filter
      if (q && !tag.name!.toLowerCase().includes(q.toLowerCase())) return;

      const enriched = {
        ...tag,
        count: tagCounts.get(tag.name!) ?? 0,
        hexColor: resolveColor(tag.color),
      };

      if (!categoryMap.has(categoryKey)) {
        categoryMap.set(categoryKey, []);
      }
      categoryMap.get(categoryKey)!.push(enriched);
    });

    // Sort categories alphabetically, tags within each by name
    return Array.from(categoryMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, catTags]) => ({
        type,
        tags: catTags.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
      }));
  }, [tags, tagCounts, q]);

  const selectedTag = useMemo(
    () => (selectedTagId != null ? tags.find((t) => t.id === selectedTagId) ?? null : null),
    [selectedTagId, tags]
  );

  const selectedLeads = useMemo(() => {
    if (!selectedTag) return [];
    return filteredLeads.filter((l: any) => {
      const rawTags = l.tags ?? l.Tags ?? [];
      return Array.isArray(rawTags) && rawTags.includes(selectedTag.name!);
    });
  }, [selectedTag, filteredLeads]);

  if (error && tags.length === 0 && !loading) {
    return (
      <CrmShell>
        <ApiErrorFallback error={error} onRetry={fetchData} isRetrying={loading} />
      </CrmShell>
    );
  }

  if (loading) {
    return (
      <CrmShell>
        <div className="py-4 px-1">
          <SkeletonCardGrid count={9} columns="grid-cols-1 md:grid-cols-2 xl:grid-cols-3" />
        </div>
      </CrmShell>
    );
  }

  return (
    <CrmShell>
      <div className="py-4" data-testid="tags-page">
        <div className="flex flex-col gap-4">
          {/* TOP SEARCH & FILTERS */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-1 gap-2 items-center w-full">
              <input
                data-testid="input-search-tags"
                className="h-10 flex-1 max-w-md rounded-xl border border-border bg-card px-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                placeholder="Search tags…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Select
                value={selectedAccountId}
                onValueChange={(v) => {
                  setSelectedAccountId(v);
                  setCampaignId("all");
                }}
              >
                <SelectTrigger
                  data-testid="select-account-filter"
                  className="w-[180px] h-10 rounded-xl bg-card"
                >
                  <SelectValue placeholder="All Accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts.map((acc: any) => (
                    <SelectItem key={acc.id} value={String(acc.id)}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger
                  data-testid="select-campaign-filter"
                  className="w-[180px] h-10 rounded-xl bg-card"
                >
                  <SelectValue placeholder="All Campaigns" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campaigns</SelectItem>
                  {campaignOptions.map((c: any) => (
                    <SelectItem key={c.id ?? c.Id} value={String(c.id ?? c.Id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {tags.filter((t) => t.name).length} tags in {groupedCategories.length} categories
            </div>
          </div>

          {groupedCategories.length === 0 ? (
            <DataEmptyState
              variant="search"
              title="No tags found"
              description={q ? `No tags match "${q}"` : "No tags available."}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6 items-start">
              {/* LEFT — TAG GROUPS */}
              <div className="space-y-8">
                {groupedCategories.map((cat) => (
                  <div
                    key={cat.type}
                    className="space-y-3"
                    data-testid={`tag-category-${cat.type.toLowerCase()}`}
                  >
                    <h3 className="inline-flex items-center px-3 py-1.5 rounded-lg bg-muted/15 dark:bg-muted/8 glass-surface text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {cat.type}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 bg-card p-4 rounded-2xl shadow-sm border border-border">
                      {cat.tags.map((t) => (
                        <button
                          key={t.id}
                          data-testid={`tag-item-${t.id}`}
                          onClick={() => setSelectedTagId(t.id === selectedTagId ? null : t.id)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-xl transition text-left border border-transparent",
                            selectedTagId === t.id
                              ? "ring-2 ring-primary bg-card"
                              : "hover:bg-muted/5"
                          )}
                          style={{ backgroundColor: `${t.hexColor}08` }}
                          title={t.description ?? t.name ?? undefined}
                        >
                          {/* Color dot + count badge */}
                          <div
                            className="h-7 w-7 rounded-full text-[11px] font-bold flex items-center justify-center text-white shrink-0 shadow-sm"
                            style={{ backgroundColor: t.hexColor }}
                          >
                            {t.count}
                          </div>

                          <div className="min-w-0">
                            <div
                              data-testid={`tag-name-${t.id}`}
                              className="truncate font-semibold text-[13px] text-foreground leading-tight"
                            >
                              {t.name}
                            </div>
                            {t.description && (
                              <div className="truncate text-[10px] text-muted-foreground mt-0.5">
                                {t.description}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* RIGHT — STICKY SIDE PANEL */}
              <div className="space-y-4 sticky top-6">
                <div className="bg-card rounded-2xl shadow-sm border border-border flex flex-col max-h-[calc(100vh-200px)]">
                  <div className="p-4 border-b space-y-1">
                    <div className="font-bold text-sm" data-testid="side-panel-title">
                      {selectedTag ? `Leads: ${selectedTag.name}` : "Tag Insights"}
                    </div>
                    {selectedTag?.description && (
                      <div
                        className="text-xs text-muted-foreground"
                        data-testid="side-panel-description"
                      >
                        {selectedTag.description}
                      </div>
                    )}
                    {selectedTag && (
                      <div className="flex items-center gap-2 pt-1">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: resolveColor(selectedTag.color) }}
                        />
                        <span className="text-[11px] font-medium text-muted-foreground capitalize">
                          {selectedTag.category ?? "Uncategorized"}
                        </span>
                        {selectedTag.auto_applied && (
                          <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                            Auto
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="overflow-y-auto divide-y" data-testid="side-panel-leads">
                    {!selectedTag ? (
                      <DataEmptyState
                        variant="tags"
                        title="Tag Insights"
                        description="Click a tag to see associated leads and their details."
                        compact
                      />
                    ) : selectedLeads.length === 0 ? (
                      <DataEmptyState
                        variant="search"
                        title="No leads found"
                        description="No leads are associated with this tag yet."
                        compact
                      />
                    ) : (
                      selectedLeads.map((l: any) => {
                        const leadName =
                          l.full_name_1 ?? l.full_name ?? l.name ?? l.Name ?? "Unnamed Lead";
                        const lastMsg =
                          l.last_message_sent_at ?? l.Last_Message_Sent_At;
                        return (
                          <div
                            key={l.id ?? l.Id}
                            className="p-4 hover:bg-muted/10"
                            data-testid={`lead-item-${l.id ?? l.Id}`}
                          >
                            <div className="font-semibold text-sm truncate">{leadName}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {l.phone ?? l.Phone ?? l.whatsapp_number ?? ""}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Last message:{" "}
                              {lastMsg
                                ? new Date(lastMsg).toLocaleDateString()
                                : "No messages yet"}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </CrmShell>
  );
}
