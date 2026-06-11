// Campaign / account assignment block for LeadDetailPanel.
// Extracted verbatim (Session C).
import { Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SectionTitle, InfoRow } from "./atoms";
import { StatusBadge, PriorityBadge } from "./badges";
import { fmtDate } from "./format";

interface LeadAssignmentSectionProps {
  lead: Record<string, any>;
  convStatus: string;
  priority: string;
}

export function LeadAssignmentSection({ lead, convStatus, priority }: LeadAssignmentSectionProps) {
  const { t } = useTranslation("leads");
  return (
    <>
      {/* Campaign / Account */}
      <SectionTitle icon={<Tag className="h-3.5 w-3.5" />} title={t("detailView.assignment")} />
      <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-1.5 mb-6">
        <InfoRow label={t("detail.fields.account")} value={lead.Account || lead.account_id} />
        <InfoRow label={t("detailView.campaign")} value={lead.Campaign || lead.campaign_id} />
        <InfoRow label={t("contact.created")} value={fmtDate(lead.created_at)} />
        {convStatus && (
          <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
            <span className="text-[11px] text-muted-foreground shrink-0">{t("detail.sections.status")}</span>
            <StatusBadge label={convStatus} />
          </div>
        )}
        {priority && (
          <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
            <span className="text-[11px] text-muted-foreground shrink-0">{t("detail.fields.priority")}</span>
            <PriorityBadge priority={priority} />
          </div>
        )}
      </div>
    </>
  );
}
