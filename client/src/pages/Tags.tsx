import { useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { tags as mockTags, leads } from "@/data/mocks";
import { FiltersBar } from "@/components/crm/FiltersBar";

const CSV_TAGS = [
  "New Lead",
  "Contacted",
  "Follow-up Required",
  "Nurturing",
  "Qualified",
  "High Intent",
  "Ready to Book",
  "Appointment Scheduled",
  "Post-Call Follow-up",
  "Closed - Won",
  "Closed - Lost",
  "DND / Opt-out",
  "Re-engagement",
  "Future Interest",
  "Pricing Inquiry",
  "Technical Question",
  "Referral",
  "Partner Lead"
];

export default function TagsPage() {
  const { currentAccountId } = useWorkspace();
  const [campaignId, setCampaignId] = useState<number | "all">("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const accountLeads = leads
      .filter((l) => l.account_id === currentAccountId)
      .filter((l) => (campaignId === "all" ? true : l.campaign_id === campaignId));
    
    const counts = new Map<string, number>();
    accountLeads.forEach((l) => {
      const raw = l.tags ?? [];
      raw.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
    });

    // Combine mock tags with CSV tags for the list
    const allTagNames = Array.from(new Set([...mockTags.map(t => t.name), ...CSV_TAGS]));

    return allTagNames
      .filter((name) => (q ? name.toLowerCase().includes(q.toLowerCase()) : true))
      .map((name, idx) => ({ 
        id: idx, 
        name, 
        count: counts.get(name) ?? 0 
      }))
      .sort((a, b) => b.count - a.count);
  }, [currentAccountId, campaignId, q]);

  return (
    <CrmShell>
      <div className="px-6 py-6" data-testid="page-tags">
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight" data-testid="text-title">Tags</h1>
          <FiltersBar selectedCampaignId={campaignId} setSelectedCampaignId={setCampaignId} />
        </div>

        <div className="mt-4 flex items-center gap-2" data-testid="bar-tags">
          <input
            className="h-10 w-[280px] max-w-full rounded-xl border border-border bg-muted/20 px-3 text-sm"
            placeholder="Search tags…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="input-tag-search"
          />
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" data-testid="grid-tags">
          {rows.map((t) => (
            <div key={t.id} className="rounded-2xl border border-border bg-background p-4 flex items-center justify-between group hover:border-primary/50 transition-colors" data-testid={`card-tag-${t.id}`}>
              <div>
                <div className="font-semibold" data-testid={`text-tag-name-${t.id}`}>{t.name}</div>
                <div className="mt-1 text-xs text-muted-foreground" data-testid={`text-tag-count-${t.id}`}>{t.count} leads</div>
              </div>
              <div className="h-8 w-8 rounded-full bg-muted/30 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                <span className="text-[10px] font-bold text-muted-foreground group-hover:text-primary">TAG</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </CrmShell>
  );
}
