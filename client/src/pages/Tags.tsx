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
      { name: "New Lead", color: "#3B82F6" },
      { name: "Contacted", color: "#10B981" },
      { name: "Qualified", color: "#EC4899" },
      { name: "Closed - Won", color: "#059669" },
      { name: "Closed - Lost", color: "#4B5563" },
      { name: "DND / Opt-out", color: "#1F2937" }
    ]
  },
  {
    type: "Outcome",
    tags: [
      { name: "Ready to Book", color: "#14B8A6" },
      { name: "Appointment Scheduled", color: "#6366F1" },
      { name: "Post-Call Follow-up", color: "#F43F5E" },
      { name: "Booked", color: "#facc15" }
    ]
  },
  {
    type: "Automation",
    tags: [
      { name: "Nurturing", color: "#8B5CF6" },
      { name: "Re-engagement", color: "#D946EF" },
      { name: "Follow-up Required", color: "#F59E0B" },
      { name: "Follow-up", color: "#F59E0B" }
    ]
  },
  {
    type: "Behavior",
    tags: [
      { name: "High Intent", color: "#EF4444" },
      { name: "Future Interest", color: "#84CC16" },
      { name: "Technical Question", color: "#64748B" },
      { name: "Needs details", color: "#64748B" },
      { name: "No-show risk", color: "#EF4444" }
    ]
  },
  {
    type: "Source",
    tags: [
      { name: "Referral", color: "#A855F7" },
      { name: "Partner Lead", color: "#F97316" },
      { name: "Facebook", color: "#1877F2" },
      { name: "Google", color: "#DB4437" }
    ]
  },
  {
    type: "Priority",
    tags: [
      { name: "Hot", color: "#EF4444" },
      { name: "Pricing Inquiry", color: "#0EA5E9" },
      { name: "Pricing", color: "#0EA5E9" }
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
            <div className="flex items-center gap-2 shrink-0" data-testid="bar-tags">
              <input
                className="h-10 w-[280px] max-w-full rounded-xl border border-border bg-muted/20 px-3 text-sm"
                placeholder="Search tags…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                data-testid="input-tag-search"
              />
            </div>

            <div className="mt-6 overflow-y-auto pr-2 space-y-8" data-testid="grid-tags">
              {categoriesWithCounts.map((cat) => (
                <div key={cat.type} className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">
                    {cat.type}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 bg-white p-4 rounded-3xl">
                    {cat.tags.map((t, idx) => (
                      <button
                        key={`${cat.type}-${idx}`}
                        onClick={() => setSelectedTagName(t.name === selectedTagName ? null : t.name)}
                        className={cn(
                          "rounded-2xl border-none bg-slate-50/50 p-3 flex items-center justify-between group transition-all text-left shadow-none",
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
            <div className="p-4 border-b border-border bg-muted/5 shrink-0">
              <div className="font-bold text-sm" data-testid="text-selected-tag">
                {selectedTagName ? `Leads: ${selectedTagName}` : "Select a tag to view leads"}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
                Distribution overview
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
