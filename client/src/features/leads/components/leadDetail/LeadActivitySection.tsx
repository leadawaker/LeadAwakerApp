// Activity metrics block for LeadDetailPanel (timestamps + message counts).
// Extracted verbatim (Session C).
import { MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SectionTitle, InfoRow } from "./atoms";
import { fmtDate, fmtDateTime } from "./format";

interface LeadActivitySectionProps {
  lead: Record<string, any>;
  responseRate: string;
  daysInactive: string;
}

export function LeadActivitySection({ lead, responseRate, daysInactive }: LeadActivitySectionProps) {
  const { t } = useTranslation("leads");
  return (
    <>
      {/* Activity */}
      <SectionTitle icon={<MessageSquare className="h-3.5 w-3.5" />} title={t("detail.sections.activity")} />
      <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-1.5">
        <InfoRow label={t("detail.fields.leadCreated")} value={fmtDate(lead.created_at)} />
        <InfoRow label={t("detail.fields.lastUpdated")} value={fmtDateTime(lead.updated_at)} />
        <InfoRow label={t("detail.fields.lastInteraction")} value={fmtDateTime(lead.last_interaction_at)} />
        <InfoRow label={t("detail.fields.lastSent")} value={fmtDateTime(lead.last_message_sent_at)} />
        <InfoRow label={t("detail.fields.lastReceived")} value={fmtDateTime(lead.last_message_received_at)} />
        <InfoRow label={t("detail.fields.sentCount")} value={lead.message_count_sent} />
        <InfoRow label={t("detail.fields.receivedCount")} value={lead.message_count_received} />
        <InfoRow label={t("detail.fields.responseRate")} value={responseRate} />
        <InfoRow label={t("detail.fields.daysInactive")} value={daysInactive} />
        <InfoRow label={t("detail.fields.firstContacted")} value={fmtDate(lead.first_message_sent_at)} />
        <InfoRow label={t("detail.fields.nextAction")} value={fmtDateTime(lead.next_action_at)} />
        {lead.what_has_the_lead_done && (
          <InfoRow label={t("detail.fields.whatTheyDid")} value={lead.what_has_the_lead_done} />
        )}
      </div>
    </>
  );
}
