import { useMemo, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useLeads } from "@/hooks/useLeads";
import { LeadDetailLayout } from "@/components/LeadDetailLayout";
import { SkeletonLeadDetail } from "@/components/ui/skeleton";
import { usePublishEntityData } from "@/contexts/PageEntityContext";

export default function LeadDetailPage() {
  const [location, setLocation] = useLocation();
  const isAgency = location.startsWith("/agency");

  const [, params] = useRoute(isAgency ? "/agency/contacts/:id" : "/subaccount/contacts/:id");
  const id = Number(params?.id);

  const { currentAccountId } = useWorkspace();
  const { leads, interactions, isLoading } = useLeads({
    accountId: isAgency ? null : currentAccountId,
  });

  const lead = useMemo(() => {
    if (!Number.isFinite(id) || id <= 0) return null;
    return leads.find((l) => l.id === id) ?? null;
  }, [id, leads]);

  const chat = useMemo(() => {
    if (!lead) return [];
    return interactions.filter((m: any) => m.lead_id === lead.id);
  }, [lead, interactions]);

  const tags = useMemo(() => {
    if (!lead) return [];
    const fromNotes = String(lead.notes || "").trim();
    const base = fromNotes ? fromNotes.split(/[;,|]/g).map((s) => s.trim()).filter(Boolean) : [];
    return Array.from(new Set([...(lead.tags ?? []), ...base])).slice(0, 12);
  }, [lead]);

  // Publish lead entity data for AI agent context
  const publishEntity = usePublishEntityData();
  useEffect(() => {
    if (lead) {
      publishEntity({
        entityType: "lead",
        entityId: lead.id,
        entityName: lead.full_name || `${lead.first_name || ""} ${lead.last_name || ""}`.trim(),
        summary: {
          id: lead.id,
          name: lead.full_name || `${lead.first_name || ""} ${lead.last_name || ""}`.trim(),
          email: lead.email,
          phone: lead.phone,
          status: lead.conversion_status,
          source: lead.source,
          priority: lead.priority,
          tags,
          messageCount: chat.length,
          campaignId: lead.campaign_id || lead.campaigns_id,
        },
        updatedAt: Date.now(),
      });
    }
  }, [lead, tags, chat.length, publishEntity]);

  return (
    <CrmShell>
      {isLoading ? (
        <SkeletonLeadDetail data-testid="status-contact-loading" />
      ) : !lead ? (
        <div className="px-6 py-6 text-sm text-muted-foreground" data-testid="text-contact-missing">
          Contact not found.
        </div>
      ) : (
        <LeadDetailLayout
          mode={isAgency ? "agency" : "subaccount"}
          lead={lead as any}
          messages={chat as any}
          tags={tags}
          onBack={() => setLocation(isAgency ? "/agency/contacts" : "/subaccount/contacts")}
        />
      )}
    </CrmShell>
  );
}
