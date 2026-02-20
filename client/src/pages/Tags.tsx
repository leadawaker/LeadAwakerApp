import { useMemo, useState, useEffect, useCallback } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiFetch } from "@/lib/apiUtils";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SkeletonCardGrid } from "@/components/ui/skeleton";
import { DataEmptyState } from "@/components/crm/DataEmptyState";

const TAG_CATEGORIES = [
  {
    type: "Status",
    tags: [
      { name: "bump 1 reply", color: "#3B82F6", id: 4, description: "Lead replied to first bump" },
      { name: "bump 2 reply", color: "#3B82F6", id: 6, description: "Lead replied to second bump" },
      { name: "bump 3 reply", color: "#3B82F6", id: 8, description: "Lead replied to third bump" },
      { name: "bump response", color: "#3B82F6", id: 9, description: "Lead responded to any bump" },
      { name: "first message", color: "#EAB308", id: 13, description: "Initial message sent" },
      { name: "follow-up", color: "#F97316", id: 14, description: "Requires follow-up" },
      { name: "lead", color: "#3B82F6", id: 17, description: "General lead status" },
      { name: "multiple messages", color: "#3B82F6", id: 19, description: "Lead sent multiple messages" },
      { name: "qualify", color: "#22C55E", id: 22, description: "Lead is qualified" },
      { name: "responded", color: "#22C55E", id: 24, description: "Lead has responded" },
      { name: "second message", color: "#EAB308", id: 26, description: "Second message sent" }
    ]
  },
  {
    type: "Outcome",
    tags: [
      { name: "appointment booked", color: "#FCB803", id: 3, description: "Lead has booked a call" },
      { name: "goodbye", color: "#64748B", id: 15, description: "Lead said goodbye/not interested" },
      { name: "no response", color: "#64748B", id: 21, description: "Lead never responded" },
      { name: "schedule", color: "#22C55E", id: 25, description: "Lead wants to schedule" }
    ]
  },
  {
    type: "Automation",
    tags: [
      { name: "ai stop", color: "#EF4444", id: 2, description: "Stop all AI-generated messages" },
      { name: "bump 1.1", color: "#3B82F6", id: 5, description: "First bump sent" },
      { name: "bump 2.1", color: "#3B82F6", id: 7, description: "Second bump sent" },
      { name: "bump 3.1", color: "#3B82F6", id: 29, description: "Third bump sent" },
      { name: "no bump", color: "#64748B", id: 20, description: "Do not send bump messages" },
      { name: "reply generating", color: "#EAB308", id: 23, description: "AI is generating reply" }
    ]
  },
  {
    type: "Behavior",
    tags: [
      { name: "dnd", color: "#EF4444", id: 11, description: "Do not contact - opted out" },
      { name: "manual takeover", color: "#F97316", id: 18, description: "Human agent took over conversation" }
    ]
  },
  {
    type: "Source",
    tags: [
      { name: "dbr android", color: "#A855F7", id: 10, description: "DBR Android source" },
      { name: "fb lead", color: "#A855F7", id: 12, description: "Facebook lead source" },
      { name: "sleeping beauty android optin", color: "#A855F7", id: 27, description: "Sleeping Beauty Android opt-in" }
    ]
  },
  {
    type: "Priority",
    tags: [
      { name: "high priority", color: "#EF4444", id: 16, description: "High priority lead" },
      { name: "warm lead", color: "#F97316", id: 28, description: "Warm lead - engaged" }
    ]
  }
];

