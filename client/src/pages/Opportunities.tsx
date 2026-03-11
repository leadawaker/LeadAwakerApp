// Opportunities page — full-page Kanban pipeline view.
import { OpportunitiesPage } from "@/features/leads/pages/OpportunitiesPage";
import { CrmShell } from "@/components/crm/CrmShell";

export default function Opportunities() {
  return (
    <CrmShell>
      <OpportunitiesPage />
    </CrmShell>
  );
}
