import { useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { leads } from "@/data/mocks";
import { cn } from "@/lib/utils";

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
  const { currentAccountId } = useWorkspace();
  const [campaignId] = useState<number | "all">("all");
  const [q, setQ] = useState("");
  const [selectedTagName, setSelectedTagName] = useState<string | null>(null);

  const accountLeads = useMemo(() => {
    return leads
      .filter(l => l.account_id === currentAccountId)
      .filter(l => (campaignId === "all" ? true : l.campaign_id === campaignId));
  }, [currentAccountId, campaignId]);

  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    accountLeads.forEach(l => {
      l.tags?.forEach(t => {
        const normalized = t.toLowerCase();
        map.set(normalized, (map.get(normalized) ?? 0) + 1);
      });
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
          count: tagCounts.get(t.name.toLowerCase()) ?? 0
        }))
    })).filter(cat => cat.tags.length > 0);
  }, [q, tagCounts]);

  const selectedTag = useMemo(
    () => TAG_CATEGORIES.flatMap(c => c.tags).find(t => t.name === selectedTagName) ?? null,
    [selectedTagName]
  );

  const selectedLeads = useMemo(() => {
    if (!selectedTagName) return [];
    return accountLeads.filter(l => l.tags?.includes(selectedTagName));
  }, [selectedTagName, accountLeads]);

  return (
    <CrmShell>
      <div className="px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6 items-start">

          {/* LEFT — TAGS (NATURAL SCROLL, NO CROPPING) */}
          <div className="space-y-8">
            {categoriesWithCounts.map(cat => (
              <div key={cat.type} className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">
                  {cat.type}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 bg-white p-4 rounded-3xl">
                  {cat.tags.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTagName(t.name === selectedTagName ? null : t.name)}
                      className={cn(
                        "flex items-center gap-3 px-2 py-2 rounded-xl transition text-left relative",
                        selectedTagName === t.name
                          ? "ring-2 ring-primary"
                          : "hover:bg-muted/10"
                      )}
                    >
                      <div
                        className="h-8 w-8 rounded-full text-[10px] font-bold flex items-center justify-center text-white shrink-0 relative overflow-hidden"
                        style={{ backgroundColor: t.color }}
                      >
                        <span className="relative z-10">{t.count}</span>
                        <div className="absolute inset-0 bg-black/10" />
                      </div>

                      <div
                        className="truncate font-semibold text-[14px]"
                        style={{ color: t.color }}
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

            <input
              className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="Search tags…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />

            <div className="bg-white rounded-2xl flex flex-col max-h-[calc(100vh-200px)]">
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
                  <div className="p-8 text-center text-muted-foreground opacity-40">
                    Click a tag to see associated leads
                  </div>
                ) : selectedLeads.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground opacity-40">
                    No leads found with this tag
                  </div>
                ) : (
                  selectedLeads.map(l => (
                    <div key={l.id} className="p-4 hover:bg-muted/10">
                      <div className="font-bold text-sm truncate">{l.full_name}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        Last message: {l.last_message_sent_at ? "01 Feb 2026" : "No messages yet"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </CrmShell>
  );
}