export default function TagsPage() {
  const { currentAccountId, currentAccount } = useWorkspace();
  const [campaignId, setCampaignId] = useState<number | "all">("all");
  const [q, setQ] = useState("");
  const [selectedTagName, setSelectedTagName] = useState<string | null>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Mock accounts for filter (since we are in agency/subaccount view)
  const accounts = [{ id: 1, name: "Agency" }, { id: 2, name: "Subaccount" }];
  const [selectedAccountId, setSelectedAccountId] = useState<number | "all">("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [leadsRes, campaignsRes] = await Promise.all([
        apiFetch("/api/leads"),
        apiFetch("/api/campaigns"),
      ]);

      if (!leadsRes.ok && !campaignsRes.ok) {
        throw new Error(`${leadsRes.status}: Failed to fetch tags data`);
      }

      const leadsData = leadsRes.ok ? await leadsRes.json() : [];
      const campaignsData = campaignsRes.ok ? await campaignsRes.json() : [];
      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setCampaigns(Array.isArray(campaignsData) ? campaignsData : []);
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

  const accountLeads = useMemo(() => {
    return leads
      .filter((l: any) => (selectedAccountId === "all" ? true : (l.account_id || l.accounts_id || l.Accounts_id) === selectedAccountId))
      .filter((l: any) => (campaignId === "all" ? true : (l.campaign_id || l.campaigns_id || l.Campaigns_id) === campaignId));
  }, [leads, selectedAccountId, campaignId]);

  const campaignOptions = useMemo(() => {
    return campaigns.filter((c: any) => (selectedAccountId === "all" ? true : (c.account_id || c.accounts_id || c.Accounts_id) === selectedAccountId));
  }, [campaigns, selectedAccountId]);

  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    accountLeads.forEach((l: any) => {
      const tags = l.tags || l.Tags || [];
      if (Array.isArray(tags)) {
        tags.forEach((t: string) => {
          map.set(t, (map.get(t) ?? 0) + 1);
        });
      }
    });
    return map;
  }, [accountLeads]);

  const categoriesWithCounts = useMemo(() => {
    return TAG_CATEGORIES.map(cat => ({
      ...cat,
      tags: cat.tags
        .filter(t => (q ? t.name.toLowerCase().includes(q.toLowerCase()) : true))
        .map(t => ({
          ...t,
          count: tagCounts.get(t.name) ?? 0
        }))
    })).filter(cat => cat.tags.length > 0);
  }, [q, tagCounts]);

  const selectedTag = useMemo(
    () => TAG_CATEGORIES.flatMap(c => c.tags).find(t => t.name === selectedTagName) ?? null,
    [selectedTagName]
  );

  const selectedLeads = useMemo(() => {
    if (!selectedTagName) return [];
    return accountLeads.filter((l: any) => {
      const tags = l.tags || l.Tags || [];
      return Array.isArray(tags) && tags.includes(selectedTagName);
    });
  }, [selectedTagName, accountLeads]);

  const sortedCategories = useMemo(() => {
    return [...categoriesWithCounts].sort((a, b) => {
      const colorA = a.tags[0]?.color || "";
      const colorB = b.tags[0]?.color || "";
      return colorA.localeCompare(colorB);
    });
  }, [categoriesWithCounts]);

  if (error && leads.length === 0 && !loading) {
    return (
      <CrmShell>
        <ApiErrorFallback
          error={error}
          onRetry={fetchData}
          isRetrying={loading}
        />
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
      <div className="py-4">
        <div className="flex flex-col gap-4">
          {/* TOP SEARCH & FILTERS */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-1 gap-2 items-center w-full">
              <input
                className="h-10 flex-1 max-w-md rounded-xl border border-border bg-card px-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                placeholder="Search tags…"
                value={q}
                onChange={e => setQ(e.target.value)}
              />
              <Select value={selectedAccountId.toString()} onValueChange={v => setSelectedAccountId(v === "all" ? "all" : Number(v))}>
                <SelectTrigger className="w-[180px] h-10 rounded-xl bg-card">
                  <SelectValue placeholder="All Accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id.toString()}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={campaignId.toString()} onValueChange={v => setCampaignId(v === "all" ? "all" : Number(v))}>
                <SelectTrigger className="w-[180px] h-10 rounded-xl bg-card">
                  <SelectValue placeholder="All Campaigns" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campaigns</SelectItem>
                  {campaignOptions.map((c: any) => (
                    <SelectItem key={c.id || c.Id} value={(c.id || c.Id).toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6 items-start">
            {/* LEFT — TAGS */}
            <div className="space-y-8">
              {sortedCategories.map(cat => (
                <div key={cat.type} className="space-y-3">
                  <h3 className="inline-flex items-center px-3 py-1.5 rounded-lg bg-muted/15 dark:bg-muted/8 glass-surface text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {cat.type}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 bg-card p-4 rounded-2xl shadow-sm border border-border">
                    {cat.tags.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTagName(t.name === selectedTagName ? null : t.name)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-xl transition text-left border border-transparent",
                          selectedTagName === t.name
                            ? "ring-2 ring-primary bg-card"
                            : "hover:bg-muted/5"
                        )}
                        style={{
                          backgroundColor: `${t.color}05`
                        }}
                      >
                        <div
                          className="h-7 w-7 rounded-full text-[11px] font-bold flex items-center justify-center text-white shrink-0 shadow-sm"
                          style={{ backgroundColor: t.color }}
                        >
                          {t.count}
                        </div>

                        <div
                          className="truncate font-semibold text-[14px] text-foreground"
                        >
                          {t.name}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* RIGHT — STICKY */}
            <div className="space-y-4 sticky top-6">
              <div className="bg-card rounded-2xl shadow-sm border border-border flex flex-col max-h-[calc(100vh-200px)]">
                <div className="p-4 border-b space-y-1">
                  <div className="font-bold text-sm">
                    {selectedTagName ? `Leads: ${selectedTagName}` : "Tag Insights"}
                  </div>
                  {selectedTag?.description && (
                    <div className="text-xs text-muted-foreground">
                      {selectedTag.description}
                    </div>
                  )}
                </div>

                <div className="overflow-y-auto divide-y">
                  {!selectedTagName ? (
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
                    selectedLeads.map((l: any) => (
                      <div key={l.id || l.Id} className="p-4 hover:bg-muted/10">
                        <div className="font-bold text-sm truncate">{l.full_name || l.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          Last message: {(l.last_message_sent_at || l.Last_Message_Sent_At) ? new Date(l.last_message_sent_at || l.Last_Message_Sent_At).toLocaleDateString() : "No messages yet"}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CrmShell>
  );
}
