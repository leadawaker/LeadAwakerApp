import { useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { tags as mockTags, leads } from "@/data/mocks";
import { FiltersBar } from "@/components/crm/FiltersBar";
import { cn } from "@/lib/utils";

const TAG_CATEGORIES = [
  {
    type: "Status",
    tags: [
      { name: "bump 1 reply", color: "#3B82F6", id: 4, description: "Lead replied to first bump" },
      { name: "bump 2 reply", color: "#3B82F6", id: 6, description: "Lead replied to second bump" },
      { name: "bump 3 reply", color: "#3B82F6", id: 8, description: "Lead replied to third bump" },
      { name: "bump 3.1", color: "#3B82F6", id: 29, description: "Third bump sent" },
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
      { name: "appointment booked", color: "#22C55E", id: 3, description: "Lead has booked a call" },
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
  const { currentAccountId } = useWorkspace();
  const [campaignId, setCampaignId] = useState<number | "all">("all");
  const [q, setQ] = useState("");
  const [selectedTagName, setSelectedTagName] = useState<string | null>(null);

  const categoriesWithCounts = useMemo(() => {
    const accountLeads = leads
      .filter((l) => l.account_id === currentAccountId)
      .filter((l) => (campaignId === "all" ? true : l.campaign_id === campaignId));
    
    const counts = new Map<string, number>();
    accountLeads.forEach((l) => {
      const raw = l.tags ?? [];
      raw.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
    });

    return TAG_CATEGORIES.map(cat => ({
      ...cat,
      tags: cat.tags
        .filter(t => q ? t.name.toLowerCase().includes(q.toLowerCase()) : true)
        .map(t => ({
          ...t,
          count: counts.get(t.name) ?? 0
        }))
    })).filter(cat => cat.tags.length > 0);
  }, [currentAccountId, campaignId, q]);

  const selectedLeads = useMemo(() => {
    if (!selectedTagName) return [];
    return leads
      .filter((l) => l.account_id === currentAccountId)
      .filter((l) => (campaignId === "all" ? true : l.campaign_id === campaignId))
      .filter((l) => l.tags?.includes(selectedTagName));
  }, [selectedTagName, currentAccountId, campaignId]);

  return (
    <CrmShell>
      <div className="h-full flex flex-col px-6 py-6 overflow-hidden" data-testid="page-tags">
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6">
          <div className="flex flex-col min-h-0 overflow-hidden">
            <div className="mt-2 overflow-y-auto pr-2 space-y-8" data-testid="grid-tags">
              {categoriesWithCounts.map((cat) => (
                <div key={cat.type} className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">
                    {cat.type}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 bg-white p-4 rounded-3xl">
                    {cat.tags.map((t, idx) => (
                      <button
                        key={`${cat.type}-${idx}`}
                        title={t.description}
                        onClick={() => setSelectedTagName(t.name === selectedTagName ? null : t.name)}
                        className={cn(
                          "rounded-2xl border-none bg-slate-50/50 p-3 flex items-center justify-between group transition-all text-left shadow-none relative",
                          selectedTagName === t.name ? "ring-2 ring-primary border-transparent" : "hover:bg-muted/20"
                        )}
                        data-testid={`card-tag-${cat.type}-${idx}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm truncate" data-testid={`text-tag-name-${cat.type}-${idx}`}>{t.name}</div>
                          <div className="mt-0.5 text-[10px] text-muted-foreground" data-testid={`text-tag-count-${cat.type}-${idx}`}>{t.count} leads</div>
                        </div>
                        <div 
                          className="h-6 w-6 rounded-lg flex items-center justify-center transition-colors shrink-0 ml-2"
                          style={{ backgroundColor: `${t.color}20`, color: t.color }}
                        >
                          <span className="text-[8px] font-bold">TAG</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border-none bg-white flex flex-col overflow-hidden h-full shadow-none" data-testid="panel-leads-per-tag">
            <div className="p-4 border-b border-border bg-muted/5 shrink-0 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate" data-testid="text-selected-tag">
                    {selectedTagName ? `Leads: ${selectedTagName}` : "Tag Insights"}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
                    {selectedTagName ? "Distribution overview" : "Search and filter tags"}
                  </div>
                </div>
              </div>
              <div className="relative">
                <input
                  className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="Search tags…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  data-testid="input-tag-search"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {!selectedTagName ? (
                <div className="p-8 text-center text-muted-foreground opacity-40">
                  <div className="text-4xl mb-2">🏷️</div>
                  <div className="text-xs font-medium">Click a tag to see associated leads</div>
                </div>
              ) : selectedLeads.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground opacity-40">
                  <div className="text-xs font-medium">No leads found with this tag</div>
                </div>
              ) : (
                selectedLeads.map((l) => (
                  <div key={l.id} className="p-4 hover:bg-muted/10 transition-colors" data-testid={`row-tag-lead-${l.id}`}>
                    <div className="font-bold text-sm truncate mb-1">{l.full_name}</div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">Applied:</span>
                        <span className="font-medium text-foreground">02 Feb - 2026</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">Last Message:</span>
                        <span className="font-medium text-foreground">
                          {l.last_message_sent_at ? "01 Feb - 2026" : "No messages yet"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </CrmShell>
  );
}
            
            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {!selectedTagName ? (
                <div className="p-8 text-center text-muted-foreground opacity-40">
                  <div className="text-4xl mb-2">🏷️</div>
                  <div className="text-xs font-medium">Click a tag to see associated leads</div>
                </div>
              ) : selectedLeads.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground opacity-40">
                  <div className="text-xs font-medium">No leads found with this tag</div>
                </div>
              ) : (
                selectedLeads.map((l) => (
                  <div key={l.id} className="p-4 hover:bg-muted/10 transition-colors" data-testid={`row-tag-lead-${l.id}`}>
                    <div className="font-bold text-sm truncate mb-1">{l.full_name}</div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">Applied:</span>
                        <span className="font-medium text-foreground">02 Feb - 2026</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">Last Message:</span>
                        <span className="font-medium text-foreground">
                          {l.last_message_sent_at ? "01 Feb - 2026" : "No messages yet"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </CrmShell>
  );
}
