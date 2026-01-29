import { Link } from "wouter";
import { useMemo, useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { leads, interactions } from "@/data/mocks";
import { CrmShell } from "@/components/crm/CrmShell";
import { FiltersBar } from "@/components/crm/FiltersBar";

export default function ConversationsPage() {
  const { currentAccountId } = useWorkspace();
  const [campaignId, setCampaignId] = useState<number | "all">("all");

  const rows = useMemo(() => {
    return leads
      .filter((l) => l.account_id === currentAccountId)
      .filter((l) => (campaignId === "all" ? true : l.campaign_id === campaignId))
      .map((l) => {
        const last = interactions
          .filter((i) => i.lead_id === l.id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        return { lead: l, last };
      })
      .sort((a, b) => (b.last?.created_at ?? "").localeCompare(a.last?.created_at ?? ""));
  }, [currentAccountId, campaignId]);

  return (
    <CrmShell>
      <div className="px-6 py-6" data-testid="page-conversations">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" data-testid="text-title">
              Conversations
            </h1>
            <p className="text-sm text-muted-foreground" data-testid="text-subtitle">
              Lead list focused on messaging activity (MOCK).
            </p>
          </div>
        </div>

        <div className="mt-4">
          <FiltersBar selectedCampaignId={campaignId} setSelectedCampaignId={setCampaignId} />
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-background overflow-hidden" data-testid="table-conversations">
          <div className="divide-y divide-border">
            {rows.map(({ lead, last }) => (
              <div key={lead.id} className="p-4 flex items-start justify-between gap-4" data-testid={`row-conv-${lead.id}`}>
                <div className="min-w-0">
                  <div className="font-semibold truncate" data-testid={`text-conv-name-${lead.id}`}>
                    <Link href={`/app/lead/${lead.id}`} className="hover:underline" data-testid={`link-lead-${lead.id}`}>
                      {lead.full_name}
                    </Link>
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid={`text-conv-phone-${lead.id}`}>{lead.phone}</div>
                  <div className="mt-2 text-sm text-muted-foreground line-clamp-2" data-testid={`text-conv-last-${lead.id}`}>
                    {last ? last.content : "No messages yet."}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap" data-testid={`text-conv-time-${lead.id}`}>
                  {last ? new Date(last.created_at).toLocaleString() : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 text-xs text-muted-foreground" data-testid="text-real">
          REAL: useSWR(`${import.meta.env.VITE_NOCODB_URL}/api/v1/db/data/nocodb/Interactions`)
        </div>
      </div>
    </CrmShell>
  );
}
