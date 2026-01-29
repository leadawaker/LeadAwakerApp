import { useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { campaigns, interactions, leads } from "@/data/mocks";
import { FiltersBar } from "@/components/crm/FiltersBar";

export default function AppCampaigns() {
  const { currentAccountId } = useWorkspace();
  const [campaignId, setCampaignId] = useState<number | "all">("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const rows = useMemo(() => {
    return campaigns
      .filter((c) => c.account_id === currentAccountId)
      .filter((c) => (campaignId === "all" ? true : c.id === campaignId));
  }, [currentAccountId, campaignId]);

  return (
    <CrmShell>
      <div className="px-6 py-6" data-testid="page-campaigns">
        <h1 className="text-2xl font-extrabold tracking-tight" data-testid="text-title">Campaigns</h1>
        <p className="text-sm text-muted-foreground" data-testid="text-subtitle">
          Click a campaign to expand inline (MOCK).
        </p>

        <div className="mt-4">
          <FiltersBar selectedCampaignId={campaignId} setSelectedCampaignId={setCampaignId} />
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-background overflow-hidden" data-testid="list-campaigns">
          <div className="divide-y divide-border">
            {rows.map((c) => {
              const expanded = expandedId === c.id;
              const sent = interactions.filter((i) => i.campaign_id === c.id && i.direction === "Outbound").length;
              const received = interactions.filter((i) => i.campaign_id === c.id && i.direction === "Inbound").length;
              const leadCount = leads.filter((l) => l.campaign_id === c.id && l.account_id === c.account_id).length;

              return (
                <div key={c.id} className="p-4" data-testid={`card-campaign-${c.id}`}>
                  <button
                    type="button"
                    onClick={() => setExpandedId((prev) => (prev === c.id ? null : c.id))}
                    className="w-full flex items-start justify-between gap-4"
                    data-testid={`button-campaign-toggle-${c.id}`}
                  >
                    <div className="min-w-0 text-left">
                      <div className="font-semibold" data-testid={`text-campaign-name-${c.id}`}>{c.name}</div>
                      <div className="text-xs text-muted-foreground" data-testid={`text-campaign-meta-${c.id}`}>
                        {c.status} • {c.type} • leads={leadCount}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground" data-testid={`text-campaign-expand-${c.id}`}>
                      {expanded ? "Collapse" : "Expand"}
                    </div>
                  </button>

                  {expanded && (
                    <div className="mt-4 rounded-2xl border border-border bg-muted/10 p-4" data-testid={`panel-campaign-expand-${c.id}`}>
                      <div className="text-sm font-semibold" data-testid={`text-campaign-desc-title-${c.id}`}>Description</div>
                      <div className="mt-1 text-sm text-muted-foreground" data-testid={`text-campaign-desc-${c.id}`}>{c.description}</div>

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground" data-testid={`text-bumps-title-${c.id}`}>bump_templates (snippet)</div>
                          <pre className="mt-1 text-xs whitespace-pre-wrap rounded-xl border border-border bg-background p-3" data-testid={`pre-bumps-${c.id}`}>
{`bump_1: ${c.bump_1_template.slice(0, 80)}…\nbump_2: ${c.bump_2_template.slice(0, 80)}…\nbump_3: ${c.bump_3_template.slice(0, 80)}…`}
                          </pre>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground" data-testid={`text-ai-title-${c.id}`}>ai_prompt_template (truncated)</div>
                          <pre className="mt-1 text-xs whitespace-pre-wrap rounded-xl border border-border bg-background p-3" data-testid={`pre-ai-${c.id}`}>
{`${c.ai_prompt_template.slice(0, 220)}…`}
                          </pre>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <Stat label="sent" value={String(sent)} testId={`stat-sent-${c.id}`} />
                        <Stat label="received" value={String(received)} testId={`stat-received-${c.id}`} />
                        <Stat label="cost" value={`$${c.total_cost.toFixed(2)}`} testId={`stat-cost-${c.id}`} />
                        <Stat label="ai_model" value={c.ai_model} testId={`stat-model-${c.id}`} />
                      </div>

                      <div className="mt-3 text-xs text-muted-foreground" data-testid={`text-campaign-real-${c.id}`}>
                        REAL: load campaign stats from NocoDB + Twilio status
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </CrmShell>
  );
}

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-3" data-testid={testId}>
      <div className="text-[11px] text-muted-foreground" data-testid={`${testId}-label`}>{label}</div>
      <div className="mt-1 font-semibold" data-testid={`${testId}-value`}>{value}</div>
    </div>
  );
}
