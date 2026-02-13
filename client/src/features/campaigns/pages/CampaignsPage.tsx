import { CrmShell } from "@/components/crm/CrmShell";
import { CampaignsTable } from "../components/CampaignsTable";

export function CampaignsPage() {
  return (
    <CrmShell>
      <div className="flex flex-col h-full pb-4">
        <div className="flex-1">
          <CampaignsTable />
        </div>
      </div>
    </CrmShell>
  );
}