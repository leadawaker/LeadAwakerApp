import { CrmShell } from "@/components/crm/CrmShell";
import { LeadsTable } from "../components/LeadsTable";

export function LeadsPage() {
  return (
    <CrmShell>
      <div className="flex flex-col h-full pb-4">
        <div className="flex-1">
          <LeadsTable />
        </div>
      </div>
    </CrmShell>
  );
}